import { MessageCircle, Printer } from 'lucide-react'
import { whatsappComprobante, rutaComprobante } from '../lib/comprobante'
import { useSitio } from '../lib/sitio'
import type { Pago } from '../types'

// Después de cobrar: mandar el comprobante por WhatsApp (lo principal) o imprimirlo.
// La impresión se abre en otra pestaña, así esta pantalla queda como estaba.
export function BotonesComprobante({ pago }: { pago: Pago }) {
  const { datos: sitio } = useSitio()
  const whatsapp = sitio ? whatsappComprobante(pago, sitio.clinica) : null

  return (
    <span className="botones-comprobante">
      {whatsapp && (
        <a href={whatsapp} target="_blank" rel="noreferrer" className="boton-fila boton-fila-whatsapp">
          <MessageCircle size={16} aria-hidden="true" /> Mandar comprobante
        </a>
      )}
      <a href={rutaComprobante(pago, true)} target="_blank" rel="noreferrer" className="boton-fila">
        <Printer size={16} aria-hidden="true" /> Imprimir
      </a>
    </span>
  )
}
