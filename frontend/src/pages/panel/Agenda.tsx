import { CalendarPlus, ChevronLeft, ChevronRight, Clock, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Ayuda } from '../../components/Ayuda'
import { Cargando } from '../../components/Cargando'
import { FilaTurno } from '../../components/FilaTurno'
import { apiGet } from '../../lib/api'
import { diaAmigable, diaDe, diaLargo, horaDe, hoyArgentina, lunesDe, sumarDias } from '../../lib/fechas'
import { useHoraActual } from '../../lib/horaActual'
import { useSitio } from '../../lib/sitio'
import { ESTADOS_TURNO, huecosLibres, type Hueco } from '../../lib/turnos'
import type { Turno } from '../../types'

const DIA_SEMANA = new Intl.DateTimeFormat('es-AR', { weekday: 'short', timeZone: 'UTC' })
const NUMERO_DIA = new Intl.DateTimeFormat('es-AR', { day: 'numeric', timeZone: 'UTC' })

interface DiaCerrado {
  fecha: string
  motivo: string | null
}

// Lo que se muestra en la línea del día: turnos, ratos libres y la marca de "ahora", en orden de hora.
type Renglon =
  | { tipo: 'turno'; hora: string; turno: Turno }
  | { tipo: 'libre'; hora: string; hueco: Hueco }
  | { tipo: 'ahora'; hora: string }

function plural(cantidad: number, uno: string, varios: string) {
  return `${cantidad} ${cantidad === 1 ? uno : varios}`
}

// Clave del veterinario para el filtro ("sin" = turnos sin veterinario asignado).
const claveVet = (t: Turno) => (t.veterinario ? String(t.veterinario.id) : 'sin')

