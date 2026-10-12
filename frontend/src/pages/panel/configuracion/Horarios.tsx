import { Copy, Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { apiGet, apiPut } from '../../../lib/api'
import { olvidarSitio } from '../../../lib/sitio'
import type { HorarioAtencion, TurnoAfectado } from '../../../types'
import { TurnosAfectados } from './TurnosAfectados'

// De lunes a domingo (en la base, 0 = domingo).
const DIAS = [
  { numero: 1, nombre: 'Lunes' },
  { numero: 2, nombre: 'Martes' },
  { numero: 3, nombre: 'Miércoles' },
  { numero: 4, nombre: 'Jueves' },
  { numero: 5, nombre: 'Viernes' },
  { numero: 6, nombre: 'Sábado' },
  { numero: 0, nombre: 'Domingo' },
]
const MAX_TRAMOS = 3

type Tramo = { horaInicio: string; horaFin: string }
type Semana = Record<number, Tramo[]>

function aSemana(horarios: HorarioAtencion[]): Semana {
  const semana: Semana = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
  for (const h of horarios) semana[h.diaSemana].push({ horaInicio: h.horaInicio, horaFin: h.horaFin })
  return semana
}

// Horario de atención: de acá salen los turnos que se ofrecen en la web y en la agenda.
export function Horarios() {
  const [semana, setSemana] = useState<Semana | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [resultado, setResultado] = useState<TurnoAfectado[] | null>(null)

  useEffect(() => {
    apiGet<HorarioAtencion[]>('/configuracion/horarios')
      .then((h) => setSemana(aSemana(h)))
      .catch(() => setError('No se pudieron cargar los horarios.'))
  }, [])

  if (!semana) return error ? <p className="mensaje-error">{error}</p> : <p className="cargando">Cargando…</p>

  function cambiar(dia: number, tramos: Tramo[]) {
    setSemana((s) => (s ? { ...s, [dia]: tramos } : s))
    setResultado(null)
  }

  function copiarLunes() {
    if (!semana) return
    const lunes = semana[1]
    setSemana({ ...semana, 2: [...lunes], 3: [...lunes], 4: [...lunes], 5: [...lunes] })
    setResultado(null)
  }

  async function guardar() {
    if (!semana) return
    setError(null)
    setGuardando(true)
    try {
      const horarios = Object.entries(semana).flatMap(([dia, tramos]) =>
        tramos.map((t) => ({ diaSemana: Number(dia), ...t })),
      )
      const r = await apiPut<{ turnosFuera: TurnoAfectado[] }>('/configuracion/horarios', { horarios })
      setResultado(r.turnosFuera)
      olvidarSitio()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="formulario">
      <section className="tarjeta">
        <div className="bloque-ficha-titulo">
          <h2>Horario de atención</h2>
          <button type="button" className="boton-texto enlace-chico" onClick={copiarLunes}>
            <Copy size={16} aria-hidden="true" /> Copiar el lunes al resto de la semana (martes a viernes)
          </button>
        </div>
        <p className="ayuda">
          Si cierran al mediodía, agregá dos horarios (mañana y tarde). Los turnos se ofrecen dentro de estos
          horarios.
        </p>

        <ul className="lista-horarios">
          {DIAS.map(({ numero, nombre }) => {
            const tramos = semana[numero]
            const abierto = tramos.length > 0
            return (
              <li key={numero} className={abierto ? '' : 'dia-cerrado'}>
                <label className="casilla">
                  <input
                    type="checkbox"
                    checked={abierto}
                    onChange={(e) =>
                      cambiar(numero, e.target.checked ? [{ horaInicio: '09:00', horaFin: '12:30' }] : [])
                    }
                  />
                  {nombre}
                </label>
                {abierto ? (
                  <div className="tramos">
                    {tramos.map((t, i) => (
                      <div key={i} className="tramo">
                        <label>
                          <span className="solo-lectores">Desde</span>
                          <input
                            type="time"
                            step={900}
                            value={t.horaInicio}
                            onChange={(e) =>
                              cambiar(numero, tramos.map((x, j) => (j === i ? { ...x, horaInicio: e.target.value } : x)))
                            }
                            required
                          />
                        </label>
                        <span>a</span>
                        <label>
                          <span className="solo-lectores">Hasta</span>
                          <input
                            type="time"
                            step={900}
                            value={t.horaFin}
                            onChange={(e) =>
                              cambiar(numero, tramos.map((x, j) => (j === i ? { ...x, horaFin: e.target.value } : x)))
                            }
                            required
                          />
                        </label>
                        <button
                          type="button"
                          className="boton-icono"
                          aria-label={`Quitar el horario de ${t.horaInicio} a ${t.horaFin}`}
                          onClick={() => cambiar(numero, tramos.filter((_, j) => j !== i))}
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ))}
                    {tramos.length < MAX_TRAMOS && (
                      <button
                        type="button"
                        className="boton-texto enlace-chico"
                        onClick={() =>
                          cambiar(numero, [...tramos, { horaInicio: tramos.length ? '17:00' : '09:00', horaFin: '20:30' }])
                        }
                      >
                        <Plus size={16} aria-hidden="true" /> Agregar otro horario
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="ayuda">Cerrado</span>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      {error && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}
      <div className="formulario-botones">
        <button type="button" className="boton boton-grande" disabled={guardando} onClick={guardar}>
          {guardando ? 'Guardando…' : 'Guardar horarios'}
        </button>
        {resultado && <p className="mensaje-exito">Listo, los horarios quedaron guardados.</p>}
      </div>
      {resultado && <TurnosAfectados turnos={resultado} motivo="fuera del nuevo horario" />}
    </div>
  )
}
