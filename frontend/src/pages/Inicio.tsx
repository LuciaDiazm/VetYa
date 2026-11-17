import {
  ArrowRight,
  Bandage,
  CalendarCheck,
  ChevronDown,
  Clock,
  CreditCard,
  MapPin,
  MessageCircle,
  Microscope,
  PawPrint,
  Scissors,
  Phone,
  ShoppingBag,
  Star,
  Syringe,
} from 'lucide-react'
import { Fragment, useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { IconoDiente } from '../components/IconoDiente'
import { Mapa } from '../components/Mapa'
import { revelarAlBajar } from '../lib/revelar'
import { agruparHorarios } from '../lib/horarios'
import { enlaceWhatsapp, esLimpiezaDental, useSitio } from '../lib/sitio'

// Cada tarjeta de servicios (todas blancas) con su ícono y a dónde lleva.
const TARJETAS: {
  clave: 'CLINICA' | 'DIAGNOSTICO' | 'CIRUGIA' | 'LIMPIEZA' | 'ESTETICA'
  nombre: string
  icono: ReactNode
  enlace: string
  accion: string
}[] = [
  { clave: 'CLINICA', nombre: 'Consultas y vacunas', icono: <Syringe size={30} aria-hidden="true" />, enlace: '/turno?categoria=CLINICA', accion: 'Pedir turno' },
  { clave: 'DIAGNOSTICO', nombre: 'Análisis y ecografías', icono: <Microscope size={30} aria-hidden="true" />, enlace: '/turno?categoria=DIAGNOSTICO', accion: 'Pedir turno' },
  { clave: 'CIRUGIA', nombre: 'Cirugías', icono: <Bandage size={30} aria-hidden="true" />, enlace: '/cirugias', accion: 'Cómo se coordinan' },
  { clave: 'LIMPIEZA', nombre: 'Limpieza dental', icono: <IconoDiente size={30} aria-hidden="true" />, enlace: '/limpieza-dental', accion: 'Cómo se coordina' },
  { clave: 'ESTETICA', nombre: 'Baño y peluquería', icono: <Scissors size={30} aria-hidden="true" />, enlace: '/turno?categoria=ESTETICA', accion: 'Pedir turno' },
]

// Mientras se ve el botón grande de la portada, el de "Pedir turno" del encabezado se oculta (ver index.css).
function observarBotonPortada(boton: HTMLElement | null) {
  if (!boton) return
  const raiz = document.documentElement
  raiz.dataset.turnoPortada = 'visible'
  // El margen descuenta lo que tapa el encabezado fijo.
  const observador = new IntersectionObserver(
    ([entrada]) => {
      raiz.dataset.turnoPortada = entrada.isIntersecting ? 'visible' : 'oculto'
    },
    { rootMargin: '-80px 0px 0px 0px' },
  )
  observador.observe(boton)
  return () => {
    observador.disconnect()
    delete raiz.dataset.turnoPortada
  }
}

function iniciales(nombre: string, apellido: string) {
  return `${nombre[0] ?? ''}${apellido[0] ?? ''}`.toUpperCase()
}

// Las fechas sin hora se guardan a la medianoche UTC: se muestran en UTC para no correrse un día.

// La huella de la portada, girada un poco a la izquierda (y achicada apenas para que no se corte al girar)
const GIRO_HUELLA = 'rotate(-14 .5 .6) translate(.5 .58) scale(.92) translate(-.5 -.58)'

// Unas huellitas cruzan la tarjeta de contacto una sola vez, como si pasara un perrito.
// Van de abajo a la izquierda hacia arriba a la derecha, alternando pata izquierda y derecha.
function HuellitasQueCruzan() {
  return (
    <span className="huellitas-cruzan" aria-hidden="true">
      {Array.from({ length: 9 }, (_, i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          style={
            {
              left: `${4 + i * 11}%`,
              top: `${78 - i * 8 + (i % 2 ? -4 : 4)}%`,
              '--orden': i,
            } as CSSProperties
          }
        >
          <ellipse cx="12" cy="16" rx="5.2" ry="4.4" />
          <ellipse cx="5.6" cy="10.4" rx="2" ry="2.5" />
          <ellipse cx="9.4" cy="6.4" rx="2" ry="2.6" />
          <ellipse cx="14.6" cy="6.4" rx="2" ry="2.6" />
          <ellipse cx="18.4" cy="10.4" rx="2" ry="2.5" />
        </svg>
      ))}
    </span>
  )
}

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

  const { clinica, servicios, equipo, opiniones, formasPago, preguntas } = datos
  const mapaGoogle = `https://www.google.com/maps/search/?api=1&query=${clinica.latitud},${clinica.longitud}`

  return (
    <main className="fondo-huellas">
      {/* ---------- Portada (franja de vidrio esmerilado, de borde a borde, sobre manchas de color) ---------- */}
      <div className="portada-escena">
        <div className="portada-vidrio">
          <section className="contenedor portada" aria-labelledby="titulo-portada">
            <div className="portada-texto">
              <h1 id="titulo-portada" className="titulo-portada">
                {/* Cada palabra sube apenas después de la anterior (ver .palabra en index.css) */}
                <span className="titulo-cursiva">
                  <span className="palabra" style={{ '--orden': 0 } as CSSProperties}>Clínica</span>{' '}
                  <span className="palabra" style={{ '--orden': 1 } as CSSProperties}>veterinaria</span>
                </span>
                <span className="titulo-serif">
                  <span className="palabra" style={{ '--orden': 2 } as CSSProperties}>en</span>{' '}
                  <span className="palabra" style={{ '--orden': 3 } as CSSProperties}>Goya</span>
                </span>
              </h1>
              <p className="portada-bajada">Cuidamos a tu mascota como parte de tu familia.</p>
              <div className="portada-acciones">
                <Link to="/turno" className="boton boton-grande boton-brillo" ref={observarBotonPortada}>
                  <CalendarCheck size={22} aria-hidden="true" />
                  Pedir turno
                </Link>
                <a href="#servicios" className="boton boton-grande boton-contorno">
                  Ver servicios
                </a>
              </div>
            </div>

            {/* El perrito dentro de una huella gigante: la cara queda en la palma y los dedos muestran el fondo de la foto */}
            <div className="portada-lado">
              <svg width="0" height="0" aria-hidden="true" focusable="false" className="huella-recorte">
                <defs>
                  {/* Cada parte va girada un poco a la izquierda (en clipPath no se puede agrupar con <g>) */}
                  <clipPath id="forma-huella" clipPathUnits="objectBoundingBox">
                    <path d="M .5 .35 C .68 .35 .82 .51 .88 .68 C .95 .86 .83 .99 .67 .98 C .59 .975 .55 .94 .5 .94 C .45 .94 .41 .975 .33 .98 C .17 .99 .05 .86 .12 .68 C .18 .51 .32 .35 .5 .35 Z" transform={GIRO_HUELLA} />
                    <ellipse cx=".11" cy=".42" rx=".1" ry=".115" transform={GIRO_HUELLA} className="dedo" style={{ '--orden': 0 } as CSSProperties} />
                    <ellipse cx=".32" cy=".19" rx=".115" ry=".13" transform={GIRO_HUELLA} className="dedo" style={{ '--orden': 1 } as CSSProperties} />
                    <ellipse cx=".68" cy=".19" rx=".115" ry=".13" transform={GIRO_HUELLA} className="dedo" style={{ '--orden': 2 } as CSSProperties} />
                    <ellipse cx=".89" cy=".42" rx=".1" ry=".115" transform={GIRO_HUELLA} className="dedo" style={{ '--orden': 3 } as CSSProperties} />
                  </clipPath>
                </defs>
              </svg>
              <div className="portada-foto-sombra">
                <div className="portada-foto">
                  <img src="/fotos/perro-huella.webp" alt="Un perro con un estetoscopio en la boca" />
                </div>
              </div>

              <ul className="portada-ventajas">
                <li>
                  <span className="punto" aria-hidden="true" /> Turnos online
                </li>
                <li>
                  <span className="punto" aria-hidden="true" /> Te avisamos las vacunas
                </li>
                <li>
                  <span className="punto" aria-hidden="true" /> Historia clínica online
                </li>
                <li>
                  <span className="punto" aria-hidden="true" /> Atendemos urgencias
                </li>
              </ul>
            </div>
          </section>
        </div>
      </div>

      {/* ---------- Cinta en movimiento ---------- */}
      <div className="cinta" aria-hidden="true">
        <div className="cinta-pista">
          {Array.from({ length: 2 }, (_, i) => (
            // Cada grupo repite las frases 3 veces para cubrir hasta las pantallas más anchas.
            <span key={i} className="cinta-grupo">
              {Array.from({ length: 3 }, (_, j) => (
                <Fragment key={j}>
                  Veterinarios con experiencia <span className="cinta-punto" />
                  Perros y gatos <span className="cinta-punto" />
                  Turnos online <span className="cinta-punto" />
                </Fragment>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* ---------- Quiénes somos ---------- */}
      <section className="contenedor seccion sobre" aria-labelledby="titulo-sobre">
        <img src="/fotos/perro-asoma.webp" alt="" className="asomado asomado-izquierda" loading="lazy" />
        <img src="/fotos/gato-asoma.webp" alt="" className="asomado asomado-costado" loading="lazy" />
        <h2 id="titulo-sobre" className="sobre-frase">
          Veterinarios de Goya que atienden a cada mascota <strong>con tiempo, cariño</strong> y{' '}
          <strong>sin vueltas</strong>.
        </h2>
        {/* Equipo: sigue directo después de la frase, sin título aparte */}
        {equipo.length > 0 && (
          <div id="equipo" className="sobre-equipo">
            <p className="sobre-capacitacion">Nos capacitamos en forma permanente para cuidar mejor a tu mascota.</p>
            <ul className="grilla-equipo revelar-subir" ref={revelarAlBajar}>
              {equipo.map((m) => (
                <li key={m.id} className="miembro">
                  {m.fotoUrl ? (
                    <img src={m.fotoUrl} alt="" className="miembro-foto" loading="lazy" />
                  ) : (
                    <span className="miembro-avatar" aria-hidden="true">
                      {iniciales(m.nombre, m.apellido)}
                    </span>
                  )}
                  <h3>
                    {m.nombre} {m.apellido}
                  </h3>
                  {m.especialidad && <p className="miembro-datos">{m.especialidad}</p>}
                  {m.matricula && <p className="miembro-matricula">{m.matricula}</p>}
                  <a
                    href={enlaceWhatsapp(clinica.whatsapp, `Hola, quiero pedir un turno con ${m.nombre} ${m.apellido}.`)}
                    target="_blank"
                    rel="noreferrer"
                    className="boton boton-secundario"
                  >
                    Pedir turno con {m.nombre}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ---------- Servicios ---------- */}
      <section id="servicios" className="contenedor seccion servicios" aria-labelledby="titulo-servicios">
        <h2 id="titulo-servicios" className="titulo-centrado">
          Todo lo que tu mascota necesita
        </h2>
        <div className="mosaico revelar-costados" ref={revelarAlBajar}>
          {TARJETAS.map((c) => {
            const lista = servicios.filter((s) =>
              c.clave === 'LIMPIEZA' ? esLimpiezaDental(s) : s.categoria === c.clave && !esLimpiezaDental(s),
            )
            if (lista.length === 0) return null
            return (
              <article
                key={c.clave}
                className="mosaico-tarjeta"
              >
                <span className="mosaico-icono">{c.icono}</span>
                <div className="mosaico-texto">
                  <h3>{c.nombre}</h3>
                  <ul>
                    {lista.map((s) => (
                      <li key={s.id}>{s.nombre === c.nombre ? (s.descripcion ?? s.nombre) : s.nombre}</li>
                    ))}
                  </ul>
                  <Link to={c.enlace} className="mosaico-enlace" aria-label={`${c.nombre}: ${c.accion.toLowerCase()}`}>
                    {c.accion} <ArrowRight size={18} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
        <p className="servicios-productos">
          <ShoppingBag size={22} aria-hidden="true" />
          También tenemos alimentos, medicamentos y accesorios para tu mascota. Consultanos en la clínica.
        </p>
      </section>

      {/* ---------- Difusión: la clínica no gestiona adopciones, solo ayuda a difundir ---------- */}
      <section className="contenedor difusion difusion-cartel" aria-label="Ayuda para difundir">
        <p>
          <PawPrint size={22} aria-hidden="true" />
          ¿Encontraste un animal o buscás adoptar? Escribinos y te ayudamos a difundir.
        </p>
        <a
          href={enlaceWhatsapp(clinica.whatsapp, 'Hola, quiero que me ayuden a difundir un animal.')}
          target="_blank"
          rel="noreferrer"
          className="boton boton-whatsapp"
        >
          <MessageCircle size={20} aria-hidden="true" />
          Escribir por WhatsApp
        </a>
      </section>

      {/* ---------- Opiniones ---------- */}
      {opiniones.length > 0 && (
        <section className="contenedor seccion" aria-labelledby="titulo-opiniones">
          <h2 id="titulo-opiniones" className="titulo-centrado">
            Lo que dicen las familias
          </h2>
          <ul className="grilla-opiniones">
            {opiniones.map((o) => (
              <li key={o.id} className="opinion">
                <span className="estrellas" aria-label={`${o.puntaje} de 5 estrellas`}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} size={20} aria-hidden="true" fill={i < o.puntaje ? 'currentColor' : 'none'} />
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
        </section>
      )}

      {/* ---------- Preguntas frecuentes ---------- */}
      {preguntas.length > 0 && (
        // Franja de lado a lado; el dálmata espía desde el borde derecho.
        <section id="preguntas" className="preguntas-banda" aria-labelledby="titulo-preguntas">
          <div className="contenedor seccion preguntas-seccion">
            <div>
              <h2 id="titulo-preguntas">Preguntas frecuentes</h2>
              <div className="preguntas">
                {preguntas.map((p) => (
                  <details key={p.id}>
                    <summary>
                      {p.pregunta}
                      <ChevronDown size={22} aria-hidden="true" className="pregunta-flecha" />
                    </summary>
                    <p>{p.respuesta}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
          <img src="/fotos/dalmata-espia.webp" alt="" className="preguntas-foto" loading="lazy" />
        </section>
      )}

      {/* ---------- ¿Te quedaron dudas? ---------- */}
      {/* Franja blanca de borde a borde */}
      <section className="dudas-banda" aria-labelledby="titulo-dudas">
        <div className="contenedor">
          <Dudas whatsapp={clinica.whatsapp} />
        </div>
      </section>

      {/* ---------- Contacto ---------- */}
      {/* Franja de vidrio esmerilado de borde a borde, sobre manchas de color (como la portada) */}
      <section id="contacto" className="contacto-escena" aria-labelledby="titulo-contacto">
        <div className="contacto-vidrio">
          <div className="contenedor seccion">
            <h2 id="titulo-contacto" className="titulo-centrado">
              Dónde estamos
            </h2>
            <div className="contacto" ref={revelarAlBajar}>
              <div className="contacto-tarjeta">
                <HuellitasQueCruzan />
                <div className="dato-contacto">
                  <MapPin size={24} aria-hidden="true" />
                  <div>
                    <h3>Dirección</h3>
                    <p>{clinica.direccion}</p>
                  </div>
                </div>
                <div className="dato-contacto">
                  <Clock size={24} aria-hidden="true" />
                  <div>
                    <h3>Horarios</h3>
                    {agruparHorarios(clinica.horarios).map((r) => (
                      <p key={r.dias}>
                        {r.dias}: {r.horas}
                      </p>
                    ))}
                  </div>
                </div>
                <div className="dato-contacto">
                  <Phone size={24} aria-hidden="true" />
                  <div>
                    <h3>Teléfono</h3>
                    <p className="sin-corte">{clinica.telefono}</p>
                  </div>
                </div>
                {formasPago.length > 0 && (
                  <div className="dato-contacto">
                    <CreditCard size={24} aria-hidden="true" />
                    <div>
                      <h3>Formas de pago</h3>
                      <p>{formasPago.map((f) => f.nombre).join(', ')}.</p>
                    </div>
                  </div>
                )}
                <div className="contacto-botones">
                  <Link to="/turno" className="boton boton-secundario">
                    <CalendarCheck size={20} aria-hidden="true" />
                    Pedir turno
                  </Link>
                  <a href={`tel:+${clinica.whatsapp}`} className="boton boton-contorno">
                    <Phone size={20} aria-hidden="true" />
                    Llamar
                  </a>
                  <a href={mapaGoogle} target="_blank" rel="noreferrer" className="boton boton-contorno">
                    <MapPin size={20} aria-hidden="true" />
                    Cómo llegar
                  </a>
                </div>
              </div>
              <Mapa
                latitud={Number(clinica.latitud)}
                longitud={Number(clinica.longitud)}
                nombre={clinica.nombre}
                direccion={clinica.direccion}
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

// Formulario corto que arma un mensaje de WhatsApp con la consulta: no hace falta cuenta ni email.
function Dudas({ whatsapp }: { whatsapp: string }) {
  const [nombre, setNombre] = useState('')
  const [pregunta, setPregunta] = useState('')

  function enviar(e: FormEvent) {
    e.preventDefault()
    const mensaje = `Hola, soy ${nombre.trim()}. Tengo una consulta: ${pregunta.trim()}`
    window.open(enlaceWhatsapp(whatsapp, mensaje), '_blank', 'noreferrer')
  }

  return (
    <div className="dudas">
      <div className="dudas-texto">
        <h2 id="titulo-dudas">¿Te quedaron dudas?</h2>
        <p>Escribí tu pregunta. Te responde una persona de la clínica por WhatsApp.</p>
        <form className="formulario" onSubmit={enviar}>
          <label className="campo">
            Tu nombre
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} required autoComplete="given-name" />
          </label>
          <label className="campo">
            Tu pregunta
            <textarea value={pregunta} onChange={(e) => setPregunta(e.target.value)} required rows={3} />
          </label>
          <button type="submit" className="boton boton-grande">
            <MessageCircle size={22} aria-hidden="true" />
            Enviar por WhatsApp
          </button>
        </form>
      </div>
      <img src="/fotos/gatito-papel.webp" alt="" className="dudas-foto" loading="lazy" />
    </div>
  )
}
