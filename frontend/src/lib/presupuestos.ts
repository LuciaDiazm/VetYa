import { CircleCheck, CircleSlash, Clock3, HandCoins, type LucideIcon } from 'lucide-react'
import type { Clinica, Presupuesto } from '../types'
import { hoyArgentina } from './fechas'
import { pesos } from './pagos'
import { enlaceWhatsapp } from './sitio'

export const DIAS_VALIDEZ = 15

const FECHA = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
const FECHA_HORA = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'America/Argentina/Buenos_Aires',
})

// "N° 000012" (como el comprobante de pago)
export function numeroPresupuesto(p: Pick<Presupuesto, 'id'>) {
  return `N° ${String(p.id).padStart(6, '0')}`
}

// "Vale hasta" es una fecha sin hora: se guarda a medianoche UTC
export function validoHastaTexto(p: Pick<Presupuesto, 'validoHasta'>) {
  return FECHA.format(new Date(p.validoHasta))
}

export function fechaPresupuesto(p: Pick<Presupuesto, 'creadoEn'>) {
  return FECHA_HORA.format(new Date(p.creadoEn))
}

// "Castración · Firulais"
export function tituloCompleto(p: Pick<Presupuesto, 'titulo' | 'mascota'>) {
  return p.mascota ? `${p.titulo} · ${p.mascota.nombre}` : p.titulo
}

// Estado con ícono y texto (nunca solo color)
export function estadoPresupuesto(p: Presupuesto): { texto: string; clase: string; icono: LucideIcon } {
  if (p.estado === 'ANULADO') return { texto: 'Anulado', clase: 'anulado', icono: CircleSlash }
  if (p.falta === 0) return { texto: 'Pagado', clase: 'pagado', icono: CircleCheck }
  if (p.pagado > 0) return { texto: `Dejó ${pesos(p.pagado)} de seña`, clase: 'con-sena', icono: HandCoins }
  if (p.validoHasta.slice(0, 10) < hoyArgentina()) return { texto: 'Vencido', clase: 'vencido', icono: Clock3 }
  return { texto: 'Esperando respuesta', clase: 'esperando', icono: Clock3 }
}

// Mensaje para WhatsApp (lo manda la clínica con un toque)
export function mensajePresupuesto(p: Presupuesto, clinica: Pick<Clinica, 'nombre'>) {
  const lineas = [
    `Hola ${p.cliente.nombre}, te pasamos el presupuesto de ${clinica.nombre}${p.mascota ? ` para ${p.mascota.nombre}` : ''}.`,
    '',
    `*${p.titulo}*`,
    ...p.items.map((i) => `- ${i.descripcion}: ${pesos(i.monto)}`),
    `*Total: ${pesos(p.total)}*`,
  ]
  if (p.pagado > 0) lineas.push(`Ya pagaste ${pesos(p.pagado)}. Falta ${pesos(p.falta)}.`)
  if (p.nota) lineas.push('', p.nota)
  lineas.push('', `Vale hasta el ${validoHastaTexto(p)}.`)
  if (p.pagado === 0) lineas.push('Para reservar el turno se deja una seña en la clínica.')
  lineas.push('Cualquier duda, escribinos o llamanos.')
  return lineas.join('\n')
}

export function whatsappPresupuesto(p: Presupuesto, clinica: Pick<Clinica, 'nombre'>) {
  return p.cliente.telefono ? enlaceWhatsapp(p.cliente.telefono, mensajePresupuesto(p, clinica)) : null
}

export function rutaPresupuesto(p: Pick<Presupuesto, 'id'>, imprimir = false) {
  return `/panel/presupuestos/${p.id}${imprimir ? '?imprimir=1' : ''}`
}
