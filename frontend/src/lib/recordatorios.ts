import { diaDe, diaLargo, horaDe } from './fechas'
import { esLimpiezaDental } from './sitio'
import type { Pendientes } from '../types'

// Mensajes de WhatsApp de los recordatorios. Cortos, cordiales y con lo necesario para actuar.

type TurnoManana = Pendientes['turnosManana'][number]
type Dosis = Pendientes['dosis'][number]
type Recupero = Pendientes['recuperar'][number]

// Dirección para pedir turno online (en producción, el dominio de la clínica).
function enlaceTurno() {
  return `${window.location.origin}/turno`
}

function queLeToca(d: Pick<Dosis, 'tipo' | 'producto'>) {
  return d.tipo === 'VACUNA' ? `la vacuna ${d.producto.toLowerCase()}` : d.producto.toLowerCase()
}

export function mensajeTurnoManana(t: TurnoManana, clinica: string) {
  // Lo que más se olvida con la anestesia es el ayuno: va en el mismo mensaje del día anterior.
  const pagina = esLimpiezaDental(t.servicio) ? 'limpieza-dental' : 'cirugias'
  const preparacion =
    t.servicio.categoria === 'CIRUGIA'
      ? `Importante: tiene que venir en ayunas, con 8 a 12 horas sin comer. Todas las recomendaciones: ${window.location.origin}/${pagina} . `
      : ''
  return (
    `Hola ${t.mascota.cliente.nombre}, te recordamos el turno de ${t.mascota.nombre} (${t.servicio.nombre}) ` +
    `mañana ${diaLargo(diaDe(t.fechaHoraInicio))} a las ${horaDe(t.fechaHoraInicio)} en ${clinica}. ` +
    preparacion +
    'Si no podés venir, avisanos. ¡Gracias!'
  )
}

export function mensajeDosis(d: Dosis, clinica: string, hoy: string) {
  const fecha = d.fechaProximaDosis!.slice(0, 10)
  const saludo = `Hola ${d.mascota.cliente.nombre}, te escribimos de ${clinica}.`
  if (fecha < hoy) {
    return (
      `${saludo} A ${d.mascota.nombre} se le pasó la fecha de ${queLeToca(d)} (era el ${diaLargo(fecha)}). ` +
      `¿Le reservamos un turno? Podés pedirlo acá: ${enlaceTurno()} o respondiendo este mensaje.`
    )
  }
  return (
    `${saludo} A ${d.mascota.nombre} le toca ${queLeToca(d)} el ${diaLargo(fecha)}. ` +
    `Podés pedir turno acá: ${enlaceTurno()} o respondiendo este mensaje.`
  )
}

export function mensajeRecupero(r: Recupero, clinica: string) {
  const vencidas = r.vencidas.length > 0 ? ` Además, tiene pendiente: ${r.vencidas.join(', ').toLowerCase()}.` : ''
  return (
    `Hola ${r.mascota.cliente.nombre}, te escribimos de ${clinica}. ` +
    `Hace un tiempo que no vemos a ${r.mascota.nombre} y queremos saber cómo está.${vencidas} ` +
    `¿Te reservamos un turno para un control? Podés pedirlo acá: ${enlaceTurno()}`
  )
}

// Avisa al menú del panel que cambió la cantidad de recordatorios pendientes.
export function avisarCambioRecordatorios() {
  window.dispatchEvent(new Event('recordatorios-actualizados'))
}
