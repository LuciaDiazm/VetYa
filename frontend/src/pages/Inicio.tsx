import {
  BadgePercent,
  CalendarCheck,
  CalendarHeart,
  Check,
  Clock,
  CreditCard,
  FileHeart,
  MapPin,
  MessageCircle,
  Phone,
  Star,
} from 'lucide-react'
import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Mapa } from '../components/Mapa'
import { VideoPortada } from '../components/VideoPortada'
import { agruparHorarios } from '../lib/horarios'
import { enlaceWhatsapp, MENSAJE_TURNO, useSitio } from '../lib/sitio'
import type { CategoriaServicio, DosisPlan } from '../types'

const NOMBRE_CATEGORIA: Record<CategoriaServicio, string> = {
  CLINICA: 'Clínica',
  DIAGNOSTICO: 'Diagnóstico',
  CIRUGIA: 'Cirugía',
  ESTETICA: 'Estética',
}

// 6 semanas → "6 semanas"; 16 semanas → "16 semanas (4 meses)"
function edadDosis(dosis: DosisPlan) {
  const semanas = `${dosis.edadSemanas} semanas`
  return dosis.edadSemanas >= 12 && dosis.edadSemanas % 4 === 0
    ? `${semanas} (${dosis.edadSemanas / 4} meses)`
    : semanas
}

function iniciales(nombre: string, apellido: string) {
  return `${nombre[0] ?? ''}${apellido[0] ?? ''}`.toUpperCase()
}

// Las fechas sin hora se guardan a la medianoche UTC: se muestran en UTC para no correrse un día.
const FECHA_PROMO = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', timeZone: 'UTC' })

