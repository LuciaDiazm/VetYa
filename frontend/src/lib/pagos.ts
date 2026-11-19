import { ArrowLeftRight, Banknote, CreditCard, Gift, WalletCards } from 'lucide-react'
import type { MedioPago, Pago } from '../types'

// Medios de pago que se aceptan en la clínica (en la web no se cobra nada).
export const MEDIOS_PAGO: Record<MedioPago, { texto: string; icono: typeof Banknote }> = {
  EFECTIVO: { texto: 'Efectivo', icono: Banknote },
  TRANSFERENCIA: { texto: 'Transferencia', icono: ArrowLeftRight },
  DEBITO: { texto: 'Débito', icono: CreditCard },
  CREDITO: { texto: 'Crédito', icono: WalletCards },
  SIN_CARGO: { texto: 'Sin cargo', icono: Gift },
}

// Los que se eligen al cobrar ("Sin cargo" va aparte, como un botón chico).
export const MEDIOS_PARA_COBRAR = ['EFECTIVO', 'TRANSFERENCIA', 'DEBITO', 'CREDITO'] as const

const FORMATO = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 })
const FORMATO_ENTERO = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

// "$ 22.000" (con centavos solo si los tiene)
export function pesos(monto: number) {
  return (Number.isInteger(monto) ? FORMATO_ENTERO : FORMATO).format(monto)
}

// Lo que se escribe en el campo del monto: acepta "22.000", "22000" o "22000,50".
export function leerMonto(texto: string): number | null {
  const limpio = texto.replace(/\$/g, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  if (limpio === '') return null
  const n = Number(limpio)
  return Number.isFinite(n) && n >= 0 ? n : null
}

// El monto como se muestra en el campo para editarlo: "22000" (sin puntos, más fácil de corregir).
export function montoParaEditar(monto: number | null) {
  return monto === null ? '' : String(monto).replace('.', ',')
}

// ¿Esta persona puede anular el pago? La administración, siempre; el resto, solo uno suyo de hoy.
export function puedeAnular(pago: Pago, usuario: { id: number; rol: string } | null, hoy: string, diaDelPago: string) {
  if (!usuario || pago.anulado) return false
  return usuario.rol === 'ADMIN' || (pago.registradoPor.id === usuario.id && diaDelPago === hoy)
}
