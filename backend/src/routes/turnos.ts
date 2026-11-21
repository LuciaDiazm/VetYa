import { Router, type Response } from "express";
import { z } from "zod";
import { nombre } from "../lib/textos";
import {
  aFechaUTC,
  diaArgentina,
  esFechaValida,
  grillaHorarios,
  horaArgentina,
  horariosLibres,
  sumarDias,
  validarHorario,
} from "../lib/agenda";
import { requiereRol, requiereSesion } from "../lib/auth";
import { registrarCambio } from "../lib/auditoria";
import { PERSONAL, requierePermiso } from "../lib/permisos";
import { prisma } from "../lib/prisma";
import { bloquearAgenda, opcionesReserva, suspensionVigente, turnosWebActivos } from "../lib/sanciones";

const CLINICA_ID = 1;
const DIAS_A_MOSTRAR = 14; // a partir de mañana; hoy se suma aparte solo si queda lugar
const ANTICIPACION_ONLINE_MINUTOS = 120; // online no se puede pedir un turno para dentro de menos de 2 horas

const fecha = z.string().refine(esFechaValida, "Fecha inválida");
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida");

function hoy() {
  return diaArgentina(new Date());
}

function responderError(res: Response, error: z.ZodError) {
  res.status(400).json({ error: error.issues[0].message });
}

// Corta la reserva desde adentro de la transacción (deshace todo) con un mensaje para la persona.
class ProblemaReserva extends Error {
  constructor(mensaje: string, readonly estado = 409) {
    super(mensaje);
  }
}

function fechaCorta(fecha: Date) {
  return fecha.toLocaleDateString("es-AR", { day: "numeric", month: "long", timeZone: "America/Argentina/Buenos_Aires" });
}

// =====================================================================
// Turnos online: los horarios son públicos, pero pedir el turno exige cuenta de dueño
// =====================================================================

export const turnosPublicoRouter = Router();

// Servicios que se pueden reservar online.
turnosPublicoRouter.get("/servicios", async (_req, res) => {
  const servicios = await prisma.servicio.findMany({
    where: { clinicaId: CLINICA_ID, activo: true, reservableOnline: true },
    omit: { precioReferencia: true }, // el precio se ve solo en el panel, nunca en la web
    orderBy: [{ categoria: "asc" }, { nombre: "asc" }],
  });
  res.json(servicios);
});

// Horarios de los próximos días para un servicio, libres y ocupados (la web muestra los ocupados tachados).
turnosPublicoRouter.get("/disponibilidad", async (req, res) => {
  const servicioId = Number(req.query.servicioId);
  const servicio = await prisma.servicio.findFirst({
    where: { id: servicioId, clinicaId: CLINICA_ID, activo: true, reservableOnline: true },
  });
  if (!servicio) {
    res.status(404).json({ error: "Ese servicio no se puede reservar online" });
    return;
  }
  // Hoy aparece solo si todavía queda algún horario libre (el filtro de días vacíos lo hace la web).
  const grilla = await grillaHorarios(CLINICA_ID, servicioId, hoy(), DIAS_A_MOSTRAR + 1, {
    anticipacionMinutos: ANTICIPACION_ONLINE_MINUTOS,
  });
  res.json(grilla);
});

const esquemaTurnoOnline = z.object({
  servicioId: z.number().int(),
  fecha,
  hora,
  // Una mascota que ya está en su ficha, o una nueva.
  mascota: z.union([
    z.object({ id: z.number().int() }),
    z
      .object({
        nombre: nombre("Escribí el nombre de tu mascota"),
        especie: z.enum(["PERRO", "GATO", "OTRO"]),
        // Solo si es "Otro": qué animal es.
        otraEspecie: z.string().trim().max(60).optional(),
      })
      .refine((m) => m.especie !== "OTRO" || m.otraEspecie, {
        message: "Escribí qué animal es (por ejemplo: conejo)",
        path: ["otraEspecie"],
      }),
  ]),
  motivo: z.string().trim().max(500).optional(),
});

