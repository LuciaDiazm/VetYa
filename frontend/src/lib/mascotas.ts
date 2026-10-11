import type { EspecieMascota } from '../types'

export const ESPECIES: Record<EspecieMascota, string> = {
  PERRO: 'Perro',
  GATO: 'Gato',
  OTRO: 'Otro',
}

// "5493777222333" → "3777 222333" (como lo escribe la gente en Goya).
export function formatearTelefono(telefono: string) {
  const d = telefono.replace(/\D/g, '')
  if (d.startsWith('549') && d.length === 13) return `${d.slice(3, 7)} ${d.slice(7)}`
  return telefono
}

// Edad legible a partir de la fecha de nacimiento: "3 años", "1 año y 4 meses", "8 meses", "3 semanas".
export function edadTexto(fechaNacimiento: string | null, hoy = new Date()) {
  if (!fechaNacimiento) return null
  const nacimiento = new Date(fechaNacimiento)
  let meses =
    (hoy.getUTCFullYear() - nacimiento.getUTCFullYear()) * 12 + (hoy.getUTCMonth() - nacimiento.getUTCMonth())
  if (hoy.getUTCDate() < nacimiento.getUTCDate()) meses -= 1

  if (meses < 1) {
    const semanas = Math.max(0, Math.floor((hoy.getTime() - nacimiento.getTime()) / (7 * 24 * 3600 * 1000)))
    return semanas === 1 ? '1 semana' : `${semanas} semanas`
  }
  if (meses < 12) return meses === 1 ? '1 mes' : `${meses} meses`

  const anios = Math.floor(meses / 12)
  const resto = meses % 12
  const textoAnios = anios === 1 ? '1 año' : `${anios} años`
  if (anios >= 3 || resto === 0) return textoAnios
  return `${textoAnios} y ${resto === 1 ? '1 mes' : `${resto} meses`}`
}

// Fecha "AAAA-MM-DD" aproximada a partir de una edad en años (para cuando el dueño no sabe la fecha).
export function fechaDesdeEdad(anios: number, hoy = new Date()) {
  const fecha = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1))
  fecha.setUTCMonth(fecha.getUTCMonth() - Math.round(anios * 12))
  return fecha.toISOString().slice(0, 10)
}

// Las fechas sin hora se guardan a la medianoche UTC: se muestran en UTC para no correrse un día.
export const FECHA_CORTA = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
