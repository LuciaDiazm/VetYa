import { ArrowDown, ArrowUp, CalendarDays, FileText, Globe, HeartPulse, Minus, Stethoscope, UserPlus, UserX } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ElegirFechas } from '../../components/ElegirFechas'
import { Barras, Columnas, type Dato } from '../../components/Graficos'
import { apiGet } from '../../lib/api'
import { hoyArgentina, lunesDe, primeroDeMes, problemaDePeriodo, sumarDias } from '../../lib/fechas'
import { Cargando } from '../../components/Cargando'

interface Resumen {
  turnos: number
  atendidos: number
  ausentes: number
  cancelados: number
  ausentismo: number | null
  clientesNuevos: number
  consultas: number
}

interface DatosEstadisticas {
  desde: string
  hasta: string
  actual: Resumen
  anterior: Resumen
  porDia: { fecha: string; total: number }[]
  porDiaSemana: number[]
  porServicio: { nombre: string; total: number }[]
  porOrigen: { ONLINE: number; TELEFONO: number; MOSTRADOR: number }
  avisos: Record<'TURNO' | 'VACUNA' | 'DESPARASITACION' | 'RECUPERO' | 'CARNET', number>
  avisosQueVolvieron: number
  recuperados: number
}

// ---------- Períodos ----------

const PERIODOS = [
  { clave: 'mes', nombre: 'Este mes', rango: (hoy: string) => [primeroDeMes(hoy), hoy] },
  {
    clave: 'mes-pasado',
    nombre: 'Mes pasado',
    rango: (hoy: string) => {
      const ultimo = sumarDias(primeroDeMes(hoy), -1)
      return [primeroDeMes(ultimo), ultimo]
    },
  },
  { clave: '3-meses', nombre: 'Últimos 3 meses', rango: (hoy: string) => [sumarDias(hoy, -90), hoy] },
  { clave: 'anio', nombre: 'Este año', rango: (hoy: string) => [`${hoy.slice(0, 4)}-01-01`, hoy] },
] as const

const DIA_MES = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const DIA_LARGO = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
const MES = new Intl.DateTimeFormat('es-AR', { month: 'short', timeZone: 'UTC' })
const MES_LARGO = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const PORCENTAJE = new Intl.NumberFormat('es-AR', { style: 'percent', maximumFractionDigits: 0 })
const fechaUTC = (f: string) => new Date(`${f}T12:00:00Z`)
const sinPunto = (t: string) => t.replace('.', '')

// Turnos por día, semana o mes según el largo del período (para que siempre haya entre 7 y 31 columnas).
function agrupar(porDia: { fecha: string; total: number }[], desde: string, hasta: string) {
  const totales = new Map(porDia.map((d) => [d.fecha, d.total]))
  const largo = Math.round((Date.parse(hasta) - Date.parse(desde)) / 86_400_000) + 1
  const por = largo <= 31 ? 'día' : largo <= 120 ? 'semana' : 'mes'
  const grupos = new Map<string, Dato>()
  const sumar = (clave: string, crear: () => Dato, valor: number) => {
    const g = grupos.get(clave) ?? crear()
    g.valor += valor
    grupos.set(clave, g)
  }
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) {
    const valor = totales.get(f) ?? 0
    if (por === 'día') {
      if (fechaUTC(f).getUTCDay() === 0) continue // domingo: la clínica no atiende
      sumar(f, () => ({ etiqueta: String(fechaUTC(f).getUTCDate()), detalle: DIA_LARGO.format(fechaUTC(f)), valor: 0 }), valor)
    } else if (por === 'semana') {
      const lunes = lunesDe(f)
      sumar(lunes, () => ({ etiqueta: sinPunto(DIA_MES.format(fechaUTC(lunes))), detalle: `Semana del ${DIA_MES.format(fechaUTC(lunes))}`, valor: 0 }), valor)
    } else {
      const mes = f.slice(0, 7)
      sumar(mes, () => ({ etiqueta: sinPunto(MES.format(fechaUTC(`${mes}-01`))), detalle: MES_LARGO.format(fechaUTC(`${mes}-01`)), valor: 0 }), valor)
    }
  }
  return { por, columnas: [...grupos.values()] }
}

// ---------- Indicadores ----------

function Indicador({
  icono,
  titulo,
  valor,
  cambio,
  arribaEsBueno = true,
  nota,
}: {
  icono: ReactNode
  titulo: string
  valor: string
  // Diferencia con el período anterior (en la misma unidad que el valor)
  cambio?: { texto: string; signo: number }
  arribaEsBueno?: boolean
  nota?: string
}) {
  const bueno = cambio && cambio.signo !== 0 && (cambio.signo > 0) === arribaEsBueno
  const Flecha = !cambio || cambio.signo === 0 ? Minus : cambio.signo > 0 ? ArrowUp : ArrowDown
  return (
    <li className="indicador tarjeta">
      <span className="indicador-titulo">
        {icono} {titulo}
      </span>
      <strong className="indicador-valor">{valor}</strong>
      {cambio && (
        <span className={`indicador-cambio${cambio.signo === 0 ? '' : bueno ? ' cambio-bueno' : ' cambio-malo'}`}>
          <Flecha size={16} aria-hidden="true" /> {cambio.texto} <span className="ayuda">vs. período anterior</span>
        </span>
      )}
      {nota && <span className="ayuda">{nota}</span>}
    </li>
  )
}