turnosPublicoRouter.post("/", requiereSesion, requiereRol("DUENIO"), async (req, res) => {
  const resultado = esquemaTurnoOnline.safeParse(req.body);
  if (!resultado.success) return responderError(res, resultado.error);
  const datos = resultado.data;

  const servicio = await prisma.servicio.findFirst({
    where: { id: datos.servicioId, clinicaId: CLINICA_ID, activo: true, reservableOnline: true },
  });
  if (!servicio) {
    res.status(400).json({ error: "Ese servicio no se puede reservar online" });
    return;
  }

  // El turno siempre queda en la ficha del dueño que inició sesión.
  const cliente = await prisma.cliente.findUnique({
    where: { usuarioId: req.usuario!.id },
    include: { mascotas: { where: { activo: true } } },
  });
  if (!cliente) {
    res.status(400).json({ error: "Tu cuenta no tiene una ficha en la clínica. Escribinos por WhatsApp" });
    return;
  }
  // La clínica puede suspender a quien abusa de los turnos web (cancela muchos seguidos).
  const suspendido = suspensionVigente(cliente);
  if (suspendido) {
    res.status(403).json({
      error: `Por ahora no podés sacar turnos por la web (hasta el ${fechaCorta(suspendido)}). Escribinos por WhatsApp y te damos uno.`,
    });
    return;
  }
  const pedida = datos.mascota;
  // Si escribe el nombre de una mascota que ya tiene, se usa esa en lugar de duplicarla.
  const mascotaExistente =
    "id" in pedida
      ? cliente.mascotas.find((m) => m.id === pedida.id)
      : cliente.mascotas.find((m) => m.nombre.trim().toLowerCase() === pedida.nombre.toLowerCase());
  if ("id" in pedida && !mascotaExistente) {
    res.status(400).json({ error: "Elegí una de tus mascotas" });
    return;
  }

  // El administrador puede darle a un cliente un límite propio (por ejemplo, alguien con muchos animales).
  const clinica = await prisma.clinica.findUniqueOrThrow({
    where: { id: CLINICA_ID },
    select: { maxTurnosOnline: true },
  });
  const maxTurnosOnline = cliente.maxTurnosOnline ?? clinica.maxTurnosOnline;

  let turno;
  try {
    turno = await prisma.$transaction(async (tx) => {
      // Una reserva por vez: si otra persona está pidiendo un turno en este mismo momento, se espera a que termine.
      await bloquearAgenda(tx, CLINICA_ID);

      // Se vuelve a verificar el horario: alguien pudo haberlo tomado mientras se completaba el formulario.
      const problema = await validarHorario(CLINICA_ID, servicio.id, datos.fecha, datos.hora, {
        anticipacionMinutos: ANTICIPACION_ONLINE_MINUTOS,
      });
      if (problema) throw new ProblemaReserva(problema);

      if (maxTurnosOnline > 0 && (await turnosWebActivos(cliente.id, tx)) >= maxTurnosOnline) {
        throw new ProblemaReserva(
          `Ya tenés ${maxTurnosOnline} turnos pedidos por la web. Cuando pase uno vas a poder pedir otro, o escribinos por WhatsApp.`,
          400,
        );
      }

      const mascota =
        mascotaExistente ??
        (await tx.mascota.create({
          data: {
            clienteId: cliente.id,
            nombre: (pedida as { nombre: string }).nombre,
            especie: (pedida as { especie: "PERRO" | "GATO" | "OTRO" }).especie,
            otraEspecie:
              (pedida as { especie: string }).especie === "OTRO" ? (pedida as { otraEspecie?: string }).otraEspecie : null,
            sexo: "MACHO",
          },
        }));

      const inicio = aFechaUTC(datos.fecha, datos.hora);
      return tx.turno.create({
        data: {
          clinicaId: CLINICA_ID,
          mascotaId: mascota.id,
          servicioId: servicio.id,
          fechaHoraInicio: inicio,
          fechaHoraFin: new Date(inicio.getTime() + servicio.duracionMin * 60 * 1000),
          // Queda confirmado en el momento: el horario ya se verificó y el recordatorio sale el día anterior.
          estado: "CONFIRMADO",
          origen: "ONLINE",
          observaciones: datos.motivo || null,
        },
      });
    }, opcionesReserva);
  } catch (error) {
    if (error instanceof ProblemaReserva) {
      res.status(error.estado).json({ error: error.message });
      return;
    }
    throw error;
  }

  res.status(201).json({ id: turno.id, fechaHoraInicio: turno.fechaHoraInicio, servicio: servicio.nombre });
});

