import { Router, type Response } from "express";
import { z } from "zod";
import { aFechaUTC, diaArgentina, esFechaValida, horaArgentina, sumarDias } from "../lib/agenda";
import { requiereRol, requiereSesion } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { normalizarTelefono } from "../lib/telefono";

// Configuración de la clínica: datos de contacto, horarios, días cerrados y servicios. Solo administradores.
export const configuracionRouter = Router();
configuracionRouter.use(requiereSesion, requiereRol("ADMIN"));

const MAX_DIAS_CERRADOS_SEGUIDOS = 60;

const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida");
const fecha = z.string().refine(esFechaValida, "Fecha inválida");
const textoOpcional = z
  .string()
  .trim()
  .max(200)
  .nullish()
  .transform((t) => t || null);

function responderError(res: Response, error: z.ZodError) {
  res.status(400).json({ error: error.issues[0].message });
}

function whatsappValido(numero: string) {
  return /^549\d{10}$/.test(normalizarTelefono(numero));
}

// Turnos activos (pendientes o confirmados) desde ahora, con lo necesario para avisarle al dueño.
function turnosActivos(clinicaId: number, desde: Date, hasta?: Date) {
  return prisma.turno.findMany({
    where: {
      clinicaId,
      estado: { in: ["PENDIENTE", "CONFIRMADO"] },
      fechaHoraInicio: { gte: desde, ...(hasta ? { lt: hasta } : {}) },
    },
    orderBy: { fechaHoraInicio: "asc" },
    select: {
      id: true,
      fechaHoraInicio: true,
      fechaHoraFin: true,
      servicio: { select: { nombre: true } },
      mascota: {
        select: { id: true, nombre: true, cliente: { select: { nombre: true, apellido: true, telefono: true } } },
      },
    },
  });
}

// =====================================================================
// Datos de la clínica
// =====================================================================

const esquemaClinica = z.object({
  nombre: z.string().trim().min(1, "Ingresá el nombre de la clínica").max(120),
  direccion: z.string().trim().min(1, "Ingresá la dirección").max(200),
  telefono: z.string().trim().min(6, "Ingresá el teléfono").max(40),
  whatsapp: z.string().trim().refine(whatsappValido, "El WhatsApp no es válido: escribí el código de área y el número"),
  email: z
    .union([z.email("Email inválido"), z.literal("")])
    .nullish()
    .transform((e) => e || null),
  instagram: textoOpcional.transform((i) => (i ? i.replace(/^@/, "") : null)),
  horasCancelacion: z.number().int().min(0, "Las horas no pueden ser negativas").max(168, "Como máximo, una semana"),
  telefonoUrgencias: z
    .string()
    .trim()
    .nullish()
    .refine((t) => !t || whatsappValido(t), "El teléfono de urgencias no es válido"),
  horarioUrgencias: textoOpcional,
});

configuracionRouter.get("/clinica", async (req, res) => {
  const clinica = await prisma.clinica.findUnique({ where: { id: req.usuario!.clinicaId } });
  res.json(clinica);
});

configuracionRouter.put("/clinica", async (req, res) => {
  const resultado = esquemaClinica.safeParse(req.body);
  if (!resultado.success) return responderError(res, resultado.error);
  const d = resultado.data;
  const clinica = await prisma.clinica.update({
    where: { id: req.usuario!.clinicaId },
    data: {
      ...d,
      whatsapp: normalizarTelefono(d.whatsapp),
      telefonoUrgencias: d.telefonoUrgencias ? normalizarTelefono(d.telefonoUrgencias) : null,
    },
  });
  res.json(clinica);
});

// =====================================================================
// Horarios de atención
// =====================================================================

const esquemaHorarios = z.object({
  horarios: z
    .array(z.object({ diaSemana: z.number().int().min(0).max(6), horaInicio: hora, horaFin: hora }))
    .max(21),
});

configuracionRouter.get("/horarios", async (req, res) => {
  const horarios = await prisma.horarioAtencion.findMany({
    where: { clinicaId: req.usuario!.clinicaId },
    orderBy: [{ diaSemana: "asc" }, { horaInicio: "asc" }],
  });
  res.json(horarios);
});

// Reemplaza todos los horarios. Devuelve los turnos ya dados que quedan fuera del nuevo horario,
// para que la clínica les avise (no se cancelan solos).
configuracionRouter.put("/horarios", async (req, res) => {
  const resultado = esquemaHorarios.safeParse(req.body);
  if (!resultado.success) return responderError(res, resultado.error);
  const horarios = [...resultado.data.horarios].sort(
    (a, b) => a.diaSemana - b.diaSemana || a.horaInicio.localeCompare(b.horaInicio),
  );

  for (let i = 0; i < horarios.length; i++) {
    const h = horarios[i];
    if (h.horaFin <= h.horaInicio) {
      res.status(400).json({ error: `El horario de ${h.horaInicio} a ${h.horaFin} termina antes de empezar` });
      return;
    }
    const anterior = horarios[i - 1];
    if (anterior && anterior.diaSemana === h.diaSemana && h.horaInicio < anterior.horaFin) {
      res.status(400).json({ error: "Hay dos horarios del mismo día que se superponen" });
      return;
    }
  }

  const clinicaId = req.usuario!.clinicaId;
  await prisma.$transaction([
    prisma.horarioAtencion.deleteMany({ where: { clinicaId } }),
    prisma.horarioAtencion.createMany({ data: horarios.map((h) => ({ ...h, clinicaId })) }),
  ]);

  const fuera = (await turnosActivos(clinicaId, new Date())).filter((t) => {
    const dia = new Date(`${diaArgentina(t.fechaHoraInicio)}T12:00:00Z`).getUTCDay();
    const inicio = horaArgentina(t.fechaHoraInicio);
    const fin = horaArgentina(t.fechaHoraFin);
    return !horarios.some((h) => h.diaSemana === dia && h.horaInicio <= inicio && fin <= h.horaFin);
  });
  res.json({ horarios, turnosFuera: fuera });
});

