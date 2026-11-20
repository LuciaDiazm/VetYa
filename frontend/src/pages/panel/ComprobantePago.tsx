import { MessageCircle, Printer } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { BotonVolver } from '../../components/BotonVolver'
import { Cargando } from '../../components/Cargando'
import { apiGet } from '../../lib/api'
import { fechaComprobante, medioEscrito, numeroComprobante, whatsappComprobante } from '../../lib/comprobante'
import { formatearTelefono } from '../../lib/mascotas'
import { pesos } from '../../lib/pagos'
import { numeroPresupuesto } from '../../lib/presupuestos'
import { useSitio } from '../../lib/sitio'
import type { Pago } from '../../types'

// Comprobante de un pago: un ticket angosto que sale bien en una impresora común o en una de tickets.
// No es una factura (eso lo hace la clínica con ARCA): por eso lo dice al pie.
export function ComprobantePago() {
  const { id } = useParams()
  const [parametros] = useSearchParams()
  const { datos: sitio } = useSitio()
  const [pago, setPago] = useState<Pago | null>(null)
  const [error, setError] = useState<string | null>(null)
  const imprimirAlAbrir = parametros.get('imprimir') === '1'

  useEffect(() => {
    apiGet<Pago>(`/pagos/${id}`)
      .then(setPago)
      .catch(() => setError('No se encontró el comprobante.'))
  }, [id])

  // Si se abrió desde "Imprimir", aparece la ventana de impresión apenas está todo cargado.
  useEffect(() => {
    if (!imprimirAlAbrir || !pago || !sitio) return
    const espera = setTimeout(() => window.print(), 300)
    return () => clearTimeout(espera)
  }, [imprimirAlAbrir, pago, sitio])

  if (error) return <p className="mensaje-error">{error}</p>
  if (!pago || !sitio) return <Cargando />
  const { clinica } = sitio
  const whatsapp = whatsappComprobante(pago, clinica)

  return (
    <div className="comprobante-pagina">
      <div className="comprobante-acciones no-imprimir">
        <BotonVolver siNoHay="/panel/pagos" />
        {whatsapp && !pago.anulado && (
          <a href={whatsapp} target="_blank" rel="noreferrer" className="boton boton-whatsapp">
            <MessageCircle size={18} aria-hidden="true" /> Mandar por WhatsApp
          </a>
        )}
        <button type="button" className="boton boton-contorno" onClick={() => window.print()}>
          <Printer size={18} aria-hidden="true" /> Imprimir
        </button>
      </div>

      <article className="comprobante" aria-label={`Comprobante ${numeroComprobante(pago)}`}>
        <header className="comprobante-clinica">
          <strong>{clinica.nombre}</strong>
          <span>{clinica.direccion}</span>
          <span>Tel. {formatearTelefono(clinica.telefono)}</span>
        </header>

        <h1>Comprobante de pago</h1>
        <p className="comprobante-numero">
          {numeroComprobante(pago)} · {fechaComprobante(pago)}
        </p>
        {pago.anulado && (
          <p className="comprobante-anulado">
            ANULADO · {pago.motivoAnulacion}
          </p>
        )}

        <dl className="comprobante-datos">
          <div>
            <dt>Cliente</dt>
            <dd>{pago.cliente ? `${pago.cliente.nombre} ${pago.cliente.apellido}` : 'Consumidor final'}</dd>
          </div>
          {pago.presupuesto && (
            <div>
              <dt>Presupuesto</dt>
              <dd>{numeroPresupuesto(pago.presupuesto)}</dd>
            </div>
          )}
          {pago.turno && (
            <div>
              <dt>Mascota</dt>
              <dd>{pago.turno.mascota.nombre}</dd>
            </div>
          )}
        </dl>

        <table className="comprobante-detalle">
          <tbody>
            <tr>
              <td>{pago.concepto}</td>
              <td>{pesos(pago.monto)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td>{pesos(pago.monto)}</td>
            </tr>
          </tfoot>
        </table>

        <p className="comprobante-medio">
          {pago.medio === 'SIN_CARGO' ? 'Sin cargo' : `Pagó con: ${medioEscrito(pago)}`}
        </p>
        <p className="comprobante-cobro">
          Cobró: {pago.registradoPor.nombre} {pago.registradoPor.apellido}
        </p>

        <footer className="comprobante-pie">
          <strong>No válido como factura</strong>
          <span>Gracias por confiar en nosotros</span>
        </footer>
      </article>
    </div>
  )
}
