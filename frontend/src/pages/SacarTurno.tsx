import { CalendarCheck, CircleCheck, Clock, MessageCircle } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiGet, apiPost } from '../lib/api'
import { diaAmigable, diaCorto, diaLargo } from '../lib/fechas'
import { enlaceWhatsapp, MENSAJE_TURNO, useSitio } from '../lib/sitio'
import type { EspecieMascota, Servicio } from '../types'

type Disponibilidad = Record<string, string[]>

// Pedir turno online en cuatro pasos, sin cuenta: servicio, día, horario y datos.
export function SacarTurno() {
  const { datos: sitio } = useSitio()
  const [servicios, setServicios] = useState<Servicio[] | null>(null)
  const [servicio, setServicio] = useState<Servicio | null>(null)
  const [disponibilidad, setDisponibilidad] = useState<Disponibilidad | null>(null)
  const [dia, setDia] = useState<string | null>(null)
  const [hora, setHora] = useState<string | null>(null)
  const [confirmado, setConfirmado] = useState<{ dia: string; hora: string; servicio: string; mascota: string } | null>(
    null,
  )

  const pasoDia = useRef<HTMLElement>(null)
  const pasoHora = useRef<HTMLElement>(null)
  const pasoDatos = useRef<HTMLElement>(null)
  const bajarA = (paso: React.RefObject<HTMLElement | null>) =>
    window.setTimeout(() => paso.current?.scrollIntoView({ block: 'start' }), 50)

  useEffect(() => {
    apiGet<Servicio[]>('/publico/turnos/servicios').then(setServicios).catch(() => setServicios([]))
  }, [])

  function elegirServicio(s: Servicio) {
    setServicio(s)
    setDia(null)
    setHora(null)
    setDisponibilidad(null)
    apiGet<Disponibilidad>(`/publico/turnos/disponibilidad?servicioId=${s.id}`).then((d) => {
      setDisponibilidad(d)
      bajarA(pasoDia)
    })
  }

  async function recargarHorarios() {
    if (!servicio) return
    setHora(null)
    setDisponibilidad(await apiGet<Disponibilidad>(`/publico/turnos/disponibilidad?servicioId=${servicio.id}`))
  }

  if (confirmado) {
    return (
      <main className="fondo-huellas">
        <section className="contenedor seccion">
          <div className="turno-listo">
            <CircleCheck size={56} aria-hidden="true" />
            <h1>¡Listo! Tu turno quedó pedido</h1>
            <p className="turno-listo-detalle">
              <strong>{confirmado.servicio}</strong> para <strong>{confirmado.mascota}</strong>
              <br />
              {diaAmigable(confirmado.dia) === diaLargo(confirmado.dia)
                ? `El ${diaLargo(confirmado.dia)}`
                : `${diaAmigable(confirmado.dia)}, ${diaLargo(confirmado.dia)}`}{' '}
              a las <strong>{confirmado.hora}</strong>
            </p>
            <p>La clínica te va a confirmar por WhatsApp. Si no podés venir, avisanos con tiempo.</p>
            <Link to="/" className="boton boton-grande">
              Volver al inicio
            </Link>
          </div>
        </section>
      </main>
    )
  }

  const diasConLugar = disponibilidad ? Object.entries(disponibilidad).filter(([, horas]) => horas.length > 0) : []
  const horas = dia && disponibilidad ? disponibilidad[dia] ?? [] : []
  const maniana = horas.filter((h) => h < '13:00')
  const tarde = horas.filter((h) => h >= '13:00')

  return (
    <main className="fondo-huellas">
      <section className="contenedor seccion sacar-turno">
        <h1>Pedir turno</h1>
        <p className="ayuda-grande">Elegí el servicio, el día y el horario. No hace falta crear una cuenta.</p>
        {sitio && (
          <p className="alternativa-whatsapp">
            ¿Preferís hablar con alguien?{' '}
            <a href={enlaceWhatsapp(sitio.clinica.whatsapp, MENSAJE_TURNO)} target="_blank" rel="noreferrer">
              Pedilo por WhatsApp
            </a>
          </p>
        )}

        {/* ---------- 1. Servicio ---------- */}
        <section className="paso" aria-labelledby="paso-1">
          <h2 id="paso-1">
            <span className="paso-numero">1</span> ¿Qué necesita tu mascota?
          </h2>
          {servicios === null ? (
            <p className="cargando">Cargando…</p>
          ) : (
            <div className="opciones-servicio">
              {servicios.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`opcion-servicio${servicio?.id === s.id ? ' elegida' : ''}`}
                  aria-pressed={servicio?.id === s.id}
                  onClick={() => elegirServicio(s)}
                >
                  <strong>{s.nombre}</strong>
                  <span>
                    <Clock size={16} aria-hidden="true" /> {s.duracionMin} min
                  </span>
                </button>
              ))}
            </div>
          )}
          <p className="ayuda">
            ¿Necesitás una cirugía o una limpieza dental? Esas se coordinan directamente con la clínica.
          </p>
        </section>

        {/* ---------- 2. Día ---------- */}
        {servicio && (
          <section className="paso" aria-labelledby="paso-2" ref={pasoDia}>
            <h2 id="paso-2">
              <span className="paso-numero">2</span> ¿Qué día?
            </h2>
            {!disponibilidad ? (
              <p className="cargando">Buscando días con lugar…</p>
            ) : diasConLugar.length === 0 ? (
              <p className="vacio">No hay turnos libres en las próximas dos semanas. Escribinos por WhatsApp.</p>
            ) : (
              <div className="chips">
                {diasConLugar.map(([d]) => (
                  <button
                    key={d}
                    type="button"
                    className={`chip chip-grande chip-dia${dia === d ? ' chip-activo' : ''}`}
                    aria-pressed={dia === d}
                    onClick={() => {
                      setDia(d)
                      setHora(null)
                      bajarA(pasoHora)
                    }}
                  >
                    {diaAmigable(d) === 'Hoy' || diaAmigable(d) === 'Mañana' ? `${diaAmigable(d)}, ${diaCorto(d)}` : diaCorto(d)}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ---------- 3. Horario ---------- */}
        {dia && (
          <section className="paso" aria-labelledby="paso-3" ref={pasoHora}>
            <h2 id="paso-3">
              <span className="paso-numero">3</span> ¿A qué hora?
            </h2>
            {[
              ['Mañana', maniana],
              ['Tarde', tarde],
            ].map(([titulo, lista]) =>
              (lista as string[]).length === 0 ? null : (
                <div key={titulo as string} className="grupo-horarios">
                  <h3>{titulo as string}</h3>
                  <div className="chips">
                    {(lista as string[]).map((h) => (
                      <button
                        key={h}
                        type="button"
                        className={`chip chip-grande${hora === h ? ' chip-activo' : ''}`}
                        aria-pressed={hora === h}
                        onClick={() => {
                          setHora(h)
                          bajarA(pasoDatos)
                        }}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>
              ),
            )}
          </section>
        )}

        {/* ---------- 4. Datos ---------- */}
        {servicio && dia && hora && (
          <section className="paso" aria-labelledby="paso-4" ref={pasoDatos}>
            <h2 id="paso-4">
              <span className="paso-numero">4</span> Tus datos
            </h2>
            <p className="resumen-turno">
              <CalendarCheck size={22} aria-hidden="true" />
              <span>
                <strong>{servicio.nombre}</strong>, {diaLargo(dia)} a las <strong>{hora}</strong>
              </span>
            </p>
            <FormularioDatos
              servicio={servicio}
              dia={dia}
              hora={hora}
              alConfirmar={setConfirmado}
              alPerderHorario={recargarHorarios}
            />
          </section>
        )}
      </section>
    </main>
  )
}

function FormularioDatos({
  servicio,
  dia,
  hora,
  alConfirmar,
  alPerderHorario,
}: {
  servicio: Servicio
  dia: string
  hora: string
  alConfirmar: (d: { dia: string; hora: string; servicio: string; mascota: string }) => void
  alPerderHorario: () => void
}) {
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [mascota, setMascota] = useState('')
  const [especie, setEspecie] = useState<EspecieMascota>('PERRO')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      await apiPost('/publico/turnos', {
        servicioId: servicio.id,
        fecha: dia,
        hora,
        nombre,
        telefono,
        mascota: { nombre: mascota, especie },
        motivo: motivo || undefined,
      })
      alConfirmar({ dia, hora, servicio: servicio.nombre, mascota })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo pedir el turno')
      // Si otra persona tomó el horario, se actualizan los horarios libres.
      if (err instanceof Error && err.message.includes('no está disponible')) alPerderHorario()
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form className="formulario" onSubmit={enviar}>
      <div className="fila-campos">
        <label className="campo">
          Tu nombre y apellido
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} required autoComplete="name" />
        </label>
        <label className="campo">
          Tu teléfono (WhatsApp)
          <input
            type="tel"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            required
            placeholder="3777 123456"
            autoComplete="tel"
          />
        </label>
      </div>
      <div className="fila-campos">
        <label className="campo">
          Nombre de tu mascota
          <input value={mascota} onChange={(e) => setMascota(e.target.value)} required />
        </label>
        <fieldset className="grupo-filtro">
          <legend>Es un</legend>
          <div className="chips">
            {(
              [
                ['PERRO', 'Perro'],
                ['GATO', 'Gato'],
                ['OTRO', 'Otro'],
              ] as [EspecieMascota, string][]
            ).map(([v, t]) => (
              <button
                key={v}
                type="button"
                className={`chip chip-grande${especie === v ? ' chip-activo' : ''}`}
                aria-pressed={especie === v}
                onClick={() => setEspecie(v)}
              >
                {t}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
      <label className="campo">
        ¿Qué le pasa? (opcional)
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Ej.: control anual, se rasca mucho, no come…"
        />
      </label>
      {error && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="boton boton-grande" disabled={enviando}>
        {enviando ? 'Pidiendo turno…' : 'Pedir turno'}
      </button>
      <p className="ayuda">
        <MessageCircle size={16} aria-hidden="true" /> Te confirmamos por WhatsApp. Si ya viniste antes, usá el mismo
        teléfono.
      </p>
    </form>
  )
}
