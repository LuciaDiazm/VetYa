import { diaDe, diaLargo, horaDe } from './fechas'
import type { EstadoTurno, HorarioAtencion, Turno } from '../types'

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


const aMinutos = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5))
const aHora = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

export interface Hueco {
  inicio: string
  fin: string
}

const HUECO_MINIMO = 15 // minutos: menos que eso no alcanza para un turno

// Ratos libres de un día dentro del horario de atención, para dar turnos por teléfono sin buscar.
// "desde" (hora actual) recorta lo que ya pasó cuando el día es hoy.
export function huecosLibres(horarios: HorarioAtencion[], turnos: Turno[], dia: string, desde?: string): Hueco[] {
  const diaSemana = new Date(`${dia}T12:00:00Z`).getUTCDay()
  const ocupados = turnos
    .filter((t) => t.estado !== 'CANCELADO')
    .map((t) => ({ inicio: aMinutos(horaDe(t.fechaHoraInicio)), fin: aMinutos(horaDe(t.fechaHoraFin)) }))
    .sort((a, b) => a.inicio - b.inicio)
  // Se redondea para arriba al cuarto de hora (los turnos empiezan cada 15 minutos).
  const minimo = desde ? Math.ceil(aMinutos(desde) / 15) * 15 : 0
  const huecos: Hueco[] = []

  for (const franja of horarios.filter((h) => h.diaSemana === diaSemana)) {
    const finFranja = aMinutos(franja.horaFin)
    let cursor = aMinutos(franja.horaInicio)
    const agregar = (inicio: number, fin: number) => {
      const desdeReal = Math.max(inicio, minimo)
      if (fin - desdeReal >= HUECO_MINIMO) huecos.push({ inicio: aHora(desdeReal), fin: aHora(fin) })
    }
    for (const o of ocupados) {
      if (o.fin <= cursor || o.inicio >= finFranja) continue
      if (o.inicio > cursor) agregar(cursor, o.inicio)
      cursor = Math.max(cursor, o.fin)
    }
    if (cursor < finFranja) agregar(cursor, finFranja)
  }
  return huecos.sort((a, b) => a.inicio.localeCompare(b.inicio))
}