function cambioEnCantidad(actual: number, anterior: number) {
  const dif = actual - anterior
  if (anterior === 0) return { texto: dif === 0 ? 'Igual' : `${dif > 0 ? '+' : ''}${dif}`, signo: Math.sign(dif) }
  const pct = dif / anterior
  return { texto: Math.abs(pct) < 0.005 ? 'Igual' : `${pct > 0 ? '+' : '−'}${PORCENTAJE.format(Math.abs(pct))}`, signo: Math.sign(dif) }
}

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DIAS_SEMANA_LARGO = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

// Estadísticas de la clínica: cuánto se trabaja, cuántos no vienen y qué se pide más.
export function Estadisticas() {
  const [parametros, setParametros] = useSearchParams()
  const [hoy] = useState(hoyArgentina)
  // "Elegir fechas": el período lo pone la persona con Desde y Hasta.
  const aMano = parametros.get('periodo') === 'fechas'
  const periodo = aMano ? null : (PERIODOS.find((p) => p.clave === parametros.get('periodo')) ?? PERIODOS[0])
  const [desde, hasta] = periodo
    ? periodo.rango(hoy)
    : [parametros.get('desde') ?? primeroDeMes(hoy), parametros.get('hasta') ?? hoy]
  const problema = aMano ? problemaDePeriodo(desde, hasta) : null
  const [datos, setDatos] = useState<DatosEstadisticas | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (problema) return
    let vigente = true
    apiGet<DatosEstadisticas>(`/estadisticas?desde=${desde}&hasta=${hasta}`)
      .then((d) => {
        if (!vigente) return
        setDatos(d)
        setError(null)
      })
      .catch(() => vigente && setError('No se pudieron cargar las estadísticas.'))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [desde, hasta, problema])

  function elegir(clave: string) {
    setCargando(true)
    setParametros(clave === PERIODOS[0].clave ? {} : { periodo: clave })
  }

  function elegirFechas(d: string, h: string) {
    setCargando(true)
    setParametros({ periodo: 'fechas', desde: d, hasta: h }, { replace: aMano })
  }

  const porPeriodo = useMemo(() => (datos ? agrupar(datos.porDia, datos.desde, datos.hasta) : null), [datos])

  return (
    <>
      <div className="panel-encabezado">
        <h1>Estadísticas</h1>
        <p>Cómo viene la clínica: turnos, ausencias, lo que más se pide y si los avisos traen gente.</p>
      </div>

      {/* Filtro único, arriba de todo: cambia todos los números de la pantalla */}
      <div className="filtro-periodo" role="group" aria-label="Período">
        {PERIODOS.map((p) => (
          <button
            key={p.clave}
            type="button"
            className={`chip${p === periodo ? ' chip-activo' : ''}`}
            aria-pressed={p === periodo}
            onClick={() => elegir(p.clave)}
          >
            {p.nombre}
          </button>
        ))}
        <button
          type="button"
          className={`chip${aMano ? ' chip-activo' : ''}`}
          aria-pressed={aMano}
          onClick={() => elegirFechas(desde, hasta)}
        >
          Elegir fechas
        </button>
      </div>
      {aMano && <ElegirFechas desde={desde} hasta={hasta} alCambiar={elegirFechas} />}
      <p className="ayuda">
        <Link to={`/panel/informe?desde=${desde}&hasta=${hasta}`} className="enlace-con-icono">
          <FileText size={18} aria-hidden="true" /> Ver el detalle de estos turnos
        </Link>
      </p>

      {problema && <p className="mensaje-error">{problema}</p>}
      {error && <p className="mensaje-error">{error}</p>}
      {problema ? null : !datos ? (
        !error && <Cargando />
      ) : (
        <>
        {/* Al cambiar el período: el ícono flota sobre los gráficos anteriores, que quedan más tenues */}
        {cargando && (
          <div className="estadisticas-cargando">
            <Cargando texto="Actualizando…" />
          </div>
        )}
        <div className={`estadisticas${cargando ? ' recargando' : ''}`} aria-busy={cargando}>
          {/* ---------- Indicadores ---------- */}
          <ul className="indicadores">
            <Indicador
              icono={<CalendarDays size={18} aria-hidden="true" />}
              titulo="Turnos"
              valor={String(datos.actual.turnos)}
              cambio={cambioEnCantidad(datos.actual.turnos, datos.anterior.turnos)}
              nota={datos.actual.cancelados > 0 ? `Sin contar ${datos.actual.cancelados} cancelados` : undefined}
            />
            <Indicador
              icono={<Stethoscope size={18} aria-hidden="true" />}
              titulo="Atendidos"
              valor={String(datos.actual.atendidos)}
              cambio={cambioEnCantidad(datos.actual.atendidos, datos.anterior.atendidos)}
            />
            <Indicador
              icono={<UserX size={18} aria-hidden="true" />}
              titulo="No vinieron"
              valor={datos.actual.ausentismo === null ? '—' : PORCENTAJE.format(datos.actual.ausentismo)}
              arribaEsBueno={false}
              cambio={
                datos.actual.ausentismo !== null && datos.anterior.ausentismo !== null
                  ? (() => {
                      const puntos = Math.round((datos.actual.ausentismo - datos.anterior.ausentismo) * 100)
                      return { texto: puntos === 0 ? 'Igual' : `${puntos > 0 ? '+' : '−'}${Math.abs(puntos)} ${Math.abs(puntos) === 1 ? 'punto' : 'puntos'}`, signo: Math.sign(puntos) }
                    })()
                  : undefined
              }
              nota={`${datos.actual.ausentes} de ${datos.actual.atendidos + datos.actual.ausentes} turnos`}
            />
            <Indicador
              icono={<UserPlus size={18} aria-hidden="true" />}
              titulo="Clientes nuevos"
              valor={String(datos.actual.clientesNuevos)}
              cambio={cambioEnCantidad(datos.actual.clientesNuevos, datos.anterior.clientesNuevos)}
            />
            <Indicador
              icono={<Globe size={18} aria-hidden="true" />}
              titulo="Pedidos por la web"
              valor={datos.actual.turnos ? PORCENTAJE.format(datos.porOrigen.ONLINE / datos.actual.turnos) : '—'}
              nota={`${datos.porOrigen.ONLINE} online · ${datos.porOrigen.TELEFONO} por teléfono · ${datos.porOrigen.MOSTRADOR} en el mostrador`}
            />
            <Indicador
              icono={<HeartPulse size={18} aria-hidden="true" />}
              titulo="Clientes recuperados"
              valor={String(datos.recuperados)}
              nota={`De ${datos.avisos.RECUPERO} avisos de “hace mucho que no vienen”`}
            />
          </ul>

          {datos.actual.turnos === 0 ? (
            <div className="tarjeta">
              <p className="vacio">No hay turnos en este período. Probá con otro período más largo.</p>
            </div>
          ) : (
            <>
              {/* ---------- Turnos en el tiempo ---------- */}
              <section className="tarjeta grafico">
                <h2>Turnos por {porPeriodo?.por}</h2>
                <p className="ayuda">Sin contar los cancelados. Pasá el mouse sobre una barra para ver el número.</p>
                <Columnas datos={porPeriodo?.columnas ?? []} unidad="turnos" columna="Período" />
              </section>

              <div className="graficos-dobles">
                {/* ---------- Servicios ---------- */}
                <section className="tarjeta grafico">
                  <h2>Lo que más se pide</h2>
                  <Barras
                    datos={datos.porServicio.slice(0, 8).map((s) => ({ etiqueta: s.nombre, valor: s.total }))}
                    unidad="turnos"
                    columna="Servicio"
                  />
                </section>

                {/* ---------- Días de la semana ---------- */}
                <section className="tarjeta grafico">
                  <h2>Días con más turnos</h2>
                  <p className="ayuda">Sirve para saber qué días reforzar la atención.</p>
                  <Columnas
                    datos={DIAS_SEMANA.map((d, i) => ({
                      etiqueta: d,
                      detalle: DIAS_SEMANA_LARGO[i],
                      valor: datos.porDiaSemana[i + 1],
                    }))}
                    unidad="turnos"
                    columna="Día"
                    resaltarMaximo
                    todosLosValores
                  />
                </section>
              </div>
            </>
          )}

          {/* ---------- Avisos ---------- */}
          <section className="tarjeta grafico">
            <h2>Avisos por WhatsApp</h2>
            <table className="tabla-avisos">
              <thead>
                <tr>
                  <th scope="col">Tipo de aviso</th>
                  <th scope="col">Enviados</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Recordatorio del turno de mañana</td>
                  <td>{datos.avisos.TURNO}</td>
                </tr>
                <tr>
                  <td>Vacunas y desparasitaciones por vencer</td>
                  <td>{datos.avisos.VACUNA + datos.avisos.DESPARASITACION}</td>
                </tr>
                <tr>
                  <td>“Hace mucho que no vienen”</td>
                  <td>{datos.avisos.RECUPERO}</td>
                </tr>
                <tr>
                  <td>Carnet de vacunas enviado</td>
                  <td>{datos.avisos.CARNET}</td>
                </tr>
              </tbody>
            </table>
            <p className="ayuda">
              {datos.avisosQueVolvieron === 1
                ? '1 aviso de vacunas o de "hace mucho que no vienen" terminó en un turno nuevo dentro de los 30 días.'
                : `${datos.avisosQueVolvieron} avisos de vacunas o de "hace mucho que no vienen" terminaron en un turno nuevo dentro de los 30 días.`}
            </p>
          </section>
        </div>
        </>
      )}
    </>
  )
}