// =====================================================================
// Agenda del personal
// =====================================================================

export const turnosRouter = Router();
// Todo el personal ve la agenda; dar y mover turnos es de administración y recepción.
turnosRouter.use(requiereSesion, requiereRol(...PERSONAL), requierePermiso("turnos.ver"));

const incluirDetalle = {
  mascota: { include: { cliente: { select: { id: true, nombre: true, apellido: true, telefono: true } } } },
  servicio: { select: { id: true, nombre: true, duracionMin: true, categoria: true } },
  veterinario: { select: { id: true, nombre: true, apellido: true } },
  consulta: { select: { id: true } },
};

// Turnos entre dos días (inclusive), en hora argentina.
turnosRouter.get("/", async (req, res) => {
  const desde = esFechaValida(req.query.desde) ? req.query.desde : hoy();
  const hasta = esFechaValida(req.query.hasta) ? req.query.hasta : desde;
  const turnos = await prisma.turno.findMany({
    where: {
      clinicaId: req.usuario!.clinicaId,
      fechaHoraInicio: { gte: aFechaUTC(desde, "00:00"), lt: aFechaUTC(sumarDias(hasta, 1), "00:00") },
    },
    include: incluirDetalle,
    orderBy: { fechaHoraInicio: "asc" },
  });
  res.json(turnos);
});

// Días en que la clínica no atiende (para marcarlos en la agenda).
turnosRouter.get("/dias-cerrados", async (req, res) => {
  const desde = esFechaValida(req.query.desde) ? req.query.desde : hoy();
  const hasta = esFechaValida(req.query.hasta) ? req.query.hasta : desde;
  const dias = await prisma.diaBloqueado.findMany({
    where: {
      clinicaId: req.usuario!.clinicaId,
      fecha: { gte: new Date(`${desde}T00:00:00.000Z`), lte: new Date(`${hasta}T00:00:00.000Z`) },
    },
    orderBy: { fecha: "asc" },
  });
  res.json(dias.map((d) => ({ fecha: d.fecha.toISOString().slice(0, 10), motivo: d.motivo })));
});

// Horarios libres de un día para un servicio (el personal puede dar turnos para el mismo día).
turnosRouter.get("/disponibilidad", async (req, res) => {
  const servicioId = Number(req.query.servicioId);
  const dia = esFechaValida(req.query.fecha) ? req.query.fecha : hoy();
  // Al mover un turno, su propio horario cuenta como libre.
  const ignorarTurnoId = Number(req.query.ignorar) || undefined;
  const libres = await horariosLibres(req.usuario!.clinicaId, servicioId, dia, 1, { ignorarTurnoId });
  res.json(libres[dia] ?? []);
});

const esquemaTurnoPersonal = z.object({
  mascotaId: z.number().int(),
  servicioId: z.number().int(),
  fecha,
  hora,
  origen: z.enum(["TELEFONO", "MOSTRADOR"]),
  veterinarioId: z.number().int().nullable().optional(),
  observaciones: z.string().trim().max(500).optional(),
  sobreturno: z.boolean().optional(),
  // Urgencia: se agrega aunque no haya lugar (ni sea día de atención) y va primero en Hoy.
  urgente: z.boolean().optional(),
});

