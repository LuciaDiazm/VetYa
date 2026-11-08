import { CalendarCheck, CircleCheck, Clock, MessageCircle, UserRound } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiGet, apiPost, ErrorApi } from '../lib/api'
import { diaAmigable, diaCorto, diaLargo } from '../lib/fechas'
import { enlaceWhatsapp, MENSAJE_TURNO, useSitio } from '../lib/sitio'
import type { DatosMiCuenta, EspecieMascota, Servicio } from '../types'

// Por día, todos los horarios de atención: los ocupados se muestran tachados.
type Disponibilidad = Record<string, { hora: string; libre: boolean }[]>

// Pedir turno online exige cuenta: sin sesión se invita a crearla (o a pedirlo por WhatsApp).
export function SacarTurno() {
  const { usuario, cargando } = useAuth()
  const { datos: sitio } = useSitio()
  const { pathname, search } = useLocation()
  const [parametros] = useSearchParams()
  const categoria = parametros.get('categoria')
  // Al registrarse o ingresar vuelve acá, con la misma categoría que había elegido.
  const volverA = { desde: pathname + search }

  if (cargando) {
    return (
      <main className="fondo-huellas">
        <section className="contenedor seccion">
          <p className="cargando">Cargando…</p>
        </section>
      </main>
    )
  }

  if (!usuario) {
    return (
      <main className="fondo-huellas">
        <section className="contenedor seccion">
          <div className="turno-listo turno-acceso">
            <UserRound size={56} aria-hidden="true" />
            <h1>Para pedir turno necesitás tu cuenta</h1>
            <p className="turno-listo-detalle">
              Se crea una sola vez. Si ya viniste a la clínica, usá el mismo teléfono y vas a ver a tus mascotas.
            </p>
            <div className="turno-acceso-botones">
              <Link to="/registro" state={volverA} className="boton boton-grande">
                Crear mi cuenta
              </Link>
              <Link to="/ingresar" state={volverA} className="boton boton-contorno boton-grande">
                Ya tengo cuenta
              </Link>
            </div>
            {sitio && (
              <p className="alternativa-whatsapp">
                ¿Preferís hablar con alguien?{' '}
                <a href={enlaceWhatsapp(sitio.clinica.whatsapp, MENSAJE_TURNO)} target="_blank" rel="noreferrer">
                  Pedilo por WhatsApp
                </a>
              </p>
            )}
          </div>
        </section>
      </main>
    )
  }

  if (usuario.rol !== 'DUENIO') {
    return (
      <main className="fondo-huellas">
        <section className="contenedor seccion">
          <div className="turno-listo turno-acceso">
            <UserRound size={56} aria-hidden="true" />
            <h1>Entraste con una cuenta de la clínica</h1>
            <p className="turno-listo-detalle">Los turnos de los clientes se cargan desde el panel.</p>
            <Link to="/panel/agenda/nuevo" className="boton boton-grande">
              Dar turno
            </Link>
          </div>
        </section>
      </main>
    )
  }

  return <PedirTurno key={categoria ?? 'todos'} categoria={categoria} />
}

