import { ArrowLeft, ArrowRight, Ban, CircleCheck, MapPin, MessageCircle } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiGet, apiPost, ErrorApi } from '../lib/api'
import { diaAmigable, diaCorto, diaLargo, fechaCortaDe, partesDeFecha } from '../lib/fechas'
import { enlaceWhatsapp, MENSAJE_TURNO, useSitio } from '../lib/sitio'
import type { DatosMiCuenta, EspecieMascota, Servicio } from '../types'
import { Cargando } from '../components/Cargando'

// Por día, todos los horarios de atención: los ocupados se muestran tachados.
type Disponibilidad = Record<string, { hora: string; libre: boolean }[]>

// Nombre de cada paso, debajo de la barra de avance: así se sabe qué viene después.
const NOMBRES_PASOS = ['Servicio', 'Día', 'Hora', 'Mascota']

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
          <Cargando />
        </section>
      </main>
    )
  }

  if (!usuario) {
    return (
      <main className="fondo-huellas">
        <section className="contenedor seccion">
          <div className="turno-listo turno-acceso">
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

// Los cuatro pasos (servicio, día, horario y mascota), de a uno por pantalla, con una barra de avance.
// Al elegir algo se pasa solo al paso siguiente; "Volver" deja cambiar lo elegido.
// Si viene de una tarjeta de servicios, solo muestra esa categoría; si tiene un solo servicio, ya queda elegido.
function PedirTurno({ categoria }: { categoria: string | null }) {
  const { datos: sitio } = useSitio()
  const [servicios, setServicios] = useState<Servicio[] | null>(null)
  const [servicio, setServicio] = useState<Servicio | null>(null)
  const [disponibilidad, setDisponibilidad] = useState<Disponibilidad | null>(null)
  const [dia, setDia] = useState<string | null>(null)
  const [hora, setHora] = useState<string | null>(null)
  const [paso, setPaso] = useState(1)
  const [confirmado, setConfirmado] = useState<{ dia: string; hora: string; servicio: string; mascota: string } | null>(
    null,
  )
  // Si la clínica lo suspendió para turnos web, se avisa de entrada (no tiene sentido completar los pasos).
  const [suspendidoHasta, setSuspendidoHasta] = useState<string | null>(null)
  const titulo = useRef<HTMLHeadingElement>(null)

  // Al cambiar de paso, el título del paso nuevo queda a la vista y con el foco (para lectores de pantalla y teclado).
  function irAPaso(n: number) {
    setPaso(n)
    window.setTimeout(() => {
      titulo.current?.focus({ preventScroll: true })
      window.scrollTo({ top: 0 })
    }, 0)
  }

  useEffect(() => {
    apiGet<Servicio[]>('/publico/turnos/servicios')
      .then((lista) => {
        setServicios(lista)
        const deLaCategoria = lista.filter((s) => s.categoria === categoria)
        if (deLaCategoria.length === 1) elegirServicio(deLaCategoria[0])
      })
      .catch(() => setServicios([]))
    apiGet<DatosMiCuenta>('/mi-cuenta')
      .then((d) => setSuspendidoHasta(d.suspendidoHasta ?? null))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function elegirServicio(s: Servicio) {
    if (servicio?.id !== s.id) {
      setServicio(s)
      setDia(null)
      setHora(null)
      setDisponibilidad(null)
      apiGet<Disponibilidad>(`/publico/turnos/disponibilidad?servicioId=${s.id}`).then(setDisponibilidad)
    }
    irAPaso(2)
  }

  function elegirDia(d: string) {
    if (d !== dia) setHora(null)
    setDia(d)
    irAPaso(3)
  }

  function elegirHora(h: string) {
    setHora(h)
    irAPaso(4)
  }

  // Si otra persona tomó el horario mientras completaba los datos, vuelve a elegir la hora.
  async function recargarHorarios() {
    if (!servicio) return
    setHora(null)
    setDisponibilidad(await apiGet<Disponibilidad>(`/publico/turnos/disponibilidad?servicioId=${servicio.id}`))
    irAPaso(3)
  }

  if (suspendidoHasta) {
    return (
      <main className="fondo-huellas">
        <section className="contenedor seccion">
          <div className="turno-listo turno-acceso">
            <Ban size={56} aria-hidden="true" />
            <h1>Por ahora, los turnos se piden por WhatsApp</h1>
            <p className="turno-listo-detalle">
              Como se cancelaron varios turnos seguidos, hasta el {fechaCortaDe(suspendidoHasta)} no podés sacar turnos
              por la web. Escribinos y te damos uno.
            </p>
            {sitio && (
              <a
                href={enlaceWhatsapp(sitio.clinica.whatsapp, MENSAJE_TURNO)}
                target="_blank"
                rel="noreferrer"
                className="boton boton-whatsapp boton-grande"
              >
                <MessageCircle size={22} aria-hidden="true" /> Pedir turno por WhatsApp
              </a>
            )}
          </div>
        </section>
      </main>
    )
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
            {sitio && <p className="turno-listo-direccion">Te esperamos en {sitio.clinica.direccion}.</p>}
            <div className="turno-listo-botones">
              <Link to="/mi-cuenta" className="boton boton-grande">
                Ver mis turnos
              </Link>
              {sitio && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${sitio.clinica.latitud},${sitio.clinica.longitud}`}
                  target="_blank"
                  rel="noreferrer"
                  className="boton boton-grande boton-contorno"
                >
                  <MapPin size={20} aria-hidden="true" /> Cómo llegar
                </a>
              )}
            </div>
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

  // Lo ya elegido, en una línea, al lado de la barra de avance
  const elegido = [servicio?.nombre, paso > 2 && dia ? diaCorto(dia) : null, paso > 3 ? hora : null]
    .filter(Boolean)
    .join(' · ')

  // Volver al paso anterior y, si ya había algo elegido en este paso, seguir sin volver a tocarlo
  const puedeSeguir = (paso === 1 && servicio) || (paso === 2 && dia) || (paso === 3 && hora)
  const navegacion = (
    <div className="paso-navegacion">
      {paso > 1 && (
        <button type="button" className="boton boton-contorno" onClick={() => irAPaso(paso - 1)}>
          <ArrowLeft size={20} aria-hidden="true" /> Volver
        </button>
      )}
      {puedeSeguir && (
        <button type="button" className="boton paso-siguiente" onClick={() => irAPaso(paso + 1)}>
          Siguiente <ArrowRight size={20} aria-hidden="true" />
        </button>
      )}
    </div>
  )

  return (
    <main className="fondo-huellas">
      <section className="contenedor seccion sacar-turno">
        <h1>Pedir turno</h1>

        {/* ---------- Barra de avance ---------- */}
        <div className="avance">
          <p className="avance-texto">
            <strong>Paso {paso} de 4</strong>
            {elegido && <span>{elegido}</span>}
          </p>
          <div className="avance-barra" aria-hidden="true">
            {[1, 2, 3, 4].map((n) => (
              <span key={n} className={n <= paso ? 'hecho' : undefined} />
            ))}
          </div>
          <ol className="avance-pasos" aria-hidden="true">
            {NOMBRES_PASOS.map((nombre, i) => (
              <li key={nombre} className={i + 1 === paso ? 'actual' : i + 1 < paso ? 'hecho' : undefined}>
                {nombre}
              </li>
            ))}
          </ol>
        </div>

        {/* ---------- 1. Servicio ---------- */}
        {paso === 1 && (
          <section className="paso" aria-labelledby="paso-1">
            <h2 id="paso-1" ref={titulo} tabIndex={-1}>
              ¿Qué necesita tu mascota?
            </h2>
            {servicios === null ? (
              <Cargando />
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
                    <span>{s.duracionMin} min</span>
                  </button>
                ))}
              </div>
            )}
            <p className="ayuda">
              {deLaCategoria.length > 0 ? (
                <Link to="/turno">Ver todos los servicios</Link>
              ) : (
                <>
                  ¿Necesitás una <Link to="/cirugias">cirugía</Link> o una <Link to="/limpieza-dental">limpieza dental</Link>?
                  Se coordinan con la clínica.
                </>
              )}
            </p>
            {navegacion}
          </section>
        )}

        {/* ---------- 2. Día ---------- */}
        {paso === 2 && servicio && (
          <section className="paso" aria-labelledby="paso-2">
            <h2 id="paso-2" ref={titulo} tabIndex={-1}>
              ¿Qué día?
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
              // Cada día como una hojita de calendario: día de la semana, número grande y mes
              <div className="dias-calendario">
                {diasConLugar.map(([d]) => {
                  const { semana, numero, mes } = partesDeFecha(d)
                  const amigable = diaAmigable(d)
                  return (
                    <button
                      key={d}
                      type="button"
                      className={`dia-hoja${dia === d ? ' elegida' : ''}`}
                      aria-pressed={dia === d}
                      aria-label={amigable === 'Hoy' || amigable === 'Mañana' ? `${amigable}, ${diaLargo(d)}` : diaLargo(d)}
                      onClick={() => elegirDia(d)}
                    >
                      <span>{amigable === 'Hoy' || amigable === 'Mañana' ? amigable : semana}</span>
                      <strong>{numero}</strong>
                      <span>{mes}</span>
                    </button>
                  )
                })}
              </div>
            )}
            {navegacion}
          </section>
        )}

        {/* ---------- 3. Horario ---------- */}
        {paso === 3 && dia && (
          <section className="paso" aria-labelledby="paso-3">
            <h2 id="paso-3" ref={titulo} tabIndex={-1}>
              ¿A qué hora?
            </h2>
            {horas.some((h) => !h.libre) && <p className="ayuda">Los horarios tachados ya están ocupados.</p>}
            {/* Cuadritos en grilla, por la mañana y por la tarde, con cuántos quedan libres */}
            {(
              [
                ['Mañana', maniana],
                ['Tarde', tarde],
              ] as const
            ).map(([nombre, lista]) => {
              if (lista.length === 0) return null
              const libres = lista.filter((h) => h.libre).length
              return (
                <div key={nombre} className="grupo-horarios">
                  <h3>
                    {nombre}
                    <span>
                      · {libres} {libres === 1 ? 'libre' : 'libres'}
                    </span>
                  </h3>
                  <div className="grilla-horarios">
                    {lista.map((h) =>
                      h.libre ? (
                        <button
                          key={h.hora}
                          type="button"
                          className={`hora-cuadro${hora === h.hora ? ' elegida' : ''}`}
                          aria-pressed={hora === h.hora}
                          onClick={() => elegirHora(h.hora)}
                        >
                          {h.hora}
                        </button>
                      ) : (
                        <span key={h.hora} className="hora-cuadro hora-ocupada">
                          <s>{h.hora}</s>
                          <span className="solo-lectores"> (ocupado)</span>
                        </span>
                      ),
                    )}
                  </div>
                </div>
              )
            })}
            {navegacion}
          </section>
        )}

        {/* ---------- 4. Datos ---------- */}
        {paso === 4 && servicio && dia && hora && (
          <section className="paso" aria-labelledby="paso-4">
            <h2 id="paso-4" ref={titulo} tabIndex={-1}>
              ¿Para quién es?
            </h2>
            <div className="resumen-turno">
              <p className="resumen-turno-titulo">Tu turno</p>
              <dl>
                {(
                  [
                    ['Servicio', servicio.nombre, 1],
                    ['Día', diaLargo(dia), 2],
                    ['Hora', hora, 3],
                  ] as const
                ).map(([nombre, valor, n]) => (
                  <div key={nombre} className="resumen-turno-fila">
                    <dt>{nombre}</dt>
                    <dd>{valor}</dd>
                    <button type="button" className="boton-texto" onClick={() => irAPaso(n)}>
                      Cambiar<span className="solo-lectores"> {nombre.toLowerCase()}</span>
                    </button>
                  </div>
                ))}
              </dl>
            </div>
            <FormularioDatos
              servicio={servicio}
              dia={dia}
              hora={hora}
              alConfirmar={setConfirmado}
              alPerderHorario={recargarHorarios}
              alVolver={() => irAPaso(3)}
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
  alVolver,
}: {
  servicio: Servicio
  dia: string
  hora: string
  alConfirmar: (d: { dia: string; hora: string; servicio: string; mascota: string }) => void
  alPerderHorario: () => void
  alVolver: () => void
}) {
  const { salir } = useAuth()
  const [mascotas, setMascotas] = useState<{ id: number; nombre: string }[] | null>(null)
  const [elegida, setElegida] = useState<number | 'nueva' | null>(null)
  const [mascota, setMascota] = useState('')
  const [especie, setEspecie] = useState<EspecieMascota>('PERRO')
  const [otraEspecie, setOtraEspecie] = useState('')
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
        mascota:
          elegida === 'nueva'
            ? { nombre: mascota, especie, otraEspecie: especie === 'OTRO' ? otraEspecie : undefined }
            : { id: elegida },
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

  if (mascotas === null) return <Cargando />

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
          {especie === 'OTRO' && (
            <label className="campo">
              ¿Qué animal es?
              <input
                value={otraEspecie}
                onChange={(e) => setOtraEspecie(e.target.value)}
                required
                maxLength={60}
                placeholder="Ej.: conejo, tortuga, hurón"
              />
            </label>
          )}
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
      <div className="paso-navegacion">
        <button type="button" className="boton boton-contorno" onClick={alVolver}>
          <ArrowLeft size={20} aria-hidden="true" /> Volver
        </button>
        <button type="submit" className="boton boton-grande paso-siguiente" disabled={enviando}>
          {enviando ? 'Pidiendo turno…' : 'Pedir turno'}
        </button>
      </div>
      <p className="ayuda">El día anterior te llega un recordatorio al WhatsApp de tu cuenta.</p>
    </form>
  )
}
