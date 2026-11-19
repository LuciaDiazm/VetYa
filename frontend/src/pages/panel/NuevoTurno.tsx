import { Plus, Search } from 'lucide-react'
import { BotonVolver } from '../../components/BotonVolver'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { apiGet, apiPost } from '../../lib/api'
import { diaAmigable, diaLargo, hoyArgentina, sumarDias } from '../../lib/fechas'
import { formatearTelefono } from '../../lib/mascotas'
import type { Cliente, FichaMascota, Mascota, Servicio, Turno } from '../../types'
import { IconoEspecie } from './Clientes'

interface MascotaElegida extends Pick<Mascota, 'id' | 'nombre' | 'especie'> {
  dueno: string
}

// Dar un turno desde el panel: cuando el cliente llama o viene al mostrador.
export function NuevoTurno() {
  const [parametros] = useSearchParams()
  const navegar = useNavigate()
  const [mascota, setMascota] = useState<MascotaElegida | null>(null)
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [servicio, setServicio] = useState<Servicio | null>(null)
  const [fecha, setFecha] = useState(parametros.get('fecha') ?? hoyArgentina())
  const [libres, setLibres] = useState<string[] | null>(null)
  // Si viene de un rato libre de la agenda, la hora ya queda elegida (si está disponible para el servicio).
  const [hora, setHora] = useState<string | null>(parametros.get('hora'))
  const [sobreturno, setSobreturno] = useState(false)
  const [origen, setOrigen] = useState<'TELEFONO' | 'MOSTRADOR'>('TELEFONO')
  const [observaciones, setObservaciones] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  // Si viene desde la ficha de una mascota, ya queda elegida.
  useEffect(() => {
    const id = parametros.get('mascota')
    if (!id) return
    apiGet<FichaMascota>(`/mascotas/${id}`).then((m) =>
      setMascota({ id: m.id, nombre: m.nombre, especie: m.especie, dueno: `${m.cliente.nombre} ${m.cliente.apellido}` }),
    )
  }, [parametros])

  useEffect(() => {
    apiGet<Servicio[]>('/publico/servicios').then(setServicios)
  }, [])

  useEffect(() => {
    if (!servicio || !fecha) return
    let vigente = true
    apiGet<string[]>(`/turnos/disponibilidad?servicioId=${servicio.id}&fecha=${fecha}`).then((r) => {
      if (!vigente) return
      setLibres(r)
      setHora((h) => (h && r.includes(h) ? h : null))
    })
    return () => {
      vigente = false
    }
  }, [servicio, fecha])

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!mascota || !servicio || !hora) return
    setError(null)
    setGuardando(true)
    try {
      await apiPost('/turnos', {
        mascotaId: mascota.id,
        servicioId: servicio.id,
        fecha,
        hora,
        origen,
        observaciones: observaciones || undefined,
        sobreturno,
      })
      navegar(fecha === hoyArgentina() ? '/panel/agenda' : `/panel/agenda?dia=${fecha}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el turno')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      <BotonVolver siNoHay="/panel/agenda" />
      <div className="panel-encabezado">
        <h1>Dar turno</h1>
      </div>

      <form className="formulario formulario-animal" onSubmit={guardar}>
        {/* ---------- Mascota ---------- */}
        <section className="tarjeta formulario">
          <h2>¿Para quién?</h2>
          {mascota ? (
            <div className="mascota-elegida">
              <span className="icono-circulo">
                <IconoEspecie especie={mascota.especie} size={22} />
              </span>
              <span>
                <strong>{mascota.nombre}</strong>
                <span>de {mascota.dueno}</span>
              </span>
              <button type="button" className="boton-texto enlace-chico" onClick={() => setMascota(null)}>
                Cambiar
              </button>
            </div>
          ) : (
            <BuscadorMascota alElegir={setMascota} />
          )}
        </section>

        {/* ---------- Servicio ---------- */}
        {mascota && (
          <section className="tarjeta formulario">
            <h2>Servicio</h2>
            <div className="chips">
              {servicios.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`chip chip-grande${servicio?.id === s.id ? ' chip-activo' : ''}`}
                  aria-pressed={servicio?.id === s.id}
                  onClick={() => {
                    // La hora elegida se mantiene si también está libre para este servicio.
                    setServicio(s)
                    setLibres(null)
                  }}
                >
                  {s.nombre} ({s.duracionMin} min)
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ---------- Día y horario ---------- */}
        {mascota && servicio && (
          <section className="tarjeta formulario">
            <h2>Día y horario</h2>
            <label className="campo campo-fecha">
              Día
              <input
                type="date"
                value={fecha}
                min={hoyArgentina()}
                onChange={(e) => {
                  setFecha(e.target.value)
                  setHora(null)
                  setLibres(null)
                }}
                required
              />
              {fecha && <span className="ayuda">{diaAmigable(fecha) === diaLargo(fecha) ? diaLargo(fecha) : `${diaAmigable(fecha)}, ${diaLargo(fecha)}`}</span>}
            </label>

            {!sobreturno && (
              <>
                {libres === null ? (
                  <p className="cargando">Buscando horarios libres…</p>
                ) : libres.length === 0 ? (
                  // Sin lugar ese día: se ofrece pasar al siguiente con un toque.
                  <div className="sin-horarios">
                    <p className="vacio">No quedan horarios libres ese día (o la clínica no atiende).</p>
                    <button
                      type="button"
                      className="boton boton-contorno"
                      onClick={() => {
                        setFecha(sumarDias(fecha, 1))
                        setHora(null)
                        setLibres(null)
                      }}
                    >
                      Ver el día siguiente
                    </button>
                  </div>
                ) : (
                  <div className="chips">
                    {libres.map((h) => (
                      <button
                        key={h}
                        type="button"
                        className={`chip chip-grande${hora === h ? ' chip-activo' : ''}`}
                        aria-pressed={hora === h}
                        onClick={() => setHora(h)}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            <label className="casilla">
              <input
                type="checkbox"
                checked={sobreturno}
                onChange={(e) => {
                  setSobreturno(e.target.checked)
                  setHora(null)
                }}
              />
              Agregar como sobreturno (aunque el horario esté ocupado)
            </label>
            {sobreturno && (
              <label className="campo campo-fecha">
                Hora del sobreturno
                <input type="time" step={300} onChange={(e) => setHora(e.target.value || null)} required />
              </label>
            )}
          </section>
        )}

        {/* ---------- Detalles ---------- */}
        {mascota && servicio && hora && (
          <section className="tarjeta formulario">
            <h2>¿Cómo lo pidió?</h2>
            <div className="chips">
              {(
                [
                  ['TELEFONO', 'Por teléfono'],
                  ['MOSTRADOR', 'En el mostrador'],
                ] as const
              ).map(([v, t]) => (
                <button
                  key={v}
                  type="button"
                  className={`chip chip-grande${origen === v ? ' chip-activo' : ''}`}
                  aria-pressed={origen === v}
                  onClick={() => setOrigen(v)}
                >
                  {t}
                </button>
              ))}
            </div>
            <label className="campo">
              Motivo o nota (opcional)
              <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} maxLength={500} />
            </label>
          </section>
        )}

        {error && (
          <p className="mensaje-error" role="alert">
            {error}
          </p>
        )}

        {/* Mientras falte el horario, se dice qué falta (el botón aparece al elegirlo) */}
        {mascota && servicio && !hora && (
          <p className="ayuda falta-horario">Elegí un horario para poder dar el turno.</p>
        )}

        {mascota && servicio && hora && (
          <div className="formulario-botones">
            <button type="submit" className="boton boton-grande" disabled={guardando}>
              {guardando ? 'Guardando…' : `Dar turno a ${mascota.nombre} a las ${hora}`}
            </button>
          </div>
        )}
      </form>
    </>
  )
}

// Busca clientes y muestra sus mascotas para elegir una.
function BuscadorMascota({ alElegir }: { alElegir: (m: MascotaElegida) => void }) {
  const [texto, setTexto] = useState('')
  const [clientes, setClientes] = useState<Cliente[]>([])
  // Las mascotas con turno hoy: muchas veces piden el próximo turno al salir de la consulta.
  const [deHoy, setDeHoy] = useState<MascotaElegida[]>([])

  useEffect(() => {
    const hoy = hoyArgentina()
    apiGet<Turno[]>(`/turnos?desde=${hoy}&hasta=${hoy}`)
      .then((turnos) => {
        const vistas = new Set<number>()
        const lista: MascotaElegida[] = []
        for (const t of turnos) {
          if (t.estado === 'CANCELADO' || vistas.has(t.mascota.id)) continue
          vistas.add(t.mascota.id)
          const c = t.mascota.cliente
          lista.push({ id: t.mascota.id, nombre: t.mascota.nombre, especie: t.mascota.especie, dueno: `${c.nombre} ${c.apellido}` })
        }
        setDeHoy(lista)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (texto.trim().length < 2) return
    const espera = window.setTimeout(() => {
      apiGet<Cliente[]>(`/clientes?q=${encodeURIComponent(texto.trim())}`).then(setClientes)
    }, 300)
    return () => window.clearTimeout(espera)
  }, [texto])

  const resultados = texto.trim().length < 2 ? [] : clientes

  return (
    <>
      <label className="buscador">
        <Search size={22} aria-hidden="true" />
        <span className="solo-lectores">Buscar mascota o dueño</span>
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Nombre de la mascota, del dueño o teléfono"
          autoFocus
        />
      </label>
      {resultados.length > 0 && (
        <ul className="resultados-mascota">
          {resultados.flatMap((c) =>
            c.mascotas.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className="mascota-fila"
                  onClick={() => alElegir({ id: m.id, nombre: m.nombre, especie: m.especie, dueno: `${c.nombre} ${c.apellido}` })}
                >
                  <span className="icono-circulo">
                    <IconoEspecie especie={m.especie} size={22} />
                  </span>
                  <span>
                    <strong>{m.nombre}</strong>
                    <span className="mascota-fila-detalle">
                      de {c.nombre} {c.apellido}, {formatearTelefono(c.telefono)}
                    </span>
                  </span>
                  <span className="mascota-fila-ver">Elegir</span>
                </button>
              </li>
            )),
          )}
        </ul>
      )}
      {texto.trim().length >= 2 && resultados.length === 0 && <p className="vacio">No encontramos a nadie con ese dato.</p>}
      {texto.trim().length < 2 && deHoy.length > 0 && (
        <>
          <p className="buscador-subtitulo">O elegí una de las que tienen turno hoy:</p>
          <ul className="resultados-mascota">
            {deHoy.map((m) => (
              <li key={m.id}>
                <button type="button" className="mascota-fila" onClick={() => alElegir(m)}>
                  <span className="icono-circulo">
                    <IconoEspecie especie={m.especie} size={22} />
                  </span>
                  <span>
                    <strong>{m.nombre}</strong>
                    <span className="mascota-fila-detalle">de {m.dueno}</span>
                  </span>
                  <span className="mascota-fila-ver">Elegir</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <Link to="/panel/clientes/nuevo" className="boton-texto enlace-chico">
        <Plus size={16} aria-hidden="true" /> ¿Es un cliente nuevo? Cargalo primero
      </Link>
    </>
  )
}
