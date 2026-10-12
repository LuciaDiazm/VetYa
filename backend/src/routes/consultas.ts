import { Router } from "express";
import { z } from "zod";
import { diaArgentina } from "../lib/agenda";
import { requiereRol, requiereSesion } from "../lib/auth";
import { prisma } from "../lib/prisma";

// Historia clínica: consultas y aplicaciones sanitarias (vacunas y desparasitaciones).
export const consultasRouter = Router();
consultasRouter.use(requiereSesion, requiereRol("VETERINARIO", "ADMIN"));

const textoOpcional = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((v) => (v ? v : null));

// Fecha "AAAA-MM-DD" (sin hora) o vacía.
const fechaOpcional = z
  .string()
  .optional()
  .transform((v) => (v ? new Date(`${v}T00:00:00.000Z`) : null))
  .refine((d) => !d || !Number.isNaN(d.getTime()), "Fecha inválida");

const esquemaAplicacion = z.object({
  tipo: z.enum(["VACUNA", "DESPARASITACION"]),
  producto: z.string().trim().min(1, "Escribí qué vacuna o desparasitario se aplicó"),
  lote: textoOpcional,
  fechaProximaDosis: fechaOpcional,
});

const numeroOpcional = (min: number, max: number, mensaje: string) =>
  z
    .number()
    .min(min, mensaje)
    .max(max, mensaje)
    .nullable()
    .optional()
    .transform((v) => v ?? null);

const esquemaConsulta = z.object({
  motivo: z.string().trim().min(1, "Escribí el motivo de la consulta"),
  pesoKg: numeroOpcional(0.05, 150, "El peso no parece correcto"),
  temperatura: numeroOpcional(30, 45, "La temperatura no parece correcta"),
  diagnostico: textoOpcional,
  tratamiento: textoOpcional,
  observaciones: textoOpcional,
});

const esquemaNuevaConsulta = esquemaConsulta.extend({
  mascotaId: z.number().int(),
  turnoId: z.number().int().optional(),
  aplicaciones: z.array(esquemaAplicacion).max(10).default([]),
});

consultasRouter.post("/", async (req, res) => {
  const resultado = esquemaNuevaConsulta.safeParse(req.body);
  if (!resultado.success) {
    res.status(400).json({ error: resultado.error.issues[0].message });
    return;
  }
  const { mascotaId, turnoId, aplicaciones, ...datos } = resultado.data;
  const clinicaId = req.usuario!.clinicaId;

  const mascota = await prisma.mascota.findFirst({ where: { id: mascotaId, cliente: { clinicaId } } });
  if (!mascota) {
    res.status(404).json({ error: "Mascota no encontrada" });
    return;
  }

  // Si la consulta viene de un turno, tiene que ser de esta mascota y no tener ya una consulta.
  if (turnoId) {
    const turno = await prisma.turno.findFirst({
      where: { id: turnoId, clinicaId, mascotaId },
      include: { consulta: true },
    });
    if (!turno) {
      res.status(400).json({ error: "El turno no corresponde a esta mascota" });
      return;
    }
    if (turno.consulta) {
      res.status(409).json({ error: "Ese turno ya tiene una consulta cargada" });
      return;
    }
  }

  const ahora = new Date();
  // Día de hoy en Argentina (después de las 21 h, en UTC ya es el día siguiente).
  const hoySinHora = new Date(`${diaArgentina(ahora)}T00:00:00.000Z`);

  const consulta = await prisma.$transaction(async (tx) => {
    const creada = await tx.consulta.create({
      data: {
        ...datos,
        mascotaId,
        veterinarioId: req.usuario!.id,
        turnoId: turnoId ?? null,
        fecha: ahora,
        aplicaciones: {
          create: aplicaciones.map((a) => ({ ...a, mascotaId, fechaAplicacion: hoySinHora })),
        },
      },
      include: { aplicaciones: true },
    });
    // Cargar la consulta de un turno lo marca como atendido.
    if (turnoId) {
      await tx.turno.update({
        where: { id: turnoId },
        data: { estado: "ATENDIDO", veterinarioId: req.usuario!.id },
      });
    }
    return creada;
  });

  res.status(201).json(consulta);
});

consultasRouter.put("/:id", async (req, res) => {
  const resultado = esquemaConsulta.safeParse(req.body);
  if (!resultado.success) {
    res.status(400).json({ error: resultado.error.issues[0].message });
    return;
  }
  const id = Number(req.params.id);
  const consulta = await prisma.consulta.findFirst({
    where: { id, mascota: { cliente: { clinicaId: req.usuario!.clinicaId } } },
  });
  if (!consulta) {
    res.status(404).json({ error: "Consulta no encontrada" });
    return;
  }
  const actualizada = await prisma.consulta.update({ where: { id }, data: resultado.data });
  res.json(actualizada);
});

// ---------- Vacunas y desparasitaciones sueltas ----------
// Para registrar las que se aplicaron antes (por ejemplo, las que figuran en la libreta de papel).

const esquemaAplicacionSuelta = esquemaAplicacion.extend({
  mascotaId: z.number().int(),
  fechaAplicacion: z
    .string()
    .transform((v) => new Date(`${v}T00:00:00.000Z`))
    .refine(
      (d) => !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) <= diaArgentina(new Date()),
      "La fecha de aplicación no es válida",
    ),
});

consultasRouter.post("/aplicaciones", async (req, res) => {
  const resultado = esquemaAplicacionSuelta.safeParse(req.body);
  if (!resultado.success) {
    res.status(400).json({ error: resultado.error.issues[0].message });
    return;
  }
  const { mascotaId, ...datos } = resultado.data;
  const mascota = await prisma.mascota.findFirst({
    where: { id: mascotaId, cliente: { clinicaId: req.usuario!.clinicaId } },
  });
  if (!mascota) {
    res.status(404).json({ error: "Mascota no encontrada" });
    return;
  }
  if (datos.fechaProximaDosis && datos.fechaProximaDosis < datos.fechaAplicacion) {
    res.status(400).json({ error: "La próxima dosis tiene que ser después de la aplicación" });
    return;
  }
  const aplicacion = await prisma.aplicacionSanitaria.create({ data: { ...datos, mascotaId } });
  res.status(201).json(aplicacion);
});

consultasRouter.delete("/aplicaciones/:id", async (req, res) => {
  const id = Number(req.params.id);
  const aplicacion = await prisma.aplicacionSanitaria.findFirst({
    where: { id, mascota: { cliente: { clinicaId: req.usuario!.clinicaId } } },
  });
  if (!aplicacion) {
    res.status(404).json({ error: "Registro no encontrado" });
    return;
  }
  await prisma.aplicacionSanitaria.delete({ where: { id } });
  res.status(204).end();
});