export function Agenda() {
  const [parametros, setParametros] = useSearchParams()
  const hoy = hoyArgentina()
  const dia = parametros.get('dia') ?? hoy
  const esHoy = dia === hoy
  const lunes = lunesDe(dia)
  const ahora = useHoraActual()
  const { datos: sitio } = useSitio()
  // Turnos de la semana, junto con el lunes al que corresponden: si no es la semana que se mira, se está consultando.
  const [semana, setSemana] = useState<{ lunes: string; turnos: Turno[] } | null>(null)
  const turnosSemana = semana?.lunes === lunes ? semana.turnos : null
  const [cerrados, setCerrados] = useState<DiaCerrado[]>([])
  const [verCancelados, setVerCancelados] = useState(false)
  const [veterinario, setVeterinario] = useState('')
  const [anuncio, setAnuncio] = useState('')

  const cargar = useCallback(() => {
    const hasta = sumarDias(lunes, 6)
    apiGet<Turno[]>(`/turnos?desde=${lunes}&hasta=${hasta}`)
      .then((turnos) => setSemana({ lunes, turnos }))
      .catch(() => setSemana({ lunes, turnos: [] }))
    apiGet<DiaCerrado[]>(`/turnos/dias-cerrados?desde=${lunes}&hasta=${hasta}`)
      .then(setCerrados)
      .catch(() => setCerrados([]))
  }, [lunes])
  useEffect(cargar, [cargar])

  const irA = (d: string) => setParametros(d === hoyArgentina() ? {} : { dia: d })

  const delDia = useMemo(() => (turnosSemana ?? []).filter((t) => diaDe(t.fechaHoraInicio) === dia), [turnosSemana, dia])
  // Los ratos libres son de la clínica: se calculan con todos los turnos, aunque se filtre por veterinario.
  const activosTodos = useMemo(() => delDia.filter((t) => t.estado !== 'CANCELADO'), [delDia])
  const activos = useMemo(
    () => activosTodos.filter((t) => !veterinario || claveVet(t) === veterinario),
    [activosTodos, veterinario],
  )
  const cancelados = delDia.filter((t) => t.estado === 'CANCELADO' && (!veterinario || claveVet(t) === veterinario))
  const cerradoHoy = cerrados.find((c) => c.fecha === dia)
  const cuenta = (estado: Turno['estado']) => activos.filter((t) => t.estado === estado).length

  // Veterinarios que tienen turnos esta semana, para el filtro.
  const veterinarios = useMemo(
    () =>
      [
        ...new Map(
          (turnosSemana ?? []).map((t) => [
            claveVet(t),
            t.veterinario ? `${t.veterinario.nombre} ${t.veterinario.apellido}` : 'Sin asignar',
          ]),
        ),
      ].sort((a, b) => a[1].localeCompare(b[1])),
    [turnosSemana],
  )

  // Línea del día. Los ratos libres solo se muestran para hoy (desde ahora) y días futuros.
  const renglones = useMemo(() => {
    const lista: Renglon[] = activos.map((t) => ({ tipo: 'turno', hora: horaDe(t.fechaHoraInicio), turno: t }))
    if (sitio && !cerradoHoy && dia >= hoy) {
      for (const hueco of huecosLibres(sitio.clinica.horarios, activosTodos, dia, esHoy ? ahora : undefined)) {
        lista.push({ tipo: 'libre', hora: hueco.inicio, hueco })
      }
    }
    lista.sort((a, b) => a.hora.localeCompare(b.hora) || (a.tipo === 'turno' ? -1 : 1))
    if (esHoy && lista.length > 0) {
      const posicion = lista.findIndex((r) => r.hora >= ahora)
      lista.splice(posicion === -1 ? lista.length : posicion, 0, { tipo: 'ahora', hora: ahora })
    }
    return lista
  }, [activos, activosTodos, sitio, cerradoHoy, dia, hoy, esHoy, ahora])

  // El próximo turno por atender de hoy, y los que ya pasaron sin que nadie los marque.
  const proximoId = esHoy
    ? activos.find((t) => (t.estado === 'CONFIRMADO' || t.estado === 'PENDIENTE') && horaDe(t.fechaHoraInicio) >= ahora)?.id
    : undefined
  const yaPaso = (t: Turno) => t.estado === 'CONFIRMADO' && (dia < hoy || (esHoy && horaDe(t.fechaHoraFin) <= ahora))

  function reemplazar(t: Turno) {
    setSemana((s) => (s ? { ...s, turnos: s.turnos.map((x) => (x.id === t.id ? t : x)) } : s))
    setAnuncio(`Turno de ${t.mascota.nombre}: ${ESTADOS_TURNO[t.estado].toLowerCase()}.`)
  }

  const totales: [string, number, string?][] = [
    [activos.length === 1 ? 'Turno' : 'Turnos', activos.length],
    ['Por confirmar', cuenta('PENDIENTE'), 'agenda-total-pendientes'],
    [cuenta('ATENDIDO') === 1 ? 'Atendido' : 'Atendidos', cuenta('ATENDIDO')],
    [cuenta('AUSENTE') === 1 ? 'No vino' : 'No vinieron', cuenta('AUSENTE')],
  ]

  return (
    <>
      <div className="informe-encabezado">
        <h1>Agenda</h1>
        <Ayuda
          etiqueta="Cómo se usa la agenda"
          texto="Elegí un día de la semana para ver sus turnos. Los ratos libres tienen el botón para dar un turno a esa hora, y la línea amarilla marca la hora actual."
        />
        <Link to={`/panel/agenda/nuevo?fecha=${dia}`} className="boton informe-imprimir">
          <CalendarPlus size={20} aria-hidden="true" /> Dar turno
        </Link>
      </div>

      <div className="informe-caja agenda-caja">
        {/* ---------- Semana: un día por pestaña ---------- */}
        <nav className="agenda-semana" aria-label="Días de la semana">
          <button
            type="button"
            className="hoy-mes-flecha"
            onClick={() => irA(sumarDias(dia, -7))}
            aria-label="Semana anterior"
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <div className="agenda-dias">
            {Array.from({ length: 6 }, (_, i) => sumarDias(lunes, i)).map((d) => {
              const cantidad = (turnosSemana ?? []).filter(
                (t) => diaDe(t.fechaHoraInicio) === d && t.estado !== 'CANCELADO',
              ).length
              const cerrado = cerrados.some((c) => c.fecha === d)
              const fecha = new Date(`${d}T12:00:00Z`)
              return (
                <button
                  key={d}
                  type="button"
                  className={`agenda-dia${d === dia ? ' activo' : ''}${d === hoy ? ' es-hoy' : ''}${cerrado ? ' cerrado' : ''}`}
                  aria-current={d === dia ? 'date' : undefined}
                  aria-label={`${diaLargo(d)}${d === hoy ? ' (hoy)' : ''}: ${cerrado ? 'cerrado' : plural(cantidad, 'turno', 'turnos')}`}
                  onClick={() => irA(d)}
                >
                  <span className="agenda-dia-nombre">{DIA_SEMANA.format(fecha).replace('.', '')}</span>
                  <span className="agenda-dia-numero">{NUMERO_DIA.format(fecha)}</span>
                  <span className="agenda-dia-cantidad" aria-hidden="true">
                    {cerrado ? 'Cerrado' : cantidad === 0 ? 'Sin turnos' : plural(cantidad, 'turno', 'turnos')}
                  </span>
                </button>
              )
            })}
          </div>
          <button
            type="button"
            className="hoy-mes-flecha"
            onClick={() => irA(sumarDias(dia, 7))}
            aria-label="Semana siguiente"
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </nav>

        {/* ---------- Día elegido: fecha, volver a hoy y filtro ---------- */}
        <div className="agenda-dia-titulo">
          <h2>{diaAmigable(dia) === diaLargo(dia) ? diaLargo(dia) : `${diaAmigable(dia)}, ${diaLargo(dia)}`}</h2>
          {!esHoy && (
            <button type="button" className="boton-fila" onClick={() => irA(hoy)}>
              Volver a hoy
            </button>
          )}
          {veterinarios.length > 1 && (
            <label className="campo-compacto agenda-filtro">
              <span>Veterinario</span>
              <select value={veterinario} onChange={(e) => setVeterinario(e.target.value)}>
                <option value="">Todos</option>
                {veterinarios.map(([id, nombre]) => (
                  <option key={id} value={id}>
                    {nombre}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {activos.length > 0 && (
          <ul className="informe-totales agenda-totales" aria-label="Resumen del día">
            {totales.map(([texto, valor, clase]) => (
              <li key={texto} className={valor > 0 ? clase : undefined}>
                <strong>{valor}</strong>
                {texto}
              </li>
            ))}
          </ul>
        )}

        {cerradoHoy && (
          <p className="aviso-cerrado agenda-cerrado">
            La clínica no atiende este día{cerradoHoy.motivo ? ` (${cerradoHoy.motivo})` : ''}. No se ofrecen turnos en
            la web.
            {activos.length > 0 && ' Los turnos de abajo se dieron antes de cerrarlo: avisales.'}
          </p>
        )}

        {/* ---------- Línea del día ---------- */}
        {turnosSemana === null ? (
          <Cargando />
        ) : renglones.length === 0 ? (
          <div className="agenda-vacio">
            <p>{dia < hoy ? 'Ese día no hubo turnos.' : 'No hay turnos para este día.'}</p>
            {dia >= hoy && !cerradoHoy && (
              <Link to={`/panel/agenda/nuevo?fecha=${dia}`} className="boton-fila">
                <CalendarPlus size={18} aria-hidden="true" /> Dar un turno
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="fila-encabezado" aria-hidden="true">
              <span>Hora</span>
              <span>Mascota</span>
              <span>La trae</span>
              <span>Estado</span>
              <span />
            </div>
            <ul className="filas-turnos" aria-label="Turnos del día">
              {renglones.map((r) =>
                r.tipo === 'turno' ? (
                  <FilaTurno
                    key={r.turno.id}
                    turno={r.turno}
                    alCambiar={reemplazar}
                    paso={yaPaso(r.turno)}
                    sigue={r.turno.id === proximoId}
                  />
                ) : r.tipo === 'libre' ? (
                  <li key={`libre-${r.hora}`} className="fila-libre">
                    <span className="fila-libre-hora">{r.hueco.inicio}</span>
                    <span className="fila-libre-texto">
                      <Clock size={16} aria-hidden="true" /> Libre hasta las <strong>{r.hueco.fin}</strong>
                    </span>
                    <Link
                      to={`/panel/agenda/nuevo?fecha=${dia}&hora=${r.hueco.inicio}`}
                      className="boton-fila"
                      aria-label={`Dar turno a las ${r.hueco.inicio}`}
                    >
                      <Plus size={16} aria-hidden="true" /> Dar turno
                    </Link>
                  </li>
                ) : (
                  <li key="ahora" className="fila-ahora">
                    <span>Ahora · {r.hora}</span>
                  </li>
                ),
              )}
            </ul>
          </>
        )}

        {cancelados.length > 0 && (
          <div className="agenda-cancelados">
            <button
              type="button"
              className="boton-fila"
              aria-expanded={verCancelados}
              onClick={() => setVerCancelados((v) => !v)}
            >
              {verCancelados ? 'Ocultar' : 'Ver'} cancelados ({cancelados.length})
            </button>
            {verCancelados && (
              <ul className="filas-turnos">
                {cancelados.map((t) => (
                  <FilaTurno key={t.id} turno={t} alCambiar={reemplazar} />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <p className="solo-lectores" role="status" aria-atomic="true">
        {anuncio}
      </p>
    </>
  )
}
