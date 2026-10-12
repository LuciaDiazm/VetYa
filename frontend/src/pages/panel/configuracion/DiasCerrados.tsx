import { CalendarOff, X } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { apiDelete, apiGet, apiPost } from '../../../lib/api'
import { diaLargoConAnio, hoyArgentina } from '../../../lib/fechas'
import type { TurnoAfectado } from '../../../types'
import { TurnosAfectados } from './TurnosAfectados'

interface DiaCerrado {
  id: number
  fecha: string
  motivo: string | null
}

// Feriados, vacaciones o capacitaciones: esos días no se ofrecen turnos.
export function DiasCerrados() {
  const [dias, setDias] = useState<DiaCerrado[] | null>(null)
  const [hoy] = useState(hoyArgentina)
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [variosDias, setVariosDias] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [afectados, setAfectados] = useState<TurnoAfectado[] | null>(null)

  const cargar = useCallback(() => {
    apiGet<DiaCerrado[]>('/configuracion/dias-cerrados')
      .then(setDias)
      .catch(() => setError('No se pudieron cargar los días cerrados.'))
  }, [])
  useEffect(cargar, [cargar])

  async function cerrar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setGuardando(true)
    try {
      const r = await apiPost<{ turnosAfectados: TurnoAfectado[] }>('/configuracion/dias-cerrados', {
        desde,
        hasta: variosDias && hasta ? hasta : undefined,
        motivo,
      })
      setAfectados(r.turnosAfectados)
      setDesde('')
      setHasta('')
      setMotivo('')
      cargar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  async function abrir(dia: DiaCerrado) {
    if (!window.confirm(`¿Volver a atender el ${diaLargoConAnio(dia.fecha.slice(0, 10))}?`)) return
    try {
      await apiDelete(`/configuracion/dias-cerrados/${dia.id}`)
      cargar()
    } catch {
      setError('No se pudo quitar el día.')
    }
  }

  return (
    <div className="formulario">
      <form className="tarjeta formulario" onSubmit={cerrar}>
        <h2>Cerrar un día</h2>
        <div className="fila-campos">
          <label className="campo campo-fecha">
            {variosDias ? 'Desde' : 'Día'}
            <input type="date" min={hoy} value={desde} onChange={(e) => setDesde(e.target.value)} required />
          </label>
          {variosDias && (
            <label className="campo campo-fecha">
              Hasta
              <input type="date" min={desde || hoy} value={hasta} onChange={(e) => setHasta(e.target.value)} required />
            </label>
          )}
        </div>
        <label className="casilla">
          <input type="checkbox" checked={variosDias} onChange={(e) => setVariosDias(e.target.checked)} />
          Son varios días seguidos (por ejemplo, vacaciones)
        </label>
        <label className="campo">
          Motivo (opcional)
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Feriado, vacaciones…" />
        </label>
        {error && (
          <p className="mensaje-error" role="alert">
            {error}
          </p>
        )}
        <div className="formulario-botones">
          <button type="submit" className="boton" disabled={guardando}>
            <CalendarOff size={18} aria-hidden="true" /> {guardando ? 'Guardando…' : 'Cerrar'}
          </button>
        </div>
      </form>

      {afectados && <TurnosAfectados turnos={afectados} motivo="en los días que cerraste" />}

      <section className="tarjeta">
        <h2>Próximos días cerrados</h2>
        {!dias ? (
          <p className="cargando">Cargando…</p>
        ) : dias.length === 0 ? (
          <p className="vacio">No hay días cerrados por delante.</p>
        ) : (
          <ul className="lista-cerrados">
            {dias.map((d) => (
              <li key={d.id}>
                <span>
                  <strong>{diaLargoConAnio(d.fecha.slice(0, 10))}</strong>
                  {d.motivo && <span className="ayuda"> · {d.motivo}</span>}
                </span>
                <button type="button" className="boton-icono" aria-label="Volver a atender ese día" onClick={() => abrir(d)}>
                  <X size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
