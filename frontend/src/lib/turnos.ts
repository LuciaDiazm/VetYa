import { diaDe, diaLargo, horaDe } from './fechas'
import type { EstadoTurno, Turno } from '../types'

export const ESTADOS_TURNO: Record<EstadoTurno, string> = {
  PENDIENTE: 'Pendiente',
  CONFIRMADO: 'Confirmado',
  ATENDIDO: 'Atendido',
  AUSENTE: 'No vino',
  CANCELADO: 'Cancelado',
}

// Mensaje de WhatsApp para confirmarle el turno al dueño.
export function mensajeConfirmacion(t: Turno, clinica: string) {
  const dia = diaDe(t.fechaHoraInicio)
  return (
    `Hola ${t.mascota.cliente.nombre}, te confirmamos el turno de ${t.mascota.nombre} ` +
    `(${t.servicio.nombre}) para el ${diaLargo(dia)} a las ${horaDe(t.fechaHoraInicio)} en ${clinica}. ` +
    'Si no podés venir, avisanos. ¡Gracias!'
  )
}

