import { Plus } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { apiPost } from '../lib/api'
import { leerMonto, MEDIOS_PAGO, MEDIOS_PARA_COBRAR, pesos } from '../lib/pagos'
import type { MedioPago, Pago } from '../types'
import { BotonesComprobante } from './BotonesComprobante'

// Un cobro que no viene de un turno: alimento, un medicamento, un accesorio…
// Desde la ficha del cliente queda a su nombre; desde Pagos, como venta en el mostrador.
export function OtroCobro({ clienteId, alGuardar }: { clienteId?: number; alGuardar: () => void }) {
  const [abierto, setAbierto] = useState(false)
  const [concepto, setConcepto] = useState('')
  const [monto, setMonto] = useState('')
  const [medio, setMedio] = useState<MedioPago>('EFECTIVO')
  const [error, setError] = useState<string | null>(null)
  const [listo, setListo] = useState<Pago | null>(null)
  const [guardando, setGuardando] = useState(false)
  const id = useId()
  const valor = leerMonto(monto)

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!valor) {
      setError('Escribí el monto')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      setListo(await apiPost<Pago>('/pagos', { clienteId, concepto, monto: valor, medio }))
      setConcepto('')
      setMonto('')
      setMedio('EFECTIVO')
      setAbierto(false)
      alGuardar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el cobro')
    } finally {
      setGuardando(false)
    }
  }

  if (!abierto) {
    return (
      <div className="otro-cobro">
        {listo && (
          <div className="mensaje-exito otro-cobro-listo" role="status">
            <span>
              Listo: {listo.concepto}, {pesos(listo.monto)} en {MEDIOS_PAGO[listo.medio].texto.toLowerCase()}.
            </span>
            <BotonesComprobante pago={listo} />
          </div>
        )}
        <button
          type="button"
          className="boton boton-contorno"
          onClick={() => {
            setListo(null)
            setAbierto(true)
          }}
        >
          <Plus size={18} aria-hidden="true" /> Registrar otro cobro
        </button>
      </div>
    )
  }

  return (
    <form className="formulario otro-cobro otro-cobro-abierto" onSubmit={guardar}>
      <div className="otro-cobro-campos">
        <label className="campo" htmlFor={`${id}-concepto`}>
          Qué se cobró
          <input
            id={`${id}-concepto`}
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            required
            maxLength={120}
            placeholder="Ej.: Alimento balanceado 3 kg"
            autoComplete="off"
          />
        </label>
        <label className="campo otro-cobro-monto" htmlFor={`${id}-monto`}>
          Monto en pesos
          <input
            id={`${id}-monto`}
            inputMode="decimal"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            required
            placeholder="Ej.: 21000"
            autoComplete="off"
          />
        </label>
      </div>
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
      {error && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}
      <div className="formulario-botones">
        <button type="submit" className="boton" disabled={guardando}>
          {guardando ? 'Guardando…' : valor ? `Cobrar ${pesos(valor)}` : 'Cobrar'}
        </button>
        <button type="button" className="boton-texto" onClick={() => setAbierto(false)}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
