import { CalendarClock, Check, HeartPulse, MessageCircle, Phone, Syringe, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { apiGet, apiPost } from '../../lib/api'
import { diaLargo, fechaCortaDe, horaDe, hoyArgentina } from '../../lib/fechas'
import { avisarCambioRecordatorios, mensajeDosis, mensajeRecupero, mensajeTurnoManana } from '../../lib/recordatorios'
import { enlaceWhatsapp, useSitio } from '../../lib/sitio'
import type { Pendientes } from '../../types'
import { IconoEspecie } from './Clientes'
import { Cargando } from '../../components/Cargando'

// Las tres listas de avisos. Cada una tiene su tarjeta arriba y se ve por separado.
type Lista = 'manana' | 'vacunas' | 'recuperar'
const LISTAS: { id: Lista; icono: LucideIcon; titulo: string; columna: string; explicacion: string; vacio: string }[] = [
  {
    id: 'manana',
    icono: CalendarClock,
    titulo: 'Turnos de mañana',
    columna: 'Turno',
    explicacion: 'Personas con turno para mañana a las que todavía no se les recordó.',
    vacio: 'No hay turnos para mañana que recordar.',
  },
  {
    id: 'vacunas',
    icono: Syringe,
    titulo: 'Vacunas y desparasitaciones',
    columna: 'Qué le toca',
    explicacion: 'Dosis que tocan en los próximos 7 días o que vencieron hace menos de un mes.',
    vacio: 'No hay vacunas ni desparasitaciones por vencer.',
  },
  {
    id: 'recuperar',
    icono: HeartPulse,
    titulo: 'Clientes para recuperar',
    columna: 'Por qué',
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
    <li className={`aviso-fila${hecho ? ' aviso-hecho' : ''}`}>
      <div className="aviso-fila-quien">
        <span className="icono-circulo">
          <IconoEspecie especie={mascota.especie} size={20} />
        </span>
        <span>
          <Link to={`/panel/mascotas/${mascota.id}`} className="aviso-fila-mascota">
            {mascota.nombre}
          </Link>
          <span className="aviso-fila-dueno">
            de {mascota.cliente.nombre} {mascota.cliente.apellido}
          </span>
        </span>
      </div>
      <p className="aviso-detalle">{detalle}</p>
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
              className="boton boton-wa-suave"
              onClick={() => alAvisar(clave, aviso)}
            >
              <MessageCircle size={18} aria-hidden="true" /> WhatsApp
              <span className="solo-lectores"> para avisarle a {mascota.cliente.nombre}</span>
            </a>
            <button type="button" className="boton-texto enlace-chico" onClick={() => alAvisar(clave, aviso)}>
              <Phone size={16} aria-hidden="true" /> Ya le avisé
              <span className="solo-lectores"> por teléfono</span>
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

  // En el celular las pestañas se desplazan de costado: la elegida queda siempre a la vista.
  useEffect(() => {
    document.querySelector('.pestanas-avisos .activa')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [hash, pendientes])

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
        <p>A quién hay que avisarle. Elegí una pestaña: cada botón abre WhatsApp con el mensaje listo.</p>
      </div>
      {error && <p className="mensaje-error">{error}</p>}

      {/* Las tres listas como pestañas, cada una con cuántos avisos tiene; abajo se ve solo la elegida */}
      <nav className="pestanas-avisos" aria-label="Tipos de aviso">
        {LISTAS.map(({ id, icono: Icono, titulo }) => (
          <Link
            key={id}
            to={`#${id}`}
            replace
            className={id === elegida ? 'activa' : undefined}
            aria-current={id === elegida ? 'true' : undefined}
          >
            <Icono size={20} aria-hidden="true" />
            {titulo}
            <span className={`pestana-numero${cantidades[id] === 0 ? ' en-cero' : ''}`}>{cantidades[id]}</span>
          </Link>
        ))}
      </nav>

      {/* Los avisos como tabla: quién, qué le toca y el botón para avisarle */}
      <section className="tarjeta tabla-notificaciones" aria-label={lista.titulo}>
        <p className="tabla-notificaciones-ayuda">
          <lista.icono size={18} aria-hidden="true" /> {lista.explicacion}
        </p>
        {cantidades[elegida] === 0 ? (
          <p className="vacio">{lista.vacio}</p>
        ) : (
          <div className="tabla-notificaciones-encabezado" aria-hidden="true">
            <span>Mascota y dueño</span>
            <span>{lista.columna}</span>
            <span>Avisar</span>
          </div>
        )}

      {/* ---------- Turnos de mañana ---------- */}
      {elegida === 'manana' && turnosManana.length > 0 && (
          <ul className="lista-avisos-tabla">
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
          <ul className="lista-avisos-tabla">
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
          <ul className="lista-avisos-tabla">
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
