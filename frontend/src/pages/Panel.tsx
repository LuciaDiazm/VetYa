import { Bell, CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, HeartPulse, PawPrint, Stethoscope, Syringe } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiGet } from '../lib/api'
import { diaDe, diaLargo, hoyArgentina, lunesDe, primeroDeMes, saludoSegunHora, sumarDias } from '../lib/fechas'
import { useSitio } from '../lib/sitio'
import type { ResumenRecordatorios, Turno } from '../types'
import { AvisosSuspension } from '../components/AvisosSuspension'
import { TarjetaTurno } from '../components/TarjetaTurno'

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

  return (
    <div className="hoy-grilla">
      <div className="hoy-principal">
        {/* Saludo en un recuadro azul, con algunos dibujitos de la clínica muy suaves a la derecha */}
        <section className="hoy-saludo">
          <span className="hoy-saludo-fecha">
            <CalendarDays size={18} aria-hidden="true" /> {diaLargo(hoy)}
          </span>
          <h1>
            {saludo}, {usuario?.nombre}
          </h1>
          <p>
            {activos.length === 0
              ? 'Hoy no hay turnos en la agenda.'
              : activos.length === 1
                ? 'Hoy hay 1 turno en la agenda.'
                : `Hoy hay ${activos.length} turnos en la agenda.`}
          </p>
          <Link to="/panel/agenda/nuevo" className="boton boton-grande boton-secundario">
            <CalendarPlus size={22} aria-hidden="true" /> Dar turno
          </Link>
          {/* Los avisos están en Notificaciones: acá solo se recuerda que hay */}
          {avisos > 0 && (
            <Link to="/panel/recordatorios" className="hoy-saludo-avisos">
              <Bell size={18} aria-hidden="true" />
              {avisos === 1 ? 'Tenés 1 aviso para mandar' : `Tenés ${avisos} avisos para mandar`}
            </Link>
          )}
          <span className="hoy-saludo-dibujos" aria-hidden="true">
            <PawPrint size={64} />
            <Stethoscope size={52} />
            <Syringe size={40} />
            <HeartPulse size={46} />
          </span>
        </section>

        {/* Decidir sobre una suspensión le toca al administrador */}
        {usuario?.rol === 'ADMIN' && <AvisosSuspension />}

        <section className="tarjeta bloque-ficha">
          <div className="bloque-ficha-titulo">
            <h2>
              <CalendarDays size={22} aria-hidden="true" /> Turnos de hoy
            </h2>
            {turnos && activos.length > 0 && (
              <span className="ayuda">
                {porAtender.length === 0
                  ? 'Ya atendiste todos'
                  : porAtender.length === 1
                    ? 'Falta atender 1'
                    : `Faltan atender ${porAtender.length}`}
              </span>
            )}
          </div>
          {turnos === null ? (
            <p className="cargando">Cargando…</p>
          ) : activos.length === 0 ? (
            <p className="vacio">No hay turnos para hoy.</p>
          ) : (
            <ul className="lista-turnos">
              {activos.map((t) => (
                <TarjetaTurno
                  key={t.id}
                  turno={t}
                  alCambiar={(nuevo) => setTurnos((l) => l?.map((x) => (x.id === nuevo.id ? nuevo : x)) ?? null)}
                />
              ))}
            </ul>
          )}
          <Link to="/panel/agenda" className="boton-texto enlace-chico">
            Ver la agenda
          </Link>
        </section>
      </div>

      <aside className="hoy-costado" aria-label="Equipo y calendario">
        {/* ---------- Veterinarios: los mismos datos que se muestran en la web ---------- */}
        <section className="hoy-tarjeta">
          <h2 className="hoy-tarjeta-titulo">Veterinarios</h2>
          {equipo.length === 0 ? (
            <p className="hoy-vacio">Todavía no hay veterinarios cargados en Configuración.</p>
          ) : (
            <ul className="hoy-equipo">
              {equipo.map((m) => (
                <li key={m.id} className="hoy-perfil">
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
                    {m.especialidad && <span className="hoy-perfil-rol">{m.especialidad}</span>}
                    {m.matricula && <span className="hoy-perfil-dato">{m.matricula}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <CalendarioMes hoy={hoy} />
      </aside>
    </div>
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
    <section className="hoy-tarjeta">
      <h2 className="hoy-tarjeta-titulo">Calendario</h2>
      <div className="hoy-mes-encabezado">
        <button type="button" className="hoy-mes-flecha" onClick={() => setMes((m) => moverMes(m, -1))} aria-label="Mes anterior">
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
        <strong>{NOMBRE_MES.format(new Date(`${mes}T12:00:00Z`)).replace(/^./, (l) => l.toUpperCase())}</strong>
        <button type="button" className="hoy-mes-flecha" onClick={() => setMes((m) => moverMes(m, 1))} aria-label="Mes siguiente">
          <ChevronRight size={22} aria-hidden="true" />
        </button>
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
      <p className="hoy-semana-ayuda">El número amarillo es la cantidad de turnos. Tocá un día para ver su agenda.</p>
    </section>
  )
}
