import { Router } from "express";
import { diaArgentina } from "../lib/agenda";
import { datosDelCarnet, escribirCarnet } from "../lib/carnet";
import { prisma } from "../lib/prisma";
import { escribirRecomendaciones, recomendacionesDe } from "../lib/recomendaciones";

// Rutas públicas: las usa la web sin iniciar sesión.
export const publicoRouter = Router();

// Por ahora el sistema atiende a una sola clínica.
const CLINICA_ID = 1;

publicoRouter.get("/clinica", async (_req, res) => {
  const clinica = await prisma.clinica.findUnique({
    where: { id: CLINICA_ID },
    include: { horarios: { orderBy: [{ diaSemana: "asc" }, { horaInicio: "asc" }] } },
  });
  if (!clinica) {
    res.status(404).json({ error: "Clínica no encontrada" });
    return;
  }
  res.json(clinica);
});

publicoRouter.get("/servicios", async (_req, res) => {
  const servicios = await prisma.servicio.findMany({
    where: { clinicaId: CLINICA_ID, activo: true },
    omit: { precioReferencia: true }, // el precio se ve solo en el panel, nunca en la web
    orderBy: [{ categoria: "asc" }, { nombre: "asc" }],
  });
  res.json(servicios);
});

// Todo lo que necesita la página de inicio en una sola consulta.
publicoRouter.get("/sitio", async (_req, res) => {
  // Día de hoy en Argentina, a la medianoche UTC (igual que se guardan las fechas sin hora).
  const hoy = new Date(`${diaArgentina(new Date())}T00:00:00.000Z`);
  const [clinica, servicios, equipo, opiniones, formasPago, planes, promociones, preguntas] = await Promise.all([
    prisma.clinica.findUnique({
      where: { id: CLINICA_ID },
      include: { horarios: { orderBy: [{ diaSemana: "asc" }, { horaInicio: "asc" }] } },
    }),
    prisma.servicio.findMany({
      where: { clinicaId: CLINICA_ID, activo: true },
      omit: { precioReferencia: true },
      orderBy: [{ categoria: "asc" }, { nombre: "asc" }],
    }),
    prisma.usuario.findMany({
      where: { clinicaId: CLINICA_ID, activo: true, visibleEnWeb: true },
      select: { id: true, nombre: true, apellido: true, matricula: true, especialidad: true, presentacion: true, fotoUrl: true },
      orderBy: { apellido: "asc" },
    }),
    prisma.opinion.findMany({
      where: { clinicaId: CLINICA_ID, visible: true },
      orderBy: { fecha: "desc" },
      take: 6,
    }),
    prisma.formaPago.findMany({ where: { clinicaId: CLINICA_ID }, orderBy: { orden: "asc" } }),
    prisma.planSanitario.findMany({
      where: { clinicaId: CLINICA_ID, activo: true },
      include: { dosis: { orderBy: { edadSemanas: "asc" } } },
    }),
    prisma.promocion.findMany({
      where: { clinicaId: CLINICA_ID, vigenteDesde: { lte: hoy }, vigenteHasta: { gte: hoy } },
      orderBy: { vigenteHasta: "asc" },
    }),
    prisma.preguntaFrecuente.findMany({ where: { clinicaId: CLINICA_ID }, orderBy: { orden: "asc" } }),
  ]);

  if (!clinica) {
    res.status(404).json({ error: "Clínica no encontrada" });
    return;
  }
  res.json({ clinica, servicios, equipo, opiniones, formasPago, planes, promociones, preguntas });
});

// Carnet de vacunación en PDF. Se accede con un enlace privado (imposible de adivinar),
// así el dueño lo puede abrir desde WhatsApp sin tener cuenta.
publicoRouter.get("/carnet/:token", async (req, res) => {
  const mascota = await datosDelCarnet(req.params.token);
  if (!mascota) {
    res.status(404).json({ error: "Carnet no encontrado" });
    return;
  }
  const archivo = `carnet-${mascota.nombre.normalize("NFD").replace(/[^\w-]/g, "").toLowerCase() || "mascota"}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${archivo}"`);
  res.setHeader("Cache-Control", "no-store");
  escribirCarnet(mascota, res);
});

// Cirugías con sus recomendaciones para antes y después.
publicoRouter.get("/cirugias", async (_req, res) => {
  const cirugias = await prisma.servicio.findMany({
    where: { clinicaId: CLINICA_ID, activo: true, categoria: "CIRUGIA" },
    omit: { precioReferencia: true },
    orderBy: { nombre: "asc" },
  });
  res.json(cirugias.map((s) => ({ ...s, ...recomendacionesDe(s.nombre) })));
});

publicoRouter.get("/cirugias/:id/recomendaciones.pdf", async (req, res) => {
  const id = Number(req.params.id);
  const [servicio, clinica] = await Promise.all([
    Number.isInteger(id)
      ? prisma.servicio.findFirst({ where: { id, clinicaId: CLINICA_ID, activo: true, categoria: "CIRUGIA" } })
      : null,
    prisma.clinica.findUnique({ where: { id: CLINICA_ID } }),
  ]);
  if (!servicio || !clinica) {
    res.status(404).json({ error: "Cirugía no encontrada" });
    return;
  }
  const slug = servicio.nombre.split(/[ /]/)[0].normalize("NFD").replace(/[^\w-]/g, "").toLowerCase();
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="recomendaciones-${slug}.pdf"`);
  escribirRecomendaciones(servicio.nombre, clinica, res);
});

publicoRouter.get("/preguntas-frecuentes", async (_req, res) => {
  const preguntas = await prisma.preguntaFrecuente.findMany({
    where: { clinicaId: CLINICA_ID },
    orderBy: { orden: "asc" },
  });
  res.json(preguntas);
});
