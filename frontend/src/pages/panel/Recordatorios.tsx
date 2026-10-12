import { CalendarClock, Check, HeartPulse, MessageCircle, Phone, Syringe } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { apiGet, apiPost } from '../../lib/api'
import { diaLargo, fechaCortaDe, horaDe, hoyArgentina } from '../../lib/fechas'
import { formatearTelefono } from '../../lib/mascotas'
import { avisarCambioRecordatorios, mensajeDosis, mensajeRecupero, mensajeTurnoManana } from '../../lib/recordatorios'
import { enlaceWhatsapp, useSitio } from '../../lib/sitio'
import type { Pendientes } from '../../types'
import { IconoEspecie } from './Clientes'

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

  if (!pendientes) return error ? <p className="mensaje-error">{error}</p> : <p className="cargando">Cargando…</p>

  const { turnosManana, dosis, recuperar } = pendientes
  const nada = turnosManana.length + dosis.length + recuperar.length === 0

  return (
    <>
      <div className="panel-encabezado">
        <h1>Recordatorios</h1>
        <p>A quién hay que avisarle hoy. Cada botón abre WhatsApp con el mensaje listo: solo tenés que enviarlo.</p>
      </div>
      {error && <p className="mensaje-error">{error}</p>}

      {nada && (
        <div className="tarjeta">
          <p className="vacio">¡Todo al día! No hay avisos pendientes por hoy.</p>
        </div>
      )}

      {/* ---------- Turnos de mañana ---------- */}
      {turnosManana.length > 0 && (
        <section className="tarjeta bloque-ficha">
          <div className="bloque-ficha-titulo">
            <h2>
              <CalendarClock size={22} aria-hidden="true" /> Turnos de mañana ({turnosManana.length})
            </h2>
          </div>
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
        </section>
      )}

      {/* ---------- Vacunas y desparasitaciones ---------- */}
      {dosis.length > 0 && (
        <section className="tarjeta bloque-ficha">
          <div className="bloque-ficha-titulo">
            <h2>
              <Syringe size={22} aria-hidden="true" /> Vacunas y desparasitaciones ({dosis.length})
            </h2>
          </div>
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
        </section>
      )}

      {/* ---------- Clientes para recuperar ---------- */}
      {recuperar.length > 0 && (
        <section className="tarjeta bloque-ficha">
          <div className="bloque-ficha-titulo">
            <h2>
              <HeartPulse size={22} aria-hidden="true" /> Clientes para recuperar ({recuperar.length})
            </h2>
          </div>
          <p className="ayuda">Mascotas que no vienen hace más de 6 meses o que tienen vacunas vencidas hace más de un mes.</p>
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
        </section>
      )}
    </>
  )
}