export function Inicio() {
  const { datos, error } = useSitio()
  const { hash } = useLocation()

  // Al llegar con un enlace como "/#servicios", baja hasta esa sección cuando ya cargó.
  useEffect(() => {
    if (datos && hash) document.getElementById(hash.slice(1))?.scrollIntoView()
  }, [datos, hash])

  if (error) {
    return (
      <main className="contenedor seccion">
        <p className="mensaje-error">
          No pudimos cargar la información de la clínica. Revisá que el servidor esté encendido y recargá la página.
        </p>
      </main>
    )
  }
  if (!datos) return <p className="cargando">Cargando…</p>

  const { clinica, servicios, equipo, opiniones, formasPago, planes, promociones, preguntas } = datos
  const whatsappTurno = enlaceWhatsapp(clinica.whatsapp, MENSAJE_TURNO)
  const promo = promociones[0]

  return (
    <main>
      {promo && (
        <div className="franja-promo">
          <div className="contenedor franja-promo-interior">
            <BadgePercent size={20} aria-hidden="true" />
            <p>
              <strong>{promo.titulo}.</strong> {promo.descripcion} Válido hasta el{' '}
              {FECHA_PROMO.format(new Date(promo.vigenteHasta))}.
            </p>
          </div>
        </div>
      )}

      {/* ---------- Portada con video ---------- */}
      <section className="portada-video" aria-labelledby="titulo-portada">
        <VideoPortada />
        <div className="portada-video-texto">
          <p className="portada-video-bajada">Clínica veterinaria en Goya, Corrientes</p>
          <h1 id="titulo-portada">{clinica.nombre}</h1>
          <p className="portada-video-frase">Cuidamos a tu mascota como parte de tu familia.</p>
          <div className="portada-acciones">
            <a href={whatsappTurno} target="_blank" rel="noreferrer" className="boton boton-secundario">
              <MessageCircle size={20} aria-hidden="true" />
              Pedir turno
            </a>
            <a href="#servicios" className="boton boton-claro">
              Ver servicios
            </a>
          </div>
        </div>
      </section>

      {/* ---------- Presentación ---------- */}
      <section className="contenedor presentacion">
        <div className="presentacion-texto">
          <h2>Atención completa para perros y gatos</h2>
          <p>
            Consultas, vacunas, análisis, ecografías, cirugías y peluquería, todo en el mismo lugar. Sacá turno sin
            llamar y te avisamos por WhatsApp cuando le toque la próxima vacuna o desparasitación.
          </p>
          <ul className="portada-ventajas">
            <li>
              <Check size={18} aria-hidden="true" /> Turnos sin necesidad de llamar
            </li>
            <li>
              <Check size={18} aria-hidden="true" /> Recordatorios de vacunas por WhatsApp
            </li>
            <li>
              <Check size={18} aria-hidden="true" /> Historia clínica y carnet en tu celular
            </li>
          </ul>
        </div>

        <div className="portada-imagen">
          <img src="/fotos/consulta.jpg" alt="Un veterinario revisa a un perro salchicha en la camilla" />
          <div className="aviso-whatsapp" aria-hidden="true">
            <span className="aviso-whatsapp-icono">
              <MessageCircle size={18} />
            </span>
            <div>
              <strong>{clinica.nombre}</strong>
              <p>Hola Juan, a Firulais le toca la antirrábica el jueves. ¿Te reservamos un turno?</p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Equipo ---------- */}
      {equipo.length > 0 && (
        <section id="equipo" className="seccion seccion-celeste" aria-labelledby="titulo-equipo">
          <div className="contenedor">
            <div className="seccion-encabezado">
              <h2 id="titulo-equipo">Nuestro equipo</h2>
              <p>Las personas que van a atender a tu mascota.</p>
            </div>
            <ul className="grilla-equipo">
              {equipo.map((m) => (
                <li key={m.id} className="tarjeta miembro">
                  {m.fotoUrl ? (
                    <img src={m.fotoUrl} alt="" className="miembro-avatar" />
                  ) : (
                    <span className="miembro-avatar" aria-hidden="true">
                      {iniciales(m.nombre, m.apellido)}
                    </span>
                  )}
                  <div>
                    <h3>
                      {m.nombre} {m.apellido}
                    </h3>
                    <p className="miembro-datos">
                      {[m.especialidad, m.matricula].filter(Boolean).join(', ')}
                    </p>
                    {m.presentacion && <p>{m.presentacion}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ---------- Servicios ---------- */}
      <section id="servicios" className="seccion" aria-labelledby="titulo-servicios">
        <div className="contenedor">
          <div className="seccion-encabezado">
            <h2 id="titulo-servicios">Servicios</h2>
            <p>Desde el control de rutina hasta la peluquería, todo en la misma clínica.</p>
          </div>
          <ul className="grilla-servicios">
            {servicios.map((s) => (
              <li key={s.id} className="servicio">
                {s.fotoUrl && <img src={s.fotoUrl} alt="" loading="lazy" className="servicio-foto" />}
                <div className="servicio-cuerpo">
                  <span className={`etiqueta etiqueta-${s.categoria}`}>{NOMBRE_CATEGORIA[s.categoria]}</span>
                  <h3>{s.nombre}</h3>
                  {s.descripcion && <p>{s.descripcion}</p>}
                  <span className="servicio-duracion">
                    {s.reservableOnline ? (
                      <>
                        <Clock size={16} aria-hidden="true" /> Duración aproximada: {s.duracionMin} min
                      </>
                    ) : (
                      <>
                        <CalendarHeart size={16} aria-hidden="true" /> Se coordina con la clínica
                      </>
                    )}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------- Planes sanitarios ---------- */}
      {planes.length > 0 && (
        <section id="planes" className="seccion" aria-labelledby="titulo-planes">
          <div className="contenedor">
            <div className="seccion-encabezado">
              <h2 id="titulo-planes">Planes para el primer año</h2>
              <p>
                El calendario de vacunas y desparasitaciones según la edad. Es orientativo: en la primera consulta lo
                adaptamos a tu mascota y te avisamos antes de cada dosis.
              </p>
            </div>
            <div className="grilla-planes">
              {planes.map((plan) => (
                <article key={plan.id} className="plan">
                  {plan.fotoUrl && <img src={plan.fotoUrl} alt="" loading="lazy" className="plan-foto" />}
                  <div className="plan-cuerpo">
                    <h3>{plan.nombre}</h3>
                    <p>{plan.descripcion}</p>
                    <ol className="linea-tiempo">
                      {plan.dosis.map((d) => (
                        <li key={d.id}>
                          <span className="linea-tiempo-edad">{edadDosis(d)}</span>
                          <span>
                            {d.producto}
                            {d.nota && <span className="linea-tiempo-nota"> {d.nota}</span>}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------- Opiniones ---------- */}
      {opiniones.length > 0 && (
        <section className="seccion seccion-amarilla" aria-labelledby="titulo-opiniones">
          <div className="contenedor">
            <div className="seccion-encabezado">
              <h2 id="titulo-opiniones">Lo que dicen las familias</h2>
            </div>
            <ul className="grilla-opiniones">
              {opiniones.map((o) => (
                <li key={o.id} className="opinion">
                  <span className="estrellas" aria-label={`${o.puntaje} de 5 estrellas`}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star key={i} size={18} aria-hidden="true" fill={i < o.puntaje ? 'currentColor' : 'none'} />
                    ))}
                  </span>
                  <blockquote>{o.texto}</blockquote>
                  <p className="opinion-autor">
                    {o.autor}
                    {o.mascota && <span>, con {o.mascota}</span>}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ---------- Banda de turno ---------- */}
      <section className="banda-turno" aria-labelledby="titulo-banda">
        <div className="contenedor banda-turno-interior">
          <div>
            <h2 id="titulo-banda">Pedí tu turno</h2>
            <p>Escribinos por WhatsApp y te respondemos con los horarios disponibles. También podés llamarnos al {clinica.telefono}.</p>
          </div>
          <a href={whatsappTurno} target="_blank" rel="noreferrer" className="boton boton-secundario">
            <MessageCircle size={20} aria-hidden="true" />
            Pedir turno por WhatsApp
          </a>
        </div>
      </section>

      {/* ---------- Formas de pago y preguntas frecuentes ---------- */}
      <section className="seccion" aria-label="Formas de pago y preguntas frecuentes">
        <div className="contenedor grilla-dos">
          {formasPago.length > 0 && (
            <div>
              <h2>Formas de pago</h2>
              <ul className="lista-pagos">
                {formasPago.map((f) => (
                  <li key={f.id}>
                    <span className="icono-circulo">
                      <CreditCard size={20} aria-hidden="true" />
                    </span>
                    <div>
                      <strong>{f.nombre}</strong>
                      {f.detalle && <p>{f.detalle}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {preguntas.length > 0 && (
            <div>
              <h2>Preguntas frecuentes</h2>
              <div className="preguntas">
                {preguntas.map((p) => (
                  <details key={p.id}>
                    <summary>{p.pregunta}</summary>
                    <p>{p.respuesta}</p>
                  </details>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ---------- Contacto ---------- */}
      <section id="contacto" className="seccion seccion-celeste" aria-labelledby="titulo-contacto">
        <div className="contenedor">
          <div className="seccion-encabezado">
            <h2 id="titulo-contacto">Cómo llegar</h2>
          </div>
          <div className="contacto">
            <Mapa
              latitud={Number(clinica.latitud)}
              longitud={Number(clinica.longitud)}
              nombre={clinica.nombre}
              direccion={clinica.direccion}
            />
            <div className="contacto-datos">
              <div className="dato-contacto">
                <span className="icono-circulo">
                  <MapPin size={22} aria-hidden="true" />
                </span>
                <div>
                  <h3>Dirección</h3>
                  <p>{clinica.direccion}</p>
                </div>
              </div>
              <div className="dato-contacto">
                <span className="icono-circulo">
                  <Clock size={22} aria-hidden="true" />
                </span>
                <div>
                  <h3>Horarios</h3>
                  {agruparHorarios(clinica.horarios).map((r) => (
                    <p key={r.dias}>
                      <strong>{r.dias}:</strong> {r.horas}
                    </p>
                  ))}
                </div>
              </div>
              <div className="dato-contacto">
                <span className="icono-circulo">
                  <Phone size={22} aria-hidden="true" />
                </span>
                <div>
                  <h3>Teléfono</h3>
                  <p className="sin-corte">{clinica.telefono}</p>
                </div>
              </div>
              <a href={whatsappTurno} target="_blank" rel="noreferrer" className="boton boton-whatsapp">
                <MessageCircle size={20} aria-hidden="true" />
                Pedir turno por WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Cierre ---------- */}
      <section className="contenedor cierre">
        <div className="cierre-panel">
          <FileHeart size={40} aria-hidden="true" />
          <div>
            <h2>Toda la salud de tu mascota en tu celular</h2>
            <p>Creá tu cuenta y mirá sus vacunas, sus consultas y tus próximos turnos cuando quieras.</p>
          </div>
          <Link to="/registro" className="boton boton-secundario">
            <CalendarCheck size={20} aria-hidden="true" />
            Crear mi cuenta
          </Link>
        </div>
      </section>
    </main>
  )
}
