import { Bell, CalendarDays, CircleAlert, CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiGet } from '../lib/api'
import { diaDe, diaLargo, horaDe, hoyArgentina, lunesDe, primeroDeMes, saludoSegunHora, sumarDias } from '../lib/fechas'
import { useHoraActual } from '../lib/horaActual'
import { useSitio } from '../lib/sitio'
import type { ResumenRecordatorios, Turno } from '../types'
import { AvisosSuspension } from '../components/AvisosSuspension'
import { FilaTurno } from '../components/FilaTurno'
import { Cargando } from '../components/Cargando'

const NOMBRE_MES = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const DIAS_SEMANA = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']

// Último día del mes que empieza en `primero` (AAAA-MM-01).
function ultimoDelMes(primero: string) {
  const d = new Date(`${primero}T12:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + 1, 0)
  return d.toISOString().slice(0, 10)
}

// Primer día del mes anterior o siguiente.
function moverMes(primero: string, cuanto: number) {
  const d = new Date(`${primero}T12:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + cuanto, 1)
  return d.toISOString().slice(0, 10)
}

// Inicio del panel: lo que hay que hacer hoy, con el equipo y el calendario del mes a la derecha.
export function Panel() {
  const { usuario } = useAuth()
  const { datos: sitio } = useSitio()
  const [hoy] = useState(hoyArgentina)
  const [saludo] = useState(saludoSegunHora)
  const [turnos, setTurnos] = useState<Turno[] | null>(null)
  const [resumen, setResumen] = useState<ResumenRecordatorios | null>(null)
  const ahora = useHoraActual()

  useEffect(() => {
    apiGet<Turno[]>(`/turnos?desde=${hoy}&hasta=${hoy}`)
      .then(setTurnos)
      .catch(() => setTurnos([]))
    apiGet<ResumenRecordatorios>('/recordatorios/resumen').then(setResumen).catch(() => {})
  }, [hoy])

  const activos = (turnos ?? []).filter((t) => t.estado !== 'CANCELADO')
  const porAtender = activos.filter((t) => t.estado === 'PENDIENTE' || t.estado === 'CONFIRMADO')
  const avisos = resumen ? resumen.turnosManana + resumen.dosis + resumen.recuperar : 0
  const equipo = sitio?.equipo ?? []

  const actualizar = (nuevo: Turno) => setTurnos((l) => l?.map((x) => (x.id === nuevo.id ? nuevo : x)) ?? null)

  return (
    <div className="hoy-grilla">
      {/* ---------- Saludo: una franja azul con el día, los turnos y las dos acciones ---------- */}
      <section className="hoy-saludo">
        <div>
          <h1>
            {saludo}, {usuario?.nombre}
          </h1>
          <p>
            <span className="hoy-saludo-dia">{diaLargo(hoy)}</span>
            <span>
              <strong>{activos.length}</strong> {activos.length === 1 ? 'turno' : 'turnos'} en la agenda
            </span>
          </p>
        </div>
        <div className="hoy-saludo-acciones">
          {/* Los avisos están en Notificaciones: acá solo se recuerda que hay */}
          {avisos > 0 && (
            <Link to="/panel/recordatorios" className="hoy-boton-avisos">
              <Bell size={22} aria-hidden="true" />
              {avisos === 1 ? '1 aviso para mandar' : `${avisos} avisos para mandar`}
            </Link>
          )}
          <Link to="/panel/agenda/nuevo" className="boton hoy-boton-turno">
            <CalendarPlus size={22} aria-hidden="true" /> Dar turno
          </Link>
        </div>
      </section>

      {/* Decidir sobre una suspensión le toca al administrador */}
      {usuario?.rol === 'ADMIN' && <AvisosSuspension />}

      {/* Turnos de días anteriores que quedaron sin marcar (nadie dijo si vino o no) */}
      <TurnosSinMarcar hoy={hoy} />

      <div className="hoy-columnas">
        {/* ---------- Turnos de hoy, como tabla ---------- */}
        <section className="hoy-caja hoy-turnos">
          <div className="hoy-caja-titulo">
            <h2>
              <CalendarDays size={22} aria-hidden="true" /> Turnos de hoy
            </h2>
            {turnos && activos.length > 0 && (
              <span className="hoy-faltan">
                {porAtender.length === 0 ? (
                  'Ya atendiste todos'
                ) : (
                  <>
                    Faltan atender <strong>{porAtender.length}</strong>
                  </>
                )}
              </span>
            )}
          </div>
          {turnos === null ? (
            <Cargando />
          ) : activos.length === 0 ? (
            <p className="hoy-vacio">
              No hay turnos para hoy. <Link to="/panel/agenda">Ver la agenda</Link>
            </p>
          ) : (
            <>
              <div className="fila-encabezado" aria-hidden="true">
                <span>Hora</span>
                <span>Mascota</span>
                <span>La trae</span>
                <span>Estado</span>
                <span />
              </div>
              <ul className="filas-turnos">
                {activos.map((t) => (
                  <FilaTurno
                    key={t.id}
                    turno={t}
                    // Igual que en la Agenda: si ya pasó la hora y sigue confirmado, se avisa
                    paso={t.estado === 'CONFIRMADO' && horaDe(t.fechaHoraFin) <= ahora}
                    alCambiar={actualizar}
                  />
                ))}
              </ul>
            </>
          )}
        </section>

        <aside className="hoy-costado" aria-label="Equipo y calendario">
          {/* ---------- Veterinarios: los mismos datos que se muestran en la web ---------- */}
          <section className="hoy-caja">
            <div className="hoy-caja-titulo">
              <h2>Veterinarios</h2>
            </div>
            {equipo.length === 0 ? (
              <p className="hoy-vacio">Todavía no hay veterinarios cargados en Configuración.</p>
            ) : (
              <ul className="hoy-equipo">
                {equipo.map((m) => (
                  <li key={m.id}>
                    {m.fotoUrl ? (
                      <img src={m.fotoUrl} alt="" className="hoy-avatar" loading="lazy" />
                    ) : (
                      <span className="hoy-avatar" aria-hidden="true">
                        {`${m.nombre[0] ?? ''}${m.apellido[0] ?? ''}`.toUpperCase()}
                      </span>
                    )}
                    <div>
                      <strong>
                        {m.nombre} {m.apellido}
                      </strong>
                      {m.especialidad && <span>{m.especialidad}</span>}
                    </div>
                    {m.matricula && <span className="hoy-matricula">{m.matricula}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <CalendarioMes hoy={hoy} />
        </aside>
      </div>
    </div>
  )
}

// Cuántos días para atrás se buscan turnos sin marcar.
const DIAS_PARA_ATRAS = 60

// Aviso de turnos viejos sin marcar. Al tocar "Ver y marcar" se abren, agrupados por día,
// con las mismas tarjetas de siempre para decir si vino o no.
function TurnosSinMarcar({ hoy }: { hoy: string }) {
  const [turnos, setTurnos] = useState<Turno[] | null>(null)
  const [abierto, setAbierto] = useState(false)

  useEffect(() => {
    apiGet<Turno[]>(`/turnos?desde=${sumarDias(hoy, -DIAS_PARA_ATRAS)}&hasta=${sumarDias(hoy, -1)}`)
      // Se guardan solo los que estaban sin marcar; si después se marcan, siguen a la vista hasta recargar.
      .then((t) => setTurnos(t.filter((x) => x.estado === 'CONFIRMADO' || x.estado === 'PENDIENTE')))
      .catch(() => setTurnos([]))
  }, [hoy])

  if (!turnos || turnos.length === 0) return null
  const faltan = turnos.filter((t) => t.estado === 'CONFIRMADO' || t.estado === 'PENDIENTE').length

  // Agrupados por día, del más reciente al más viejo.
  const dias = [...new Set(turnos.map((t) => diaDe(t.fechaHoraInicio)))].sort().reverse()

  return (
    <section className="hoy-caja sin-marcar">
      <div className="sin-marcar-aviso">
        <CircleAlert size={26} aria-hidden="true" />
        <p>
          {faltan === 0 ? (
            <strong>¡Listo! Ya marcaste todos los turnos anteriores.</strong>
          ) : (
            <>
              <strong>
                {faltan === 1
                  ? 'Quedó 1 turno de días anteriores sin marcar.'
                  : `Quedaron ${faltan} turnos de días anteriores sin marcar.`}
              </strong>{' '}
              Contá si vinieron o no, así las estadísticas quedan bien.
            </>
          )}
        </p>
        <button type="button" className="boton boton-contorno" aria-expanded={abierto} onClick={() => setAbierto((a) => !a)}>
          {abierto ? 'Cerrar' : 'Ver y marcar'}
        </button>
      </div>
      {abierto &&
        dias.map((d) => (
          <div key={d} className="sin-marcar-dia">
            <h3>{diaLargo(d)}</h3>
            <ul className="filas-turnos">
              {turnos
                .filter((t) => diaDe(t.fechaHoraInicio) === d)
                .map((t) => (
                  <FilaTurno
                    key={t.id}
                    turno={t}
                    paso={t.estado === 'CONFIRMADO'}
                    alCambiar={(nuevo) => setTurnos((l) => l?.map((x) => (x.id === nuevo.id ? nuevo : x)) ?? null)}
                  />
                ))}
            </ul>
          </div>
        ))}
    </section>
  )
}

// Calendario del mes: cuántos turnos hay cada día. Tocar un día abre su agenda.
function CalendarioMes({ hoy }: { hoy: string }) {
  const [mes, setMes] = useState(() => primeroDeMes(hoy))
  const [cargado, setCargado] = useState<{ mes: string; turnos: Turno[] } | null>(null)
  const ultimo = ultimoDelMes(mes)

  useEffect(() => {
    let vigente = true
    apiGet<Turno[]>(`/turnos?desde=${mes}&hasta=${ultimo}`)
      .then((t) => vigente && setCargado({ mes, turnos: t }))
      .catch(() => vigente && setCargado({ mes, turnos: [] }))
    return () => {
      vigente = false
    }
  }, [mes, ultimo])

  // Cantidad de turnos (sin los cancelados) por día del mes que se está viendo.
  const porDia = useMemo(() => {
    const cuenta = new Map<string, number>()
    if (cargado?.mes !== mes) return null
    for (const t of cargado.turnos) {
      if (t.estado === 'CANCELADO') continue
      const d = diaDe(t.fechaHoraInicio)
      cuenta.set(d, (cuenta.get(d) ?? 0) + 1)
    }
    return cuenta
  }, [cargado, mes])

  // Semanas completas de lunes a domingo que cubren el mes.
  const inicio = lunesDe(mes)
  const fin = sumarDias(lunesDe(ultimo), 6)
  const dias: string[] = []
  for (let d = inicio; d <= fin; d = sumarDias(d, 1)) dias.push(d)

  return (
    <section className="hoy-caja">
      <div className="hoy-caja-titulo">
        <h2>Calendario</h2>
        <div className="hoy-mes-encabezado">
          <button type="button" className="hoy-mes-flecha" onClick={() => setMes((m) => moverMes(m, -1))} aria-label="Mes anterior">
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <strong>{NOMBRE_MES.format(new Date(`${mes}T12:00:00Z`)).replace(/^./, (l) => l.toUpperCase())}</strong>
          <button type="button" className="hoy-mes-flecha" onClick={() => setMes((m) => moverMes(m, 1))} aria-label="Mes siguiente">
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
      </div>
      <ol className="hoy-mes">
        {DIAS_SEMANA.map((d) => (
          <li key={d} className="hoy-mes-nombre" aria-hidden="true">
            {d}
          </li>
        ))}
        {dias.map((d) => {
          const cantidad = porDia?.get(d) ?? 0
          const otroMes = d.slice(0, 7) !== mes.slice(0, 7)
          return (
            <li key={d}>
              <Link
                to={d === hoy ? '/panel/agenda' : `/panel/agenda?dia=${d}`}
                className={`hoy-mes-dia${d === hoy ? ' es-hoy' : ''}${otroMes ? ' otro-mes' : ''}`}
                aria-current={d === hoy ? 'date' : undefined}
                aria-label={`${diaLargo(d)}: ${cantidad === 1 ? '1 turno' : `${cantidad} turnos`}`}
              >
                <span>{Number(d.slice(8))}</span>
                {cantidad > 0 && <span className="hoy-mes-cantidad">{cantidad}</span>}
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
