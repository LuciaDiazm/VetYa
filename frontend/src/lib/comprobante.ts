import type { Clinica, Pago } from '../types'
import { MEDIOS_PAGO, pesos } from './pagos'
import { enlaceWhatsapp } from './sitio'

const FECHA_HORA = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'America/Argentina/Buenos_Aires',
})

// "N° 000123": el número del comprobante es el del pago (no se repite y no se puede saltear).
export function numeroComprobante(pago: Pago) {
  return `N° ${String(pago.id).padStart(6, '0')}`
}

export function fechaComprobante(pago: Pago) {
  return FECHA_HORA.format(new Date(pago.fecha))
}

// Cómo pagó, escrito: "Efectivo" o "Sin cargo".
export function medioEscrito(pago: Pago) {
  return MEDIOS_PAGO[pago.medio].texto
}

// Mensaje listo para mandar por WhatsApp (lo envía la clínica con un toque, sin servicios pagos).
export function mensajeComprobante(pago: Pago, clinica: Pick<Clinica, 'nombre'>) {
  return [
    `Hola ${pago.cliente?.nombre ?? ''}, te mandamos el comprobante de pago de ${clinica.nombre}.`,
    '',
    `Comprobante ${numeroComprobante(pago)} · ${fechaComprobante(pago)}`,
    `${pago.concepto}: ${pesos(pago.monto)}`,
    pago.medio === 'SIN_CARGO' ? 'Sin cargo.' : `Pagaste con ${medioEscrito(pago).toLowerCase()}.`,
    '',
    'No válido como factura. Gracias por confiar en nosotros.',
  ].join('\n')
}

// Enlace de WhatsApp al cliente, o null si es una venta de mostrador sin teléfono.
export function whatsappComprobante(pago: Pago, clinica: Pick<Clinica, 'nombre'>) {
  return pago.cliente?.telefono ? enlaceWhatsapp(pago.cliente.telefono, mensajeComprobante(pago, clinica)) : null
}

// Página del comprobante (se abre en otra pestaña para imprimir sin perder lo que se estaba haciendo).
export function rutaComprobante(pago: Pago, imprimir = false) {
  return `/panel/pagos/${pago.id}/comprobante${imprimir ? '?imprimir=1' : ''}`
}
