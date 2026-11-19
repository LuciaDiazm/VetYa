import { Ban, CircleCheck, ReceiptText } from 'lucide-react'
import { Fragment, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiPatch } from '../lib/api'
import { diaCorto, diaDe, horaDe, hoyArgentina } from '../lib/fechas'
import { rutaComprobante } from '../lib/comprobante'
import { MEDIOS_PAGO, pesos, puedeAnular } from '../lib/pagos'
import type { Pago } from '../types'

const nombre = (p: { nombre: string; apellido: string } | null) => (p ? `${p.nombre} ${p.apellido}` : '')

// Tabla de pagos (pantalla Pagos y ficha del cliente). Los anulados se ven tachados, con quién y por qué.
// En pantalla se muestra una página; al imprimir salen todos (ver .fuera-de-pagina).
export function TablaPagos({
  pagos,
  alCambiar,
  conCliente = true,
  desde = 0,
  hasta = pagos.length,
}: {
  pagos: Pago[]
  alCambiar: () => void
  conCliente?: boolean
  desde?: number
  hasta?: number
}) {
  const { usuario } = useAuth()
  const [hoy] = useState(hoyArgentina)
  const [anulando, setAnulando] = useState<number | null>(null)
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  async function anular(e: FormEvent, pago: Pago) {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      await apiPatch(`/pagos/${pago.id}/anular`, { motivo })
      setAnulando(null)
      setMotivo('')
      alCambiar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo anular')
    } finally {
      setGuardando(false)
    }
  }

  const columnas = conCliente ? 8 : 7

  return (
    <table className="informe-tabla tabla-pagos">
      <thead>
        <tr>
          <th scope="col">Fecha</th>
          <th scope="col">Hora</th>
          {conCliente && <th scope="col">Cliente</th>}
          <th scope="col">Concepto</th>
          <th scope="col">Medio</th>
          <th scope="col" className="pago-monto">
            Monto
          </th>
          <th scope="col">Registró</th>
          <th scope="col">
            <span className="solo-lectores">Acciones</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {pagos.map((p, i) => {
          const Icono = MEDIOS_PAGO[p.medio].icono
          const dia = diaDe(p.fecha)
          const enLaPagina = i >= desde && i < hasta
          return (
            <Fragment key={p.id}>
              <tr className={[p.anulado && 'pago-anulado', !enLaPagina && 'fuera-de-pagina'].filter(Boolean).join(' ') || undefined}>
                <td className="informe-fecha">{diaCorto(dia)}</td>
                <td>{horaDe(p.fecha)}</td>
                {conCliente && (
                  <td data-etiqueta="Cliente">
                    {p.cliente ? (
                      <Link to={`/panel/clientes/${p.cliente.id}`}>{nombre(p.cliente)}</Link>
                    ) : (
                      <span className="informe-gris">Mostrador</span>
                    )}
                  </td>
                )}
                <td data-etiqueta="Concepto">
                  {p.concepto}
                  {p.anulado && (
                    <span className="pago-motivo">
                      Anulado por {nombre(p.anuladoPor)}: {p.motivoAnulacion}
                    </span>
                  )}
                </td>
                <td data-etiqueta="Medio">
                  <span className="pago-medio">
                    <Icono size={16} aria-hidden="true" /> {MEDIOS_PAGO[p.medio].texto}
                  </span>
                </td>
                <td data-etiqueta="Monto" className="pago-monto">
                  {p.anulado ? (
                    <>
                      <s>{pesos(p.monto)}</s> <span className="pago-estado-anulado">Anulado</span>
                    </>
                  ) : (
                    <strong>{pesos(p.monto)}</strong>
                  )}
                </td>
                <td data-etiqueta="Registró" className="informe-gris">
                  {nombre(p.registradoPor)}
                </td>
                <td className="pago-acciones no-imprimir">
                  <Link to={rutaComprobante(p)} className="boton-fila">
                    <ReceiptText size={16} aria-hidden="true" /> Comprobante
                  </Link>
                  {puedeAnular(p, usuario, hoy, dia) && anulando !== p.id && (
                    <button
                      type="button"
                      className="boton-fila"
                      onClick={() => {
                        setAnulando(p.id)
                        setMotivo('')
                        setError(null)
                      }}
                    >
                      <Ban size={16} aria-hidden="true" /> Anular
                    </button>
                  )}
                </td>
              </tr>
              {anulando === p.id && (
                <tr className="pago-anular no-imprimir">
                  <td colSpan={columnas}>
                    <form className="pago-anular-formulario" onSubmit={(e) => anular(e, p)}>
                      <label className="campo-compacto">
                        <span>Por qué se anula</span>
                        <input
                          value={motivo}
                          onChange={(e) => setMotivo(e.target.value)}
                          required
                          minLength={3}
                          maxLength={190}
                          placeholder="Ej.: se cargó dos veces"
                          autoFocus
                        />
                      </label>
                      <button type="submit" className="boton" disabled={guardando}>
                        <CircleCheck size={18} aria-hidden="true" /> {guardando ? 'Anulando…' : 'Anular el pago'}
                      </button>
                      <button type="button" className="boton-texto" onClick={() => setAnulando(null)}>
                        Cancelar
                      </button>
                      {error && (
                        <p className="mensaje-error" role="alert">
                          {error}
                        </p>
                      )}
                    </form>
                  </td>
                </tr>
              )}
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}
