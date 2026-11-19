import type { Prisma } from "@prisma/client";
import type { Request } from "express";
import { prisma } from "./prisma";

type Cliente = Prisma.TransactionClient | typeof prisma;

// Deja anotado en el registro de cambios quién hizo qué. Solo agrega: nunca edita ni borra.
// Se puede llamar dentro de una transacción (pasando tx) para que quede junto con el cambio.
export async function registrarCambio(
  req: Request,
  datos: {
    accion: string;
    entidad: string;
    entidadId: number;
    resumen: string;
    antes?: unknown;
    despues?: unknown;
  },
  db: Cliente = prisma,
) {
  await db.auditoria.create({
    data: {
      clinicaId: req.usuario!.clinicaId,
      usuarioId: req.usuario!.id,
      accion: datos.accion,
      entidad: datos.entidad,
      entidadId: datos.entidadId,
      resumen: datos.resumen,
      antes: comoJson(datos.antes),
      despues: comoJson(datos.despues),
    },
  });
}

// Prisma guarda JSON: las fechas y los decimales se pasan a texto para que se lean igual que en pantalla.
function comoJson(valor: unknown): Prisma.InputJsonValue | undefined {
  if (valor === undefined || valor === null) return undefined;
  return JSON.parse(JSON.stringify(valor)) as Prisma.InputJsonValue;
}
