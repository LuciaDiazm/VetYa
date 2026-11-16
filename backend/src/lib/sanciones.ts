import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

// =====================================================================
// Turnos sin choques y regla contra el abuso de turnos por la web
// =====================================================================

const DIA_MS = 24 * 3600 * 1000;

/**
 * Bloquea la agenda de la clínica hasta que termine la transacción.
 * Si dos personas piden el mismo horario al mismo tiempo, la segunda espera a que la primera
 * termine y recién ahí se verifica el horario: el que llegó primero (aunque sea por milisegundos) se lo queda.
 */
export async function bloquearAgenda(tx: Prisma.TransactionClient, clinicaId: number) {
  await tx.$queryRaw`SELECT id_clinica FROM clinica WHERE id_clinica = ${clinicaId} FOR UPDATE`;
}

/** Opciones de la transacción que reserva un turno: puede tener que esperar a otra reserva. */
export const opcionesReserva = { maxWait: 10_000, timeout: 15_000 };

/** Fecha hasta la que el cliente no puede sacar turnos por la web, o null si puede. */
export function suspensionVigente(cliente: { suspendidoHasta: Date | null }) {
  return cliente.suspendidoHasta && cliente.suspendidoHasta.getTime() > Date.now() ? cliente.suspendidoHasta : null;
}

/** Cuántos turnos canceló el dueño desde la web en los últimos `dias` días. */
export function cancelacionesWebRecientes(clienteId: number, dias: number) {
  return prisma.turno.count({
    where: {
      mascota: { clienteId },
      canceladoPor: "DUENIO",
      canceladoEn: { gte: new Date(Date.now() - dias * DIA_MS) },
    },
  });
}

/** Turnos futuros pedidos por la web que el cliente todavía tiene activos. */
export function turnosWebActivos(clienteId: number, tx: Prisma.TransactionClient = prisma) {
  return tx.turno.count({
    where: {
      mascota: { clienteId },
      origen: "ONLINE",
      estado: { in: ["PENDIENTE", "CONFIRMADO"] },
      fechaHoraInicio: { gte: new Date() },
    },
  });
}

/**
 * Después de que el dueño cancela: si llegó al límite de cancelaciones en el período,
 * queda suspendido para sacar turnos por la web y la clínica ve un aviso en "Hoy".
 * Devuelve la fecha de fin de la suspensión si se aplicó.
 */
export async function revisarAbuso(clienteId: number, clinicaId: number) {
  const [cliente, clinica] = await Promise.all([
    prisma.cliente.findUnique({ where: { id: clienteId }, select: { suspendidoHasta: true } }),
    prisma.clinica.findUnique({
      where: { id: clinicaId },
      select: { limiteCancelaciones: true, diasCancelaciones: true, diasSuspension: true },
    }),
  ]);
  if (!cliente || !clinica || clinica.limiteCancelaciones <= 0 || suspensionVigente(cliente)) return null;

  const cantidad = await cancelacionesWebRecientes(clienteId, clinica.diasCancelaciones);
  if (cantidad < clinica.limiteCancelaciones) return null;

  const hasta = new Date(Date.now() + clinica.diasSuspension * DIA_MS);
  await prisma.cliente.update({
    where: { id: clienteId },
    data: {
      suspendidoHasta: hasta,
      suspensionMotivo: `Canceló ${cantidad} turnos por la web en ${clinica.diasCancelaciones} días`,
      suspensionRevisada: false,
    },
  });
  return hasta;
}
