import { Check, Undo2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiPatch, apiPost } from '../lib/api'
import { BotonesComprobante } from './BotonesComprobante'
import { diaCorto, diaDe, esHoy, horaDe } from '../lib/fechas'
import { leerMonto, MEDIOS_PAGO, MEDIOS_PARA_COBRAR, montoParaEditar, pesos } from '../lib/pagos'
import type { MedioPago, Pago, TurnoPorCobrar } from '../types'

// Un turno atendido que falta cobrar: el precio ya viene puesto (se puede cambiar), se elige
// cómo pagó y se toca "Cobrar". Si fue un error, "Deshacer" lo anula al instante.
export function CobrarTurno({
  turno,
  alCambiar,
  conCliente = true,
}: {
  turno: TurnoPorCobrar
  alCambiar?: (cobrado: boolean) => void
  conCliente?: boolean // en la ficha del cliente no hace falta repetir su nombre
}) {
  const [monto, setMonto] = useState(() => montoParaEditar(turno.servicio.precioReferencia))
  const [medio, setMedio] = useState<MedioPago>('EFECTIVO')
  const [pago, setPago] = useState<Pago | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const id = `cobro-${turno.id}`
  const valor = leerMonto(monto)
  const cuando = esHoy(diaDe(turno.fechaHoraInicio))
    ? `Hoy ${horaDe(turno.fechaHoraInicio)}`
    : `${diaCorto(diaDe(turno.fechaHoraInicio))} ${horaDe(turno.fechaHoraInicio)}`

  async function cobrar(medioElegido: MedioPago, e?: FormEvent) {
    e?.preventDefault()
    if (medioElegido !== 'SIN_CARGO' && !valor) {
      setError('Escribí el monto')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      const nuevo = await apiPost<Pago>('/pagos', {
        turnoId: turno.id,
        monto: medioElegido === 'SIN_CARGO' ? 0 : valor,
        medio: medioElegido,
      })
      setPago(nuevo)
      alCambiar?.(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el pago')
    } finally {
      setGuardando(false)
    }
  }

  async function deshacer() {
    if (!pago) return
    setGuardando(true)
    setError(null)
    try {
      await apiPatch(`/pagos/${pago.id}/anular`, { motivo: 'Se deshizo al cobrar' })
      setPago(null)
      alCambiar?.(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo deshacer')
    } finally {
      setGuardando(false)
    }
  }

  const quien = (
    <div className="cobro-quien">
      <strong>{turno.mascota.nombre}</strong>
      {conCliente && (
        <Link to={`/panel/clientes/${turno.mascota.cliente.id}`} className="cobro-cliente">
          {turno.mascota.cliente.nombre} {turno.mascota.cliente.apellido}
        </Link>
      )}
      <span className="cobro-detalle">
        {turno.servicio.nombre} · {cuando}
      </span>
    </div>
  )

  if (pago) {
    return (
      <li className="cobro cobro-listo">
        {quien}
        <p className="cobro-hecho" role="status">
          <Check size={20} aria-hidden="true" />
          {pago.medio === 'SIN_CARGO' ? 'Sin cargo' : `Cobrado ${pesos(pago.monto)} · ${MEDIOS_PAGO[pago.medio].texto}`}
        </p>
        <span className="cobro-listo-acciones">
          <BotonesComprobante pago={pago} />
          <button type="button" className="boton-fila" onClick={deshacer} disabled={guardando}>
            <Undo2 size={16} aria-hidden="true" /> Deshacer
          </button>
        </span>
        {error && (
          <p className="mensaje-error cobro-error" role="alert">
            {error}
          </p>
        )}
      </li>
    )
  }

  return (
    <li className="cobro">
      {quien}
      <form className="cobro-formulario" onSubmit={(e) => cobrar(medio, e)}>
        <label className="cobro-monto" htmlFor={`${id}-monto`}>
          <span>Monto</span>
          <span className="cobro-monto-campo">
            <span aria-hidden="true">$</span>
            <input
              id={`${id}-monto`}
              inputMode="decimal"
              autoComplete="off"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder={turno.servicio.precioReferencia === null ? 'Sin precio' : undefined}
              aria-invalid={!!error}
            />
          </span>
        </label>
        <fieldset className="cobro-medios">
          <legend>Cómo pagó</legend>
          {MEDIOS_PARA_COBRAR.map((m) => {
            const Icono = MEDIOS_PAGO[m].icono
            return (
              <button
                key={m}
                type="button"
                className={`chip cobro-medio${medio === m ? ' chip-activo' : ''}`}
                aria-pressed={medio === m}
                onClick={() => setMedio(m)}
              >
                <Icono size={16} aria-hidden="true" /> {MEDIOS_PAGO[m].texto}
              </button>
            )
          })}
        </fieldset>
        <div className="cobro-acciones">
          <button type="submit" className="boton cobro-boton" disabled={guardando}>
            {guardando ? 'Guardando…' : valor ? `Cobrar ${pesos(valor)}` : 'Cobrar'}
          </button>
          <button type="button" className="boton-texto" onClick={() => cobrar('SIN_CARGO')} disabled={guardando}>
            No se cobra
          </button>
        </div>
        {error && (
          <p className="mensaje-error cobro-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </li>
  )
}
