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

publicoRouter.get("/preguntas-frecuentes", async (_req, res) => {
  const preguntas = await prisma.preguntaFrecuente.findMany({
    where: { clinicaId: CLINICA_ID },
    orderBy: { orden: "asc" },
  });
  res.json(preguntas);
});