// Los cuatro pasos: servicio, día, horario y mascota.
// Si viene de una tarjeta de servicios, solo muestra esa categoría; si tiene un solo servicio, ya queda elegido.
function PedirTurno({ categoria }: { categoria: string | null }) {
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
    apiGet<Servicio[]>('/publico/turnos/servicios')
      .then((lista) => {
        setServicios(lista)
        const deLaCategoria = lista.filter((s) => s.categoria === categoria)
        if (deLaCategoria.length === 1) elegirServicio(deLaCategoria[0])
      })
      .catch(() => setServicios([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            <h1>¡Listo! Tu turno está confirmado</h1>
            <p className="turno-listo-detalle">
              <strong>{confirmado.servicio}</strong> para <strong>{confirmado.mascota}</strong>
              <br />
              {diaAmigable(confirmado.dia) === diaLargo(confirmado.dia)
                ? `El ${diaLargo(confirmado.dia)}`
                : `${diaAmigable(confirmado.dia)}, ${diaLargo(confirmado.dia)}`}{' '}
              a las <strong>{confirmado.hora}</strong>
            </p>
            <p>Te vamos a recordar por WhatsApp el día anterior. Si no podés venir, avisanos con tiempo.</p>
            <Link to="/mi-cuenta" className="boton boton-grande">
              Ver mis turnos
            </Link>
          </div>
        </section>
      </main>
    )
  }

  const deLaCategoria = servicios?.filter((s) => s.categoria === categoria) ?? []
  const serviciosVisibles = deLaCategoria.length > 0 ? deLaCategoria : servicios ?? []
  const diasConLugar = disponibilidad ? Object.entries(disponibilidad).filter(([, horas]) => horas.some((h) => h.libre)) : []
  const horas = dia && disponibilidad ? disponibilidad[dia] ?? [] : []
  const maniana = horas.filter((h) => h.hora < '13:00')
  const tarde = horas.filter((h) => h.hora >= '13:00')

  return (
    <main className="fondo-huellas">
      <section className="contenedor seccion sacar-turno">
        <h1>Pedir turno</h1>
        <p className="ayuda-grande">Elegí el servicio, el día y el horario.</p>

        {/* ---------- 1. Servicio ---------- */}
        <section className="paso" aria-labelledby="paso-1">
          <h2 id="paso-1">
            <span className="paso-numero">1</span> ¿Qué necesita tu mascota?
          </h2>
          {servicios === null ? (
            <p className="cargando">Cargando…</p>
          ) : (
            <div className="opciones-servicio">
              {serviciosVisibles.map((s) => (
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
            {deLaCategoria.length > 0 ? (
              <Link to="/turno">Ver todos los servicios</Link>
            ) : (
              <>
                ¿Necesitás una cirugía o una limpieza dental? <Link to="/cirugias">Mirá cómo se coordinan</Link>
              </>
            )}
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
              <p className="vacio">
                No hay turnos libres en las próximas dos semanas.{' '}
                {sitio && (
                  <a href={enlaceWhatsapp(sitio.clinica.whatsapp, MENSAJE_TURNO)} target="_blank" rel="noreferrer">
                    Escribinos por WhatsApp
                  </a>
                )}
              </p>
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
            {horas.some((h) => !h.libre) && <p className="ayuda">Los horarios tachados ya están ocupados.</p>}
            {[
              ['Mañana', maniana],
              ['Tarde', tarde],
            ].map(([titulo, lista]) =>
              (lista as Disponibilidad[string]).length === 0 ? null : (
                <div key={titulo as string} className="grupo-horarios">
                  <h3>{titulo as string}</h3>
                  <div className="chips">
                    {(lista as Disponibilidad[string]).map((h) =>
                      h.libre ? (
                        <button
                          key={h.hora}
                          type="button"
                          className={`chip chip-grande${hora === h.hora ? ' chip-activo' : ''}`}
                          aria-pressed={hora === h.hora}
                          onClick={() => {
                            setHora(h.hora)
                            bajarA(pasoDatos)
                          }}
                        >
                          {h.hora}
                        </button>
                      ) : (
                        <span key={h.hora} className="chip chip-grande chip-ocupado">
                          <s>{h.hora}</s>
                          <span className="solo-lectores"> (ocupado)</span>
                        </span>
                      ),
                    )}
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
              <span className="paso-numero">4</span> ¿Para quién es?
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

// La pregunta del comentario cambia según el servicio: "¿Qué le pasa?" no tiene sentido para un baño.
function textosMotivo(servicio: Servicio): { titulo: string; ejemplo: string } {
  const nombre = servicio.nombre.toLowerCase()
  if (servicio.categoria === 'ESTETICA') {
    return { titulo: '¿Algo que tengamos que saber?', ejemplo: 'Ej.: corte cortito, es miedoso, tiene la piel sensible…' }
  }
  if (servicio.categoria === 'DIAGNOSTICO') {
    return { titulo: '¿Algo que quieras contarnos?', ejemplo: 'Ej.: me lo pidió el veterinario, viene en ayunas…' }
  }
  if (nombre.includes('vacun') || nombre.includes('desparasit')) {
    return { titulo: '¿Algo que quieras contarnos?', ejemplo: 'Ej.: es la primera vez, la última fue en marzo…' }
  }
  return { titulo: '¿Qué le pasa?', ejemplo: 'Ej.: se rasca mucho, no come, control anual…' }
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
  const { salir } = useAuth()
  const [mascotas, setMascotas] = useState<{ id: number; nombre: string }[] | null>(null)
  const [elegida, setElegida] = useState<number | 'nueva' | null>(null)
  const [mascota, setMascota] = useState('')
  const [especie, setEspecie] = useState<EspecieMascota>('PERRO')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  // Con una sola mascota ya queda elegida; sin ninguna, directamente se carga una nueva.
  useEffect(() => {
    apiGet<DatosMiCuenta>('/mi-cuenta')
      .then((d) => {
        setMascotas(d.mascotas)
        setElegida(d.mascotas.length === 0 ? 'nueva' : d.mascotas.length === 1 ? d.mascotas[0].id : null)
      })
      .catch(() => {
        setMascotas([])
        setElegida('nueva')
      })
  }, [])

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (elegida === null) {
      setError('Elegí para qué mascota es el turno')
      return
    }
    setError(null)
    setEnviando(true)
    try {
      await apiPost('/publico/turnos', {
        servicioId: servicio.id,
        fecha: dia,
        hora,
        mascota: elegida === 'nueva' ? { nombre: mascota, especie } : { id: elegida },
        motivo: motivo || undefined,
      })
      const nombreMascota = elegida === 'nueva' ? mascota : mascotas?.find((m) => m.id === elegida)?.nombre ?? ''
      alConfirmar({ dia, hora, servicio: servicio.nombre, mascota: nombreMascota })
    } catch (err) {
      // Si la sesión venció, vuelve a la pantalla que pide entrar con la cuenta.
      if (err instanceof ErrorApi && err.status === 401) {
        salir()
        return
      }
      setError(err instanceof Error ? err.message : 'No se pudo pedir el turno')
      // Si otra persona tomó el horario, se actualizan los horarios libres.
      if (err instanceof Error && err.message.includes('no está disponible')) alPerderHorario()
    } finally {
      setEnviando(false)
    }
  }

  if (mascotas === null) return <p className="cargando">Cargando…</p>

  return (
    <form className="formulario" onSubmit={enviar}>
      {mascotas.length > 0 && (
        <div className="chips">
          {mascotas.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`chip chip-grande${elegida === m.id ? ' chip-activo' : ''}`}
              aria-pressed={elegida === m.id}
              onClick={() => setElegida(m.id)}
            >
              {m.nombre}
            </button>
          ))}
          <button
            type="button"
            className={`chip chip-grande${elegida === 'nueva' ? ' chip-activo' : ''}`}
            aria-pressed={elegida === 'nueva'}
            onClick={() => setElegida('nueva')}
          >
            Otra mascota
          </button>
        </div>
      )}
      {elegida === 'nueva' && (
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
      )}
      <label className="campo">
        {textosMotivo(servicio).titulo} (opcional)
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder={textosMotivo(servicio).ejemplo}
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
        <MessageCircle size={16} aria-hidden="true" /> El día anterior te llega un recordatorio al WhatsApp de tu cuenta.
      </p>
    </form>
  )
}