turnosRouter.post("/", requierePermiso("turnos.dar"), async (req, res) => {
  const resultado = esquemaTurnoPersonal.safeParse(req.body);
  if (!resultado.success) return responderError(res, resultado.error);
  const datos = resultado.data;
  const clinicaId = req.usuario!.clinicaId;

  const [mascota, servicio] = await Promise.all([
    prisma.mascota.findFirst({ where: { id: datos.mascotaId, activo: true, cliente: { clinicaId } } }),
    prisma.servicio.findFirst({ where: { id: datos.servicioId, clinicaId, activo: true } }),
  ]);
  if (!mascota || !servicio) {
    res.status(400).json({ error: "Elegí una mascota y un servicio válidos" });
    return;
  }

  const inicio = aFechaUTC(datos.fecha, datos.hora);
  let turno;
  try {
    turno = await prisma.$transaction(async (tx) => {
      // Igual que en la web: una reserva por vez, así dos personas no se quedan con el mismo horario.
      await bloquearAgenda(tx, clinicaId);
      if (!datos.urgente) {
        const problema = await validarHorario(clinicaId, servicio.id, datos.fecha, datos.hora, {
          sobreturno: datos.sobreturno,
        });
        if (problema) throw new ProblemaReserva(problema);
      }

      return tx.turno.create({
        data: {
          clinicaId,
          mascotaId: mascota.id,
          servicioId: servicio.id,
          veterinarioId: datos.veterinarioId ?? null,
          fechaHoraInicio: inicio,
          fechaHoraFin: new Date(inicio.getTime() + servicio.duracionMin * 60 * 1000),
          // Si lo carga el personal, el cliente ya está avisado: queda confirmado.
          estado: "CONFIRMADO",
          origen: datos.origen,
          observaciones: datos.observaciones || null,
          urgente: datos.urgente ?? false,
        },
        include: incluirDetalle,
      });
    }, opcionesReserva);
  } catch (error) {
    if (error instanceof ProblemaReserva) {
      res.status(error.estado).json({ error: error.message });
      return;
    }
    throw error;
  }
  res.status(201).json(turno);
});

// Cambiar el estado con un toque: confirmado, atendido, ausente o cancelado.
turnosRouter.patch("/:id/estado", requierePermiso("turnos.estado"), async (req, res) => {
  const resultado = z
    .object({ estado: z.enum(["PENDIENTE", "CONFIRMADO", "ATENDIDO", "AUSENTE", "CANCELADO"]) })
    .safeParse(req.body);
  if (!resultado.success) {
    res.status(400).json({ error: "Estado inválido" });
    return;
  }
  const id = Number(req.params.id);
  const turno = await prisma.turno.findFirst({ where: { id, clinicaId: req.usuario!.clinicaId } });
  if (!turno) {
    res.status(404).json({ error: "Turno no encontrado" });
    return;
  }
  const actualizado = await prisma.turno.update({
    where: { id },
    data: {
      estado: resultado.data.estado,
      // Se guarda quién canceló: la regla de abuso solo cuenta las cancelaciones del dueño por la web.
      ...(resultado.data.estado === "CANCELADO"
        ? turno.estado === "CANCELADO"
          ? {}
          : { canceladoEn: new Date(), canceladoPor: "CLINICA" as const }
        : { canceladoEn: null, canceladoPor: null }),
      // Quien marca "atendido" queda como el veterinario del turno, si no tenía uno.
      ...(resultado.data.estado === "ATENDIDO" && !turno.veterinarioId && req.usuario!.rol === "VETERINARIO"
        ? { veterinarioId: req.usuario!.id }
        : {}),
    },
    include: incluirDetalle,
  });
  if (resultado.data.estado === "CANCELADO" && turno.estado !== "CANCELADO") {
    await registrarCambio(req, {
      accion: "turno.cancelar",
      entidad: "turno",
      entidadId: id,
      resumen: `Canceló el turno de ${actualizado.mascota.nombre} del ${diaYHora(turno.fechaHoraInicio)}`,
    });
  }
  res.json(actualizado);
});

function diaYHora(fecha: Date) {
  const [a, m, d] = diaArgentina(fecha).split("-");
  return `${d}/${m}/${a} a las ${horaArgentina(fecha)}`;
}

// "Llegó": recepción marca que el cliente ya está en la sala de espera (se puede deshacer).
turnosRouter.patch("/:id/llego", requierePermiso("turnos.estado"), async (req, res) => {
  const resultado = z.object({ llego: z.boolean() }).safeParse(req.body);
  if (!resultado.success) {
    res.status(400).json({ error: "Dato inválido" });
    return;
  }
  const id = Number(req.params.id);
  const turno = await prisma.turno.findFirst({ where: { id, clinicaId: req.usuario!.clinicaId } });
  if (!turno) {
    res.status(404).json({ error: "Turno no encontrado" });
    return;
  }
  if (turno.estado === "CANCELADO") {
    res.status(409).json({ error: "Ese turno está cancelado" });
    return;
  }
  const actualizado = await prisma.turno.update({
    where: { id },
    data: {
      llegoEn: resultado.data.llego ? (turno.llegoEn ?? new Date()) : null,
      ...(resultado.data.llego ? {} : { enConsultaEn: null }),
      // Si estaba marcado como ausente por error, al llegar vuelve a confirmado.
      ...(resultado.data.llego && turno.estado === "AUSENTE" ? { estado: "CONFIRMADO" as const } : {}),
    },
    include: incluirDetalle,
  });
  res.json(actualizado);
});

