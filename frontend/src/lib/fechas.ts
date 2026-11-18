// Fechas y horas siempre en hora de Argentina, aunque la computadora tenga otra zona horaria.

export const ZONA = 'America/Argentina/Buenos_Aires'

// "AAAA-MM-DD" de hoy en Argentina.
export function hoyArgentina() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date())
}

// Día de la semana de hoy en Argentina (0 = domingo)
export function diaSemanaHoy() {
  return new Date(`${hoyArgentina()}T12:00:00Z`).getUTCDay()
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

// "2026-10-12" → "lunes 12 de octubre de 2026" (para fechas lejanas, como la próxima dosis)
const DIA_LARGO_ANIO = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
export function diaLargoConAnio(fecha: string) {
  return DIA_LARGO_ANIO.format(new Date(`${fecha}T12:00:00Z`))
}

// Fecha y hora ISO → "11 de oct de 2026" según el día en Argentina
const FECHA_CORTA_AR = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: ZONA })
export function fechaCortaDe(iso: string) {
  return FECHA_CORTA_AR.format(new Date(iso))
}

// "2026-10-12" → "lun 12 oct"
export function diaCorto(fecha: string) {
  return DIA_CORTO.format(new Date(`${fecha}T12:00:00Z`)).replace(/\./g, '').replace(',', '')
}

// "2026-10-12" → { semana: "Lun", numero: 12, mes: "oct" } (para mostrar el día como hojita de calendario)
const SEMANA_CORTA = new Intl.DateTimeFormat('es-AR', { weekday: 'short', timeZone: 'UTC' })
const MES_CORTO = new Intl.DateTimeFormat('es-AR', { month: 'short', timeZone: 'UTC' })
export function partesDeFecha(fecha: string) {
  const d = new Date(`${fecha}T12:00:00Z`)
  const semana = SEMANA_CORTA.format(d).replace('.', '')
  return {
    semana: semana.charAt(0).toUpperCase() + semana.slice(1),
    numero: d.getUTCDate(),
    mes: MES_CORTO.format(d).replace('.', ''),
  }
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

// "2026-11-14" → "2026-11-01"
export function primeroDeMes(fecha: string) {
  return `${fecha.slice(0, 8)}01`
}

// Explica por qué un período elegido a mano no sirve (o null si está bien). Máximo ~13 meses, como el servidor.
export function problemaDePeriodo(desde: string, hasta: string) {
  const valida = (f: string) => /^\d{4}-\d{2}-\d{2}$/.test(f) && !Number.isNaN(Date.parse(f))
  if (!valida(desde) || !valida(hasta)) return 'Revisá las fechas: alguna no es válida.'
  if (hasta < desde) return 'La fecha «Hasta» tiene que ser igual o posterior a «Desde».'
  if ((Date.parse(hasta) - Date.parse(desde)) / 86_400_000 + 1 > 400) return 'Elegí un período de hasta 13 meses.'
  return null
}

// Saludo según la hora en Argentina: "Buenos días" (5 a 12), "Buenas tardes" (12 a 20) o "Buenas noches".
export function saludoSegunHora() {
  const hora = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: ZONA }).format(new Date()))
  if (hora >= 5 && hora < 12) return 'Buenos días'
  if (hora >= 12 && hora < 20) return 'Buenas tardes'
  return 'Buenas noches'
}