// =====================================================================
// Días cerrados (feriados, vacaciones, capacitaciones)
// =====================================================================

configuracionRouter.get("/dias-cerrados", async (req, res) => {
  const dias = await prisma.diaBloqueado.findMany({
    where: { clinicaId: req.usuario!.clinicaId, fecha: { gte: aFechaUTC(diaArgentina(new Date()), "00:00") } },
    orderBy: { fecha: "asc" },
  });
  res.json(dias);
});

const esquemaDiasCerrados = z.object({
  desde: fecha,
  hasta: fecha.optional(),
  motivo: textoOpcional,
});

// Cierra un día o varios seguidos (por ejemplo, vacaciones). Devuelve los turnos ya dados en esas fechas.
configuracionRouter.post("/dias-cerrados", async (req, res) => {
  const resultado = esquemaDiasCerrados.safeParse(req.body);
  if (!resultado.success) return responderError(res, resultado.error);
  const { desde, motivo } = resultado.data;
  const hasta = resultado.data.hasta ?? desde;
  const hoy = diaArgentina(new Date());

  if (desde < hoy) {
    res.status(400).json({ error: "No se puede cerrar un día que ya pasó" });
    return;
  }
  if (hasta < desde) {
    res.status(400).json({ error: "La fecha de fin es anterior a la de inicio" });
    return;
  }

  const fechas: string[] = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) fechas.push(f);
  if (fechas.length > MAX_DIAS_CERRADOS_SEGUIDOS) {
    res.status(400).json({ error: `Se pueden cerrar hasta ${MAX_DIAS_CERRADOS_SEGUIDOS} días seguidos` });
    return;
  }

  const clinicaId = req.usuario!.clinicaId;
  // Los días que ya estaban cerrados se saltean.
  await prisma.diaBloqueado.createMany({
    data: fechas.map((f) => ({ clinicaId, fecha: new Date(`${f}T00:00:00.000Z`), motivo })),
    skipDuplicates: true,
  });

  const turnos = await turnosActivos(clinicaId, aFechaUTC(desde, "00:00"), aFechaUTC(sumarDias(hasta, 1), "00:00"));
  res.status(201).json({ dias: fechas.length, turnosAfectados: turnos });
});

configuracionRouter.delete("/dias-cerrados/:id", async (req, res) => {
  const { count } = await prisma.diaBloqueado.deleteMany({
    where: { id: Number(req.params.id), clinicaId: req.usuario!.clinicaId },
  });
  if (count === 0) {
    res.status(404).json({ error: "Día no encontrado" });
    return;
  }
  res.json({ ok: true });
});

// =====================================================================
// Servicios
// =====================================================================

const esquemaServicio = z.object({
  nombre: z.string().trim().min(1, "Ingresá el nombre del servicio").max(120),
  categoria: z.enum(["CLINICA", "DIAGNOSTICO", "CIRUGIA", "ESTETICA"]),
  descripcion: z
    .string()
    .trim()
    .max(500)
    .nullish()
    .transform((t) => t || null),
  duracionMin: z
    .number()
    .int()
    .min(5, "La duración mínima es de 5 minutos")
    .max(480, "La duración máxima es de 8 horas")
    .refine((m) => m % 5 === 0, "La duración tiene que ser múltiplo de 5 minutos"),
  precioReferencia: z.number().min(0, "El precio no puede ser negativo").max(10_000_000).nullish(),
  reservableOnline: z.boolean(),
});

configuracionRouter.get("/servicios", async (req, res) => {
  const servicios = await prisma.servicio.findMany({
    where: { clinicaId: req.usuario!.clinicaId },
    orderBy: [{ activo: "desc" }, { categoria: "asc" }, { nombre: "asc" }],
  });
  res.json(servicios);
});

configuracionRouter.post("/servicios", async (req, res) => {
  const resultado = esquemaServicio.safeParse(req.body);
  if (!resultado.success) return responderError(res, resultado.error);
  const servicio = await prisma.servicio.create({ data: { ...resultado.data, clinicaId: req.usuario!.clinicaId } });
  res.status(201).json(servicio);
});

configuracionRouter.put("/servicios/:id", async (req, res) => {
  const resultado = esquemaServicio.safeParse(req.body);
  if (!resultado.success) return responderError(res, resultado.error);
  const id = Number(req.params.id);
  const existe = await prisma.servicio.findFirst({ where: { id, clinicaId: req.usuario!.clinicaId } });
  if (!existe) {
    res.status(404).json({ error: "Servicio no encontrado" });
    return;
  }
  // Cambiar la duración no modifica los turnos ya dados: solo los nuevos.
  res.json(await prisma.servicio.update({ where: { id }, data: resultado.data }));
});

// Los servicios no se borran (tienen turnos e historia): se dejan de ofrecer.
configuracionRouter.patch("/servicios/:id/activo", async (req, res) => {
  const resultado = z.object({ activo: z.boolean() }).safeParse(req.body);
  if (!resultado.success) return responderError(res, resultado.error);
  const id = Number(req.params.id);
  const existe = await prisma.servicio.findFirst({ where: { id, clinicaId: req.usuario!.clinicaId } });
  if (!existe) {
    res.status(404).json({ error: "Servicio no encontrado" });
    return;
  }
  res.json(await prisma.servicio.update({ where: { id }, data: { activo: resultado.data.activo } }));
});