// "En consulta": la veterinaria lo hizo pasar (se marca solo al tocar "Atender"). Con la sala de espera
// arman la pizarra del día en Hoy. Se puede deshacer ("Volvió a la sala").
turnosRouter.patch("/:id/en-consulta", requierePermiso("turnos.estado"), async (req, res) => {
  const resultado = z.object({ enConsulta: z.boolean() }).safeParse(req.body);
  if (!resultado.success) {
    res.status(400).json({ error: "Dato inválido" });
    return;
  }
  const id = Number(req.params.id);
  const turno = await prisma.turno.findFirst({ where: { id, clinicaId: req.usuario!.clinicaId } });
  if (!turno) {
    res.status(404).json({ error: "Turno no encontrado" });
    return;
  }
  if (turno.estado !== "CONFIRMADO" && turno.estado !== "PENDIENTE") {
    res.status(409).json({ error: "Ese turno ya no está por atender" });
    return;
  }
  const ahora = new Date();
  const actualizado = await prisma.turno.update({
    where: { id },
    data: resultado.data.enConsulta
      ? { enConsultaEn: turno.enConsultaEn ?? ahora, llegoEn: turno.llegoEn ?? ahora, estado: "CONFIRMADO" }
      : { enConsultaEn: null },
    include: incluirDetalle,
  });
  res.json(actualizado);
});

// Cambiar el día o la hora sin cancelar el turno (el historial y el origen se conservan).
const esquemaMover = z.object({ fecha, hora, sobreturno: z.boolean().optional() });

turnosRouter.patch("/:id/mover", requierePermiso("turnos.dar"), async (req, res) => {
  const resultado = esquemaMover.safeParse(req.body);
  if (!resultado.success) return responderError(res, resultado.error);
  const datos = resultado.data;
  const id = Number(req.params.id);
  const clinicaId = req.usuario!.clinicaId;
  const turno = await prisma.turno.findFirst({ where: { id, clinicaId }, include: { servicio: true } });
  if (!turno) {
    res.status(404).json({ error: "Turno no encontrado" });
    return;
  }
  if (!["PENDIENTE", "CONFIRMADO"].includes(turno.estado)) {
    res.status(409).json({ error: "Solo se pueden mover turnos que todavía no pasaron" });
    return;
  }
  const inicio = aFechaUTC(datos.fecha, datos.hora);
  if (inicio < new Date()) {
    res.status(400).json({ error: "Elegí un día y una hora que no hayan pasado" });
    return;
  }
  let movido;
  try {
    movido = await prisma.$transaction(async (tx) => {
      await bloquearAgenda(tx, clinicaId);
      const problema = await validarHorario(clinicaId, turno.servicioId, datos.fecha, datos.hora, {
        sobreturno: datos.sobreturno,
        ignorarTurnoId: id,
      });
      if (problema) throw new ProblemaReserva(problema);
      const nuevo = await tx.turno.update({
        where: { id },
        data: {
          fechaHoraInicio: inicio,
          fechaHoraFin: new Date(inicio.getTime() + turno.servicio.duracionMin * 60 * 1000),
          // Si ya se le había mandado el recordatorio, se le vuelve a mandar con la fecha nueva.
          recordatorioEnviadoEn: null,
          llegoEn: null,
          enConsultaEn: null,
        },
        include: incluirDetalle,
      });
      await registrarCambio(
        req,
        {
          accion: "turno.mover",
          entidad: "turno",
          entidadId: id,
          resumen: `Movió el turno de ${nuevo.mascota.nombre}: del ${diaYHora(turno.fechaHoraInicio)} al ${diaYHora(inicio)}`,
          antes: { fechaHoraInicio: turno.fechaHoraInicio },
          despues: { fechaHoraInicio: inicio },
        },
        tx,
      );
      return nuevo;
    }, opcionesReserva);
  } catch (error) {
    if (error instanceof ProblemaReserva) {
      res.status(error.estado).json({ error: error.message });
      return;
    }
    throw error;
  }
  res.json(movido);
});
