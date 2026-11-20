import { CircleAlert, CircleCheck, Lock, LockOpen, TrendingDown, TrendingUp } from 'lucide-react'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiGet, apiPatch, apiPost } from '../lib/api'
import { diaCorto, diaLargo, horaDe } from '../lib/fechas'
import { leerMonto, montoParaEditar, pesos } from '../lib/pagos'
import { puede } from '../lib/permisos'
import type { CierreCaja, EstadoCaja } from '../types'
import { Cargando } from './Cargando'

// Cómo quedó la cuenta: ícono y texto, nunca solo color.
function Diferencia({ monto }: { monto: number }) {
  if (monto === 0)
    return (
      <span className="cierre-estado cierre-justo">
        <CircleCheck size={18} aria-hidden="true" /> Coincide
      </span>
    )
  if (monto > 0)
    return (
      <span className="cierre-estado cierre-sobra">
        <TrendingUp size={18} aria-hidden="true" /> Sobran {pesos(monto)}
      </span>
    )
  return (
    <span className="cierre-estado cierre-falta">
      <TrendingDown size={18} aria-hidden="true" /> Faltan {pesos(-monto)}
    </span>
  )
}

// Cierre de caja (en Pagos): al terminar el día se cuenta el efectivo y VetYa dice si coincide.
// Con la caja cerrada no se cobra ni se anula nada de hoy; la administración la puede reabrir con motivo.
export function CierreDeCaja({ version, alCambiar }: { version: string; alCambiar: () => void }) {
  const { usuario } = useAuth()
  const [estado, setEstado] = useState<(EstadoCaja & { version: string }) | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cerrando, setCerrando] = useState(false)
  const [reabriendo, setReabriendo] = useState(false)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let vigente = true
    apiGet<EstadoCaja>('/pagos/cierre')
      .then((e) => vigente && setEstado({ ...e, version }))
      .catch(() => vigente && setError('No se pudo ver la caja de hoy.'))
    return () => {
      vigente = false
    }
  }, [version, recarga])

  function listo() {
    setCerrando(false)
    setReabriendo(false)
    setRecarga((n) => n + 1)
    alCambiar()
  }

  if (!estado) return error ? <p className="mensaje-error">{error}</p> : <Cargando />
  const { cierre } = estado
  const deberia = (cambio: number) => cambio + estado.porMedio.EFECTIVO

  return (
    <section className="hoy-caja cierre-caja no-imprimir" aria-labelledby="titulo-cierre">
      <div className="hoy-caja-titulo">
        <h2 id="titulo-cierre">
          {cierre ? <Lock size={22} aria-hidden="true" /> : <LockOpen size={22} aria-hidden="true" />} Cierre de caja
        </h2>
        <span className="hoy-faltan">Hoy · {diaLargo(estado.dia).replace(',', '')}</span>
      </div>

      {cierre ? (
        <div className="cierre-cuerpo">
          <p className="cierre-cerrada">
            <Lock size={18} aria-hidden="true" />
            <span>
              <strong>Caja cerrada</strong> a las {horaDe(cierre.cerradoEn)} por {cierre.cerradoPor.nombre}{' '}
              {cierre.cerradoPor.apellido}. Ya no se cobra ni se anula nada de hoy.
            </span>
          </p>
          <ul className="cierre-cuentas">
            <li>
              <span>Debería haber</span>
              <strong>{pesos(cierre.cambioInicial + cierre.efectivoCobrado)}</strong>
              <small>
                Cambio {pesos(cierre.cambioInicial)} + efectivo {pesos(cierre.efectivoCobrado)}
              </small>
            </li>
            <li>
              <span>Se contó</span>
              <strong>{pesos(cierre.efectivoContado)}</strong>
            </li>
            <li>
              <span>Resultado</span>
              <Diferencia monto={cierre.diferencia} />
            </li>
          </ul>
          {cierre.nota && <p className="cierre-nota">Nota: {cierre.nota}</p>}
          {puede(usuario, 'ajustes') &&
            (reabriendo ? (
              <Reabrir cierre={cierre} alListo={listo} alCancelar={() => setReabriendo(false)} />
            ) : (
              <button type="button" className="boton-texto" onClick={() => setReabriendo(true)}>
                <LockOpen size={18} aria-hidden="true" /> Reabrir la caja
              </button>
            ))}
        </div>
      ) : (
        <div className="cierre-cuerpo">
          <ul className="cierre-medios">
            <li>
              <span>Efectivo</span>
              <strong>{pesos(estado.porMedio.EFECTIVO)}</strong>
            </li>
            <li>
              <span>Transferencia</span>
              <strong>{pesos(estado.porMedio.TRANSFERENCIA)}</strong>
            </li>
            <li>
              <span>Débito</span>
              <strong>{pesos(estado.porMedio.DEBITO)}</strong>
            </li>
            <li>
              <span>Crédito</span>
              <strong>{pesos(estado.porMedio.CREDITO)}</strong>
            </li>
            <li className="cierre-total">
              <span>
                Total · {estado.cantidad} {estado.cantidad === 1 ? 'cobro' : 'cobros'}
              </span>
              <strong>{pesos(estado.total)}</strong>
            </li>
          </ul>
          {estado.porCobrar > 0 && (
            <p className="cierre-aviso">
              <CircleAlert size={18} aria-hidden="true" />
              Quedan {estado.porCobrar} {estado.porCobrar === 1 ? 'turno de hoy' : 'turnos de hoy'} por cobrar. Podés
              cerrar igual: quedan para mañana.
            </p>
          )}
          {!puede(usuario, 'pagos.cobrar') ? (
            <p className="hoy-vacio">La caja la cierra recepción o la administración.</p>
          ) : cerrando ? (
            <Cerrar cambioSugerido={estado.cambioSugerido} deberia={deberia} alListo={listo} alCancelar={() => setCerrando(false)} />
          ) : (
            <button type="button" className="boton" onClick={() => setCerrando(true)}>
              <Lock size={20} aria-hidden="true" /> Cerrar la caja de hoy
            </button>
          )}
        </div>
      )}

      {estado.historial.length > 0 && (
        <details className="cierre-historial">
          <summary>Cierres anteriores</summary>
          <ul>
            {estado.historial.map((c) => (
              <li key={c.id}>
                <span className="cierre-historial-dia">{diaCorto(c.dia)}</span>
                <span>
                  Contado {pesos(c.efectivoContado)} · {c.cerradoPor.nombre}
                </span>
                {c.reabiertoEn ? (
                  <span className="cierre-estado cierre-reabierta">
                    <LockOpen size={16} aria-hidden="true" /> Reabierta: {c.motivoReapertura}
                  </span>
                ) : (
                  <Diferencia monto={c.diferencia} />
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

function Cerrar({
  cambioSugerido,
  deberia,
  alListo,
  alCancelar,
}: {
  cambioSugerido: number
  deberia: (cambio: number) => number
  alListo: () => void
  alCancelar: () => void
}) {
  const id = useId()
  const [cambio, setCambio] = useState(montoParaEditar(cambioSugerido))
  const [contado, setContado] = useState('')
  const [nota, setNota] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const cambioNum = leerMonto(cambio) ?? 0
  const contadoNum = leerMonto(contado)
  const esperado = deberia(cambioNum)
  const diferencia = contadoNum === null ? null : Math.round((contadoNum - esperado) * 100) / 100

  async function cerrar(e: FormEvent) {
    e.preventDefault()
    if (contadoNum === null) {
      setError('Escribí cuánto efectivo contaste')
      return
    }
    if (diferencia !== 0 && !nota.trim()) {
      setError('Lo contado no coincide: escribí qué pasó en la nota')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      await apiPost<CierreCaja>('/pagos/cierre', { cambioInicial: cambioNum, efectivoContado: contadoNum, nota: nota.trim() || undefined })
      alListo()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cerrar la caja')
      setGuardando(false)
    }
  }

  return (
    <form className="cierre-formulario" onSubmit={cerrar}>
      <div className="cierre-campos">
        <label className="campo" htmlFor={`${id}-contado`}>
          Efectivo que contaste
          <input
            id={`${id}-contado`}
            inputMode="decimal"
            value={contado}
            onChange={(e) => setContado(e.target.value)}
            placeholder="Ej.: 85000"
            autoComplete="off"
            autoFocus
          />
        </label>
        <label className="campo" htmlFor={`${id}-cambio`}>
          Cambio con el que abriste
          <input
            id={`${id}-cambio`}
            inputMode="decimal"
            value={cambio}
            onChange={(e) => setCambio(e.target.value)}
            autoComplete="off"
          />
          <small>El efectivo para dar vuelto que había a la mañana.</small>
        </label>
      </div>
      <p className="cierre-esperado" aria-live="polite">
        Debería haber <strong>{pesos(esperado)}</strong>
        {diferencia !== null && <Diferencia monto={diferencia} />}
      </p>
      <label className="campo" htmlFor={`${id}-nota`}>
        Nota {diferencia !== null && diferencia !== 0 ? '(contá qué pasó)' : '(opcional)'}
        <input
          id={`${id}-nota`}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          maxLength={300}
          placeholder="Ej.: Se pagó un flete de $2.000 con la caja"
          autoComplete="off"
        />
      </label>
      {error && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}
      <div className="formulario-botones">
        <button type="submit" className="boton" disabled={guardando}>
          <Lock size={20} aria-hidden="true" /> {guardando ? 'Cerrando…' : 'Cerrar caja'}
        </button>
        <button type="button" className="boton-texto" onClick={alCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

function Reabrir({ cierre, alListo, alCancelar }: { cierre: CierreCaja; alListo: () => void; alCancelar: () => void }) {
  const id = useId()
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  async function reabrir(e: FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      await apiPatch(`/pagos/cierre/${cierre.id}/reabrir`, { motivo })
      alListo()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo reabrir')
      setGuardando(false)
    }
  }

  return (
    <form className="cierre-formulario" onSubmit={reabrir}>
      <label className="campo" htmlFor={`${id}-motivo`}>
        Por qué se reabre
        <input
          id={`${id}-motivo`}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          required
          minLength={3}
          maxLength={190}
          placeholder="Ej.: Llegó un cliente a pagar después del cierre"
          autoComplete="off"
          autoFocus
        />
      </label>
      {error && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}
      <div className="formulario-botones">
        <button type="submit" className="boton" disabled={guardando}>
          {guardando ? 'Reabriendo…' : 'Reabrir la caja'}
        </button>
        <button type="button" className="boton-texto" onClick={alCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
