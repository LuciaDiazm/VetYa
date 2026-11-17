import { CalendarClock, Check, HeartPulse, MessageCircle, Phone, Syringe, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { apiGet, apiPost } from '../../lib/api'
import { diaLargo, fechaCortaDe, horaDe, hoyArgentina } from '../../lib/fechas'
import { formatearTelefono } from '../../lib/mascotas'
import { avisarCambioRecordatorios, mensajeDosis, mensajeRecupero, mensajeTurnoManana } from '../../lib/recordatorios'
import { enlaceWhatsapp, useSitio } from '../../lib/sitio'
import type { Pendientes } from '../../types'
import { IconoEspecie } from './Clientes'
import { Cargando } from '../../components/Cargando'

// Las tres listas de avisos. Cada una tiene su tarjeta arriba y se ve por separado.
type Lista = 'manana' | 'vacunas' | 'recuperar'
const LISTAS: { id: Lista; icono: LucideIcon; titulo: string; explicacion: string; vacio: string }[] = [
  {
    id: 'manana',
    icono: CalendarClock,
    titulo: 'Turnos de mañana',
    explicacion: 'Personas con turno para mañana a las que todavía no se les recordó.',
    vacio: 'No hay turnos para mañana que recordar.',
  },
  {
    id: 'vacunas',
    icono: Syringe,
    titulo: 'Vacunas y desparasitaciones',
    explicacion: 'Dosis que tocan en los próximos 7 días o que vencieron hace menos de un mes.',
    vacio: 'No hay vacunas ni desparasitaciones por vencer.',
  },
  {
    id: 'recuperar',
    icono: HeartPulse,
    titulo: 'Clientes para recuperar',
    explicacion:
      'Mascotas que no vienen hace más de 6 meses o con una dosis vencida hace más de un mes (ya pasaron de "por vencer").',
    vacio: 'No hay clientes para recuperar.',
  },
]

interface Aviso {
  tipo: 'TURNO' | 'VACUNA' | 'DESPARASITACION' | 'RECUPERO'
  clienteId: number
  turnoId?: number
  aplicacionId?: number
  mensaje: string
}

// Una persona a la que hay que avisar: datos, el botón de WhatsApp con el mensaje armado
// y la opción de marcarlo si se le avisó por teléfono.
function ItemAviso({
  clave,
  mascota,
  detalle,
  telefono,
  aviso,
  hecho,
  alAvisar,
}: {
  clave: string
  mascota: Pendientes['turnosManana'][number]['mascota']
  detalle: ReactNode
  telefono: string
  aviso: Aviso
  hecho: boolean
  alAvisar: (clave: string, aviso: Aviso) => void
}) {
  return (
    <li className={`aviso${hecho ? ' aviso-hecho' : ''}`}>
      <span className="icono-circulo">
        <IconoEspecie especie={mascota.especie} size={22} />
      </span>
      <div className="aviso-datos">
        <p className="aviso-titulo">
          <Link to={`/panel/mascotas/${mascota.id}`}>{mascota.nombre}</Link>
          <span>
            {' '}
            de {mascota.cliente.nombre} {mascota.cliente.apellido} ({formatearTelefono(telefono)})
          </span>
        </p>
        <p className="aviso-detalle">{detalle}</p>
      </div>
      <div className="aviso-acciones">
        {hecho ? (
          <span className="aviso-listo">
            <Check size={20} aria-hidden="true" /> Avisado
          </span>
        ) : (
          <>
            <a
              href={enlaceWhatsapp(telefono, aviso.mensaje)}
              target="_blank"
              rel="noreferrer"
              className="boton boton-whatsapp"
              onClick={() => alAvisar(clave, aviso)}
            >
              <MessageCircle size={18} aria-hidden="true" /> Avisar por WhatsApp
            </a>
            <button type="button" className="boton-texto enlace-chico" onClick={() => alAvisar(clave, aviso)}>
              <Phone size={16} aria-hidden="true" /> Ya le avisé por teléfono
            </button>
          </>
        )}
      </div>
    </li>
  )
}

export function Recordatorios() {
  const { datos: sitio } = useSitio()
  const { hash } = useLocation()
  const [pendientes, setPendientes] = useState<Pendientes | null>(null)
  const [hechos, setHechos] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [hoy] = useState(hoyArgentina)
  const clinica = sitio?.clinica.nombre ?? 'la veterinaria'

  const cargar = useCallback(() => {
    apiGet<Pendientes>('/recordatorios/pendientes')
      .then(setPendientes)
      .catch(() => setError('No se pudieron cargar los recordatorios.'))
  }, [])
  useEffect(cargar, [cargar])

  // Se registra el aviso; el ítem queda tildado hasta que se recarga la página.
  async function avisar(clave: string, aviso: Aviso) {
    setHechos((h) => new Set(h).add(clave))
    try {
      await apiPost('/recordatorios', aviso)
      avisarCambioRecordatorios()
    } catch {
      setHechos((h) => {
        const copia = new Set(h)
        copia.delete(clave)
        return copia
      })
      setError('No se pudo registrar el aviso. Probá de nuevo.')
    }
  }

  if (!pendientes) return error ? <p className="mensaje-error">{error}</p> : <Cargando />

  const { turnosManana, dosis, recuperar } = pendientes
  const cantidades: Record<Lista, number> = { manana: turnosManana.length, vacunas: dosis.length, recuperar: recuperar.length }
  // La lista que se ve sale del enlace (#manana, #vacunas, #recuperar); si no dice, la primera que tenga avisos.
  const pedida = LISTAS.find((l) => `#${l.id}` === hash)?.id
  const elegida: Lista = pedida ?? LISTAS.find((l) => cantidades[l.id] > 0)?.id ?? 'manana'
  const lista = LISTAS.find((l) => l.id === elegida)!

  return (
    <>
      <div className="panel-encabezado">
        <h1>Notificaciones</h1>
        <p>A quién hay que avisarle. Elegí una tarjeta: cada botón abre WhatsApp con el mensaje listo.</p>
      </div>
      {error && <p className="mensaje-error">{error}</p>}

      {/* Las tres tarjetas: la elegida queda marcada y abajo se ve solo su lista */}
      <nav className="grilla-resumen" aria-label="Tipos de aviso">
        {LISTAS.map(({ id, icono: Icono, titulo }) => (
          <Link
            key={id}
            to={`#${id}`}
            replace
            className={`tarjeta resumen-numero${id === elegida ? ' elegida' : ''}`}
            aria-current={id === elegida ? 'true' : undefined}
          >
            <span className="icono-circulo">
              <Icono size={22} aria-hidden="true" />
            </span>
            <span>
              <strong>{cantidades[id]}</strong> {titulo}
            </span>
          </Link>
        ))}
      </nav>

      <section className="tarjeta bloque-ficha">
        <div className="bloque-ficha-titulo">
          <h2>
            <lista.icono size={22} aria-hidden="true" /> {lista.titulo} ({cantidades[elegida]})
          </h2>
        </div>
        <p className="ayuda">{lista.explicacion}</p>
        {cantidades[elegida] === 0 && <p className="vacio">{lista.vacio}</p>}

      {/* ---------- Turnos de mañana ---------- */}
      {elegida === 'manana' && turnosManana.length > 0 && (
          <ul className="lista-avisos">
            {turnosManana.map((t) => {
              const clave = `turno-${t.id}`
              return (
                <ItemAviso
                  key={clave}
                  clave={clave}
                  mascota={t.mascota}
                  telefono={t.mascota.cliente.telefono}
                  detalle={
                    <>
                      {t.servicio.nombre}, mañana a las <strong>{horaDe(t.fechaHoraInicio)}</strong>
                    </>
                  }
                  aviso={{ tipo: 'TURNO', clienteId: t.mascota.cliente.id, turnoId: t.id, mensaje: mensajeTurnoManana(t, clinica) }}
                  hecho={hechos.has(clave)}
                  alAvisar={avisar}
                />
              )
            })}
          </ul>
      )}

      {/* ---------- Vacunas y desparasitaciones ---------- */}
      {elegida === 'vacunas' && dosis.length > 0 && (
          <ul className="lista-avisos">
            {dosis.map((d) => {
              const clave = `dosis-${d.id}`
              const fecha = d.fechaProximaDosis!.slice(0, 10)
              const vencida = fecha < hoy
              return (
                <ItemAviso
                  key={clave}
                  clave={clave}
                  mascota={d.mascota}
                  telefono={d.mascota.cliente.telefono}
                  detalle={
                    <>
                      <strong>{d.producto}</strong>:{' '}
                      {vencida ? (
                        <span className="estado-dosis vencida">vencida el {diaLargo(fecha)}</span>
                      ) : fecha === hoy ? (
                        <span className="estado-dosis por-vencer">le toca hoy</span>
                      ) : (
                        <span className="estado-dosis por-vencer">le toca el {diaLargo(fecha)}</span>
                      )}
                      {d.tieneTurno && <span className="ayuda"> Ya tiene un turno sacado.</span>}
                    </>
                  }
                  aviso={{
                    tipo: d.tipo,
                    clienteId: d.mascota.cliente.id,
                    aplicacionId: d.id,
                    mensaje: mensajeDosis(d, clinica, hoy),
                  }}
                  hecho={hechos.has(clave)}
                  alAvisar={avisar}
                />
              )
            })}
          </ul>
      )}

      {/* ---------- Clientes para recuperar ---------- */}
      {elegida === 'recuperar' && recuperar.length > 0 && (
          <ul className="lista-avisos">
            {recuperar.map((r) => {
              const clave = `recupero-${r.mascota.id}`
              return (
                <ItemAviso
                  key={clave}
                  clave={clave}
                  mascota={r.mascota}
                  telefono={r.mascota.cliente.telefono}
                  detalle={
                    <>
                      {r.ultimaVisita ? `Última visita: ${fechaCortaDe(r.ultimaVisita)}.` : 'Todavía no vino a consulta.'}
                      {r.vencidas.length > 0 && <> Vencidas: {r.vencidas.join(', ')}.</>}
                    </>
                  }
                  aviso={{ tipo: 'RECUPERO', clienteId: r.mascota.cliente.id, mensaje: mensajeRecupero(r, clinica) }}
                  hecho={hechos.has(clave)}
                  alAvisar={avisar}
                />
              )
            })}
          </ul>
      )}
      </section>
    </>
  )
}
