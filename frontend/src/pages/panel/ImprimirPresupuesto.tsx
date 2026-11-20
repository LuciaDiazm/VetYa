import { MessageCircle, Printer } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { BotonVolver } from '../../components/BotonVolver'
import { Cargando } from '../../components/Cargando'
import { apiGet } from '../../lib/api'
import { formatearTelefono } from '../../lib/mascotas'
import { pesos } from '../../lib/pagos'
import { fechaPresupuesto, numeroPresupuesto, validoHastaTexto, whatsappPresupuesto } from '../../lib/presupuestos'
import { useSitio } from '../../lib/sitio'
import type { Presupuesto } from '../../types'

// Presupuesto para imprimir o mandar por WhatsApp. Como el comprobante, no es una factura.
export function ImprimirPresupuesto() {
  const { id } = useParams()
  const [parametros] = useSearchParams()
  const { datos: sitio } = useSitio()
  const [p, setP] = useState<Presupuesto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const imprimirAlAbrir = parametros.get('imprimir') === '1'

  useEffect(() => {
    apiGet<Presupuesto>(`/presupuestos/${id}`)
      .then(setP)
      .catch(() => setError('No se encontró el presupuesto.'))
  }, [id])

  useEffect(() => {
    if (!imprimirAlAbrir || !p || !sitio) return
    const espera = setTimeout(() => window.print(), 300)
    return () => clearTimeout(espera)
  }, [imprimirAlAbrir, p, sitio])

  if (error) return <p className="mensaje-error">{error}</p>
  if (!p || !sitio) return <Cargando />
  const { clinica } = sitio
  const whatsapp = p.estado === 'VIGENTE' ? whatsappPresupuesto(p, clinica) : null

  return (
    <div className="comprobante-pagina">
      <div className="comprobante-acciones no-imprimir">
        <BotonVolver siNoHay={`/panel/clientes/${p.cliente.id}`} />
        {whatsapp && (
          <a href={whatsapp} target="_blank" rel="noreferrer" className="boton boton-whatsapp">
            <MessageCircle size={18} aria-hidden="true" /> Mandar por WhatsApp
          </a>
        )}
        <button type="button" className="boton boton-contorno" onClick={() => window.print()}>
          <Printer size={18} aria-hidden="true" /> Imprimir
        </button>
      </div>

      <article className="comprobante presupuesto-hoja" aria-label={`Presupuesto ${numeroPresupuesto(p)}`}>
        <header className="comprobante-clinica">
          <strong>{clinica.nombre}</strong>
          <span>{clinica.direccion}</span>
          <span>Tel. {formatearTelefono(clinica.telefono)}</span>
        </header>

        <h1>Presupuesto</h1>
        <p className="comprobante-numero">
          {numeroPresupuesto(p)} · {fechaPresupuesto(p)}
        </p>
        {p.estado === 'ANULADO' && <p className="comprobante-anulado">ANULADO · {p.motivoAnulacion}</p>}

        <dl className="comprobante-datos">
          <div>
            <dt>Cliente</dt>
            <dd>
              {p.cliente.nombre} {p.cliente.apellido}
            </dd>
          </div>
          {p.mascota && (
            <div>
              <dt>Mascota</dt>
              <dd>{p.mascota.nombre}</dd>
            </div>
          )}
          <div>
            <dt>Vale hasta</dt>
            <dd>{validoHastaTexto(p)}</dd>
          </div>
        </dl>

        <table className="comprobante-detalle">
          <caption className="solo-lectores">{p.titulo}</caption>
          <tbody>
            {p.items.map((i) => (
              <tr key={i.id}>
                <td>{i.descripcion}</td>
                <td>{pesos(i.monto)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td>{pesos(p.total)}</td>
            </tr>
          </tfoot>
        </table>

        {p.pagado > 0 && (
          <dl className="comprobante-datos presupuesto-hoja-nota">
            <div>
              <dt>Pagado a cuenta</dt>
              <dd>{pesos(p.pagado)}</dd>
            </div>
            <div>
              <dt>Falta</dt>
              <dd>{pesos(p.falta)}</dd>
            </div>
          </dl>
        )}
        {p.nota && <p className="presupuesto-hoja-nota">{p.nota}</p>}

        <footer className="comprobante-pie">
          <strong>No válido como factura</strong>
          {p.pagado === 0 && p.estado === 'VIGENTE' && <span>Para reservar el turno se deja una seña en la clínica</span>}
        </footer>
      </article>
    </div>
  )
}
