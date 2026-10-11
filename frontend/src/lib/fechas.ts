// Fechas y horas siempre en hora de Argentina, aunque la computadora tenga otra zona horaria.

export const ZONA = 'America/Argentina/Buenos_Aires'

// "AAAA-MM-DD" de hoy en Argentina.
export function hoyArgentina() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date())
}

export function sumarDias(fecha: string, dias: number) {
  const d = new Date(`${fecha}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

// Lunes de la semana de una fecha.
export function lunesDe(fecha: string) {
  const dia = new Date(`${fecha}T12:00:00Z`).getUTCDay() // 0 = domingo
  return sumarDias(fecha, dia === 0 ? -6 : 1 - dia)
}

const DIA_LARGO = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
const DIA_CORTO = new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
const HORA = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: ZONA })

// "2026-10-12" → "lunes 12 de octubre"
export function diaLargo(fecha: string) {
  return DIA_LARGO.format(new Date(`${fecha}T12:00:00Z`))
}

// "2026-10-12" → "lun 12 oct"
export function diaCorto(fecha: string) {
  return DIA_CORTO.format(new Date(`${fecha}T12:00:00Z`)).replace(/\./g, '').replace(',', '')
}

// Fecha y hora ISO → "09:30" en hora argentina
export function horaDe(iso: string) {
  return HORA.format(new Date(iso))
}

// Fecha y hora ISO → "AAAA-MM-DD" del día en Argentina
export function diaDe(iso: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date(iso))
}

export function esHoy(fecha: string) {
  return fecha === hoyArgentina()
}

// "Hoy", "Mañana" o "lunes 12 de octubre"
export function diaAmigable(fecha: string) {
  const hoy = hoyArgentina()
  if (fecha === hoy) return 'Hoy'
  if (fecha === sumarDias(hoy, 1)) return 'Mañana'
  return diaLargo(fecha)
}
