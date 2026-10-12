import type { AplicacionSanitaria, EspecieMascota } from '../types'

// Vacunas y desparasitarios más comunes, con el tiempo habitual hasta la próxima dosis.
// Son sugerencias: el veterinario puede elegir otra fecha o escribir otro producto.
export interface ProductoSanitario {
  nombre: string
  tipo: 'VACUNA' | 'DESPARASITACION'
  meses: number | null // null = sin refuerzo sugerido
  especies: EspecieMascota[]
}

export const PRODUCTOS: ProductoSanitario[] = [
  { nombre: 'Antirrábica', tipo: 'VACUNA', meses: 12, especies: ['PERRO', 'GATO'] },
  { nombre: 'Séxtuple', tipo: 'VACUNA', meses: 12, especies: ['PERRO'] },
  { nombre: 'Quíntuple', tipo: 'VACUNA', meses: 12, especies: ['PERRO'] },
  { nombre: 'Tos de las perreras', tipo: 'VACUNA', meses: 12, especies: ['PERRO'] },
  { nombre: 'Triple felina', tipo: 'VACUNA', meses: 12, especies: ['GATO'] },
  { nombre: 'Leucemia felina', tipo: 'VACUNA', meses: 12, especies: ['GATO'] },
  { nombre: 'Desparasitación interna', tipo: 'DESPARASITACION', meses: 3, especies: ['PERRO', 'GATO', 'OTRO'] },
  { nombre: 'Antipulgas y garrapatas (pipeta)', tipo: 'DESPARASITACION', meses: 1, especies: ['PERRO', 'GATO'] },
  { nombre: 'Antipulgas y garrapatas (comprimido)', tipo: 'DESPARASITACION', meses: 3, especies: ['PERRO'] },
]

export function productosPara(especie: EspecieMascota, tipo: 'VACUNA' | 'DESPARASITACION') {
  return PRODUCTOS.filter((p) => p.tipo === tipo && p.especies.includes(especie))
}

// "AAAA-MM-DD" dentro de X meses a partir de una fecha "AAAA-MM-DD".
export function sumarMeses(fecha: string, meses: number) {
  const d = new Date(`${fecha}T12:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + meses)
  return d.toISOString().slice(0, 10)
}

export const PLAZOS = [
  { meses: 1, texto: 'En 1 mes' },
  { meses: 3, texto: 'En 3 meses' },
  { meses: 6, texto: 'En 6 meses' },
  { meses: 12, texto: 'En 1 año' },
]

// Estado de una dosis según su fecha de próxima aplicación.
export function estadoDosis(a: AplicacionSanitaria, hoy: string) {
  if (!a.fechaProximaDosis) return null
  const dias = Math.round(
    (new Date(a.fechaProximaDosis).getTime() - new Date(`${hoy}T00:00:00Z`).getTime()) / (24 * 3600 * 1000),
  )
  if (dias < 0) return { clase: 'vencida', texto: 'Vencida' }
  if (dias <= 15) return { clase: 'por-vencer', texto: dias === 0 ? 'Vence hoy' : dias === 1 ? 'Vence mañana' : `Vence en ${dias} días` }
  return { clase: 'al-dia', texto: 'Al día' }
}

// Solo se muestra la última aplicación de cada producto: es la que dice cuándo toca la próxima.
export function ultimasPorProducto(aplicaciones: AplicacionSanitaria[]) {
  const vistas = new Set<string>()
  return aplicaciones.filter((a) => {
    const clave = `${a.tipo}-${a.producto.toLowerCase()}`
    if (vistas.has(clave)) return false
    vistas.add(clave)
    return true
  })
}
