import { Router, type Response } from "express";
import { z } from "zod";
import {
  aFechaUTC,
  diaArgentina,
  esFechaValida,
  horariosLibres,
  sumarDias,
  validarHorario,
} from "../lib/agenda";
import { requiereRol, requiereSesion } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { normalizarTelefono } from "../lib/telefono";

const CLINICA_ID = 1;
const DIAS_A_MOSTRAR = 14;
const ANTICIPACION_ONLINE_MINUTOS = 60; // online no se puede pedir un turno para dentro de menos de 1 hora

const fecha = z.string().refine(esFechaValida, "Fecha inválida");
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida");

function hoy() {
  return diaArgentina(new Date());
}

function responderError(res: Response, error: z.ZodError) {
  res.status(400).json({ error: error.issues[0].message });
}

// =====================================================================
// Turnos online (sin cuenta)
// =====================================================================

export const turnosPublicoRouter = Router();

// Servicios que se pueden reservar online.
turnosPublicoRouter.get("/servicios", async (_req, res) => {
  const servicios = await prisma.servicio.findMany({
    where: { clinicaId: CLINICA_ID, activo: true, reservableOnline: true },
    orderBy: [{ categoria: "asc" }, { nombre: "asc" }],
  });
  res.json(servicios);
});

// Horarios libres de los próximos días para un servicio.
turnosPublicoRouter.get("/disponibilidad", async (req, res) => {
  const servicioId = Number(req.query.servicioId);
  const servicio = await prisma.servicio.findFirst({
    where: { id: servicioId, clinicaId: CLINICA_ID, activo: true, reservableOnline: true },
  });
  if (!servicio) {
    res.status(404).json({ error: "Ese servicio no se puede reservar online" });
    return;
  }
  const libres = await horariosLibres(CLINICA_ID, servicioId, hoy(), DIAS_A_MOSTRAR, {
    anticipacionMinutos: ANTICIPACION_ONLINE_MINUTOS,
  });
  res.json(libres);
});

const esquemaTurnoOnline = z.object({
  servicioId: z.number().int(),
  fecha,
  hora,
  nombre: z.string().trim().min(2, "Escribí tu nombre"),
  telefono: z.string().trim().min(8, "Escribí un teléfono válido"),
  mascota: z.object({
    nombre: z.string().trim().min(1, "Escribí el nombre de tu mascota"),
    especie: z.enum(["PERRO", "GATO", "OTRO"]),
  }),
  motivo: z.string().trim().max(500).optional(),
});

turnosPublicoRouter.post("/", async (req, res) => {
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

  // Se vuelve a verificar el horario: alguien pudo haberlo tomado mientras se completaba el formulario.
  const problema = await validarHorario(CLINICA_ID, servicio.id, datos.fecha, datos.hora, {
    anticipacionMinutos: ANTICIPACION_ONLINE_MINUTOS,
  });
  if (problema) {
    res.status(409).json({ error: problema });
    return;
  }

  // Regla de negocio 5: si ya es cliente (mismo teléfono) se reutiliza; si no, se crea con su mascota.
  const telefono = normalizarTelefono(datos.telefono);
  const [nombre, ...resto] = datos.nombre.split(" ");
  const turno = await prisma.$transaction(async (tx) => {
    const cliente =
      (await tx.cliente.findFirst({ where: { clinicaId: CLINICA_ID, telefono }, include: { mascotas: true } })) ??
      (await tx.cliente.create({
        data: { clinicaId: CLINICA_ID, nombre, apellido: resto.join(" ") || "-", telefono },
        include: { mascotas: true },
      }));

    const mascotaExistente = cliente.mascotas.find(
      (m) => m.activo && m.nombre.trim().toLowerCase() === datos.mascota.nombre.toLowerCase(),
    );
    const mascota =
      mascotaExistente ??
      (await tx.mascota.create({
        data: { clienteId: cliente.id, nombre: datos.mascota.nombre, especie: datos.mascota.especie, sexo: "MACHO" },
      }));

    const inicio = aFechaUTC(datos.fecha, datos.hora);
    return tx.turno.create({
      data: {
        clinicaId: CLINICA_ID,
        mascotaId: mascota.id,
        servicioId: servicio.id,
        fechaHoraInicio: inicio,
        fechaHoraFin: new Date(inicio.getTime() + servicio.duracionMin * 60 * 1000),
        estado: "PENDIENTE",
        origen: "ONLINE",
        observaciones: datos.motivo || null,
      },
    });
  });

  res.status(201).json({ id: turno.id, fechaHoraInicio: turno.fechaHoraInicio, servicio: servicio.nombre });
});

// =====================================================================
// Agenda del personal
// =====================================================================

export const turnosRouter = Router();
turnosRouter.use(requiereSesion, requiereRol("VETERINARIO", "ADMIN"));

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
  const libres = await horariosLibres(req.usuario!.clinicaId, servicioId, dia, 1);
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
});

turnosRouter.post("/", async (req, res) => {
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

  const problema = await validarHorario(clinicaId, servicio.id, datos.fecha, datos.hora, {
    sobreturno: datos.sobreturno,
  });
  if (problema) {
    res.status(409).json({ error: problema });
    return;
  }

  const inicio = aFechaUTC(datos.fecha, datos.hora);
  const turno = await prisma.turno.create({
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
    },
    include: incluirDetalle,
  });
  res.status(201).json(turno);
});

// Cambiar el estado con un toque: confirmado, atendido, ausente o cancelado.
turnosRouter.patch("/:id/estado", async (req, res) => {
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
      // Quien marca "atendido" queda como el veterinario del turno, si no tenía uno.
      ...(resultado.data.estado === "ATENDIDO" && !turno.veterinarioId && req.usuario!.rol === "VETERINARIO"
        ? { veterinarioId: req.usuario!.id }
        : {}),
    },
    include: incluirDetalle,
  });
  res.json(actualizado);
});
