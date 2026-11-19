import { Router } from "express";
import { aFechaUTC, diaArgentina, esFechaValida, sumarDias } from "../lib/agenda";
import { requiereRol, requiereSesion } from "../lib/auth";
import { PERSONAL, requierePermiso } from "../lib/permisos";
import { prisma } from "../lib/prisma";

// Registro de cambios: quién corrigió, anuló, movió o desactivó algo y cuándo. Solo lo ve la administración.
// Nunca se borra ni se edita.
export const auditoriaRouter = Router();
auditoriaRouter.use(requiereSesion, requiereRol(...PERSONAL), requierePermiso("auditoria"));

const ENTIDADES = ["consulta", "aplicacion", "turno", "pago", "usuario", "mascota", "adjunto"];

auditoriaRouter.get("/", async (req, res) => {
  const hoy = diaArgentina(new Date());
  const hasta = esFechaValida(req.query.hasta) ? req.query.hasta : hoy;
  const desde = esFechaValida(req.query.desde) ? req.query.desde : sumarDias(hasta, -30);
  const entidad = typeof req.query.entidad === "string" && ENTIDADES.includes(req.query.entidad) ? req.query.entidad : undefined;
  const usuarioId = Number(req.query.usuarioId) || undefined;

  const cambios = await prisma.auditoria.findMany({
    where: {
      clinicaId: req.usuario!.clinicaId,
      fecha: { gte: aFechaUTC(desde, "00:00"), lt: aFechaUTC(sumarDias(hasta, 1), "00:00") },
      ...(entidad ? { entidad } : {}),
      ...(usuarioId ? { usuarioId } : {}),
    },
    orderBy: { fecha: "desc" },
    take: 500,
    include: { usuario: { select: { id: true, nombre: true, apellido: true, rol: true } } },
  });
  res.json({ desde, hasta, cambios });
});
