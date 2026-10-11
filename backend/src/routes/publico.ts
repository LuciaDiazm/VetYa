import { Router } from "express";
import { prisma } from "../lib/prisma";

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
    orderBy: [{ categoria: "asc" }, { nombre: "asc" }],
  });
  res.json(servicios);
});

// Todo lo que necesita la página de inicio en una sola consulta.
publicoRouter.get("/sitio", async (_req, res) => {
  const hoy = new Date();
  const [clinica, servicios, equipo, opiniones, formasPago, planes, promociones, preguntas] = await Promise.all([
    prisma.clinica.findUnique({
      where: { id: CLINICA_ID },
      include: { horarios: { orderBy: [{ diaSemana: "asc" }, { horaInicio: "asc" }] } },
    }),
    prisma.servicio.findMany({
      where: { clinicaId: CLINICA_ID, activo: true },
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

publicoRouter.get("/preguntas-frecuentes", async (_req, res) => {
  const preguntas = await prisma.preguntaFrecuente.findMany({
    where: { clinicaId: CLINICA_ID },
    orderBy: { orden: "asc" },
  });
  res.json(preguntas);
});
