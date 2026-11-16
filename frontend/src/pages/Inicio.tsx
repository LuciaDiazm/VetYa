import {
  ArrowRight,
  BellRing,
  CalendarCheck,
  Clock,
  CreditCard,
  FileHeart,
  HeartHandshake,
  HeartPulse,
  MapPin,
  MessageCircle,
  PawPrint,
  Phone,
  ShoppingBag,
  Siren,
  Star,
  Stethoscope,
  Syringe,
} from 'lucide-react'
import { Fragment, useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Mapa } from '../components/Mapa'
import { agruparHorarios } from '../lib/horarios'
import { enlaceWhatsapp, esLimpiezaDental, useSitio } from '../lib/sitio'
import type { CategoriaServicio, DosisPlan } from '../types'

// Cada tarjeta de servicios con su foto, su estilo y a dónde lleva.
// "recorte": la foto es un animal sin fondo, que se apoya en el borde de abajo de la tarjeta.
const TARJETAS: {
  clave: CategoriaServicio | 'LIMPIEZA'
  nombre: string
  foto: string
  recorte?: boolean
  oscura: boolean
  enlace: string
  accion: string
}[] = [
  { clave: 'CLINICA', nombre: 'Consultas y vacunas', foto: '/fotos/vacuna-gatito.webp', oscura: false, enlace: '/turno?categoria=CLINICA', accion: 'Pedir turno' },
  { clave: 'DIAGNOSTICO', nombre: 'Análisis y ecografías', foto: '/fotos/analisis.webp', oscura: true, enlace: '/turno?categoria=DIAGNOSTICO', accion: 'Pedir turno' },
  { clave: 'CIRUGIA', nombre: 'Cirugías', foto: '/fotos/cirugia.webp', oscura: true, enlace: '/cirugias', accion: 'Cómo se coordinan' },
  { clave: 'LIMPIEZA', nombre: 'Limpieza dental', foto: '/fotos/limpieza-dental.webp', recorte: true, oscura: false, enlace: '/limpieza-dental', accion: 'Cómo se coordina' },
  { clave: 'ESTETICA', nombre: 'Baño y peluquería', foto: '/fotos/perro-toalla.webp', oscura: false, enlace: '/turno?categoria=ESTETICA', accion: 'Pedir turno' },
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

// 6 semanas → "6 semanas"; 16 semanas → "4 meses"
function edadDosis(dosis: DosisPlan) {
  return dosis.edadSemanas >= 12 && dosis.edadSemanas % 4 === 0
    ? `${dosis.edadSemanas / 4} meses`
    : `${dosis.edadSemanas} semanas`
}

function iniciales(nombre: string, apellido: string) {
  return `${nombre[0] ?? ''}${apellido[0] ?? ''}`.toUpperCase()
}

// Las fechas sin hora se guardan a la medianoche UTC: se muestran en UTC para no correrse un día.

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

  const { clinica, servicios, equipo, opiniones, formasPago, planes, preguntas } = datos
  const mapaGoogle = `https://www.google.com/maps/search/?api=1&query=${clinica.latitud},${clinica.longitud}`

  return (
    <main className="fondo-huellas">
      {/* La clínica no quiere un enfoque comercial: la franja cuenta algo útil en vez de una promoción. */}
      <div className="franja-promo">
        <div className="contenedor franja-promo-interior">
          <BellRing size={20} aria-hidden="true" />
          <p>
            <strong>No te olvides de sus vacunas:</strong> te avisamos por WhatsApp cuando le toca la próxima.
          </p>
        </div>
      </div>

      {/* ---------- Portada ---------- */}
      <section className="contenedor portada" aria-labelledby="titulo-portada">
        <div className="portada-texto">
          <h1 id="titulo-portada">Clínica veterinaria en Goya</h1>
          <p className="portada-bajada">Cuidamos a tu mascota como parte de tu familia.</p>
          <div className="portada-acciones">
            <Link to="/turno" className="boton boton-grande" ref={observarBotonPortada}>
              <CalendarCheck size={22} aria-hidden="true" />
              Pedir turno
            </Link>
            <a href="#servicios" className="boton boton-grande boton-contorno">
              Ver servicios
            </a>
          </div>
        </div>

        <div className="portada-foto">
          <img src="/fotos/perro-inicio.webp" alt="Un perro con un estetoscopio en la boca" />
        </div>

        <ul className="portada-ventajas">
          <li>
            <PawPrint size={22} aria-hidden="true" /> Turnos online
          </li>
          <li>
            <PawPrint size={22} aria-hidden="true" /> Te avisamos las vacunas
          </li>
          <li>
            <PawPrint size={22} aria-hidden="true" /> Historia clínica online
          </li>
          <li>
            <PawPrint size={22} aria-hidden="true" /> Atendemos urgencias
          </li>
        </ul>
      </section>

      {/* ---------- Cinta en movimiento ---------- */}
      <div className="cinta" aria-hidden="true">
        <div className="cinta-pista">
          {Array.from({ length: 2 }, (_, i) => (
            // Cada grupo repite las frases 3 veces para cubrir hasta las pantallas más anchas.
            <span key={i} className="cinta-grupo">
              {Array.from({ length: 3 }, (_, j) => (
                <Fragment key={j}>
                  <strong>VetYa</strong> Clínica veterinaria en Goya <PawPrint size={18} />
                  <strong>VetYa</strong> Turnos online <PawPrint size={18} />
                  <strong>VetYa</strong> Perros y gatos <PawPrint size={18} />
                </Fragment>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* ---------- ¿Qué necesitás? ---------- */}
      <section className="contenedor seccion" aria-labelledby="titulo-necesitas">
        <h2 id="titulo-necesitas" className="titulo-centrado">
          ¿Qué necesitás?
        </h2>
        <div className="accesos">
          <Link to="/turno" className="acceso-rapido">
            <span className="acceso-icono">
              <CalendarCheck size={34} aria-hidden="true" />
            </span>
            <span className="acceso-textos">
              <strong>Pedir un turno</strong>
              <span>Online, sin llamar</span>
            </span>
          </Link>
          <Link to="/urgencias" className="acceso-rapido acceso-urgencia">
            <span className="acceso-icono">
              <Siren size={34} aria-hidden="true" />
            </span>
            <span className="acceso-textos">
              <strong>Es una urgencia</strong>
              <span>Qué hacer y a quién llamar</span>
            </span>
          </Link>
          <a href="#contacto" className="acceso-rapido">
            <span className="acceso-icono">
              <MapPin size={34} aria-hidden="true" />
            </span>
            <span className="acceso-textos">
              <strong>Horarios y dirección</strong>
              <span>Cuándo abrimos y cómo llegar</span>
            </span>
          </a>
          <Link to="/ingresar" className="acceso-rapido">
            <span className="acceso-icono">
              <FileHeart size={34} aria-hidden="true" />
            </span>
            <span className="acceso-textos">
              <strong>Ver a mi mascota</strong>
              <span>Vacunas y consultas</span>
            </span>
          </Link>
        </div>
      </section>

      {/* ---------- Sobre nosotros ---------- */}
      <section className="contenedor seccion sobre" aria-labelledby="titulo-sobre">
        <img src="/fotos/gato-costado.webp" alt="" className="asomado asomado-costado" loading="lazy" />
        <p className="pastilla">Sobre nosotros</p>
        <h2 id="titulo-sobre" className="sobre-frase">
          Veterinarios de Goya que atienden a cada mascota <strong>con tiempo, cariño</strong> y{' '}
          <strong>sin vueltas</strong>.
        </h2>
        <div className="sobre-tarjetas">
          <div className="tarjeta-dato tarjeta-oscura">
            <Stethoscope size={30} aria-hidden="true" />
            <h3>Veterinarios con experiencia</h3>
          </div>
          <div className="tarjeta-dato">
            <Syringe size={30} aria-hidden="true" />
            <h3>Te avisamos cada vacuna</h3>
          </div>
          <div className="tarjeta-dato">
            <HeartPulse size={30} aria-hidden="true" />
            <h3>Su historia clínica, siempre a mano</h3>
          </div>
        </div>
      </section>

      {/* ---------- Servicios ---------- */}
      <section id="servicios" className="contenedor seccion servicios" aria-labelledby="titulo-servicios">
        <p className="pastilla">Servicios</p>
        <h2 id="titulo-servicios" className="titulo-centrado">
          Todo lo que tu mascota necesita
        </h2>
        <div className="mosaico">
          {TARJETAS.map((c) => {
            const lista = servicios.filter((s) =>
              c.clave === 'LIMPIEZA' ? esLimpiezaDental(s) : s.categoria === c.clave && !esLimpiezaDental(s),
            )
            if (lista.length === 0) return null
            return (
              <article
                key={c.clave}
                className={`mosaico-tarjeta${c.oscura ? ' tarjeta-oscura' : ''}${c.recorte ? ' mosaico-recorte' : ''}`}
              >
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
                <img src={c.foto} alt="" loading="lazy" />
              </article>
            )
          })}
        </div>
        <p className="servicios-productos">
          <ShoppingBag size={22} aria-hidden="true" />
          También tenemos alimentos, medicamentos y accesorios para tu mascota. Consultanos en la clínica.
        </p>
      </section>

      {/* ---------- Planes ---------- */}
      {planes.length > 0 && (
        <section id="planes" className="contenedor seccion" aria-labelledby="titulo-planes">
          <p className="pastilla">Cachorros y gatitos</p>
          <h2 id="titulo-planes" className="titulo-centrado">
            Sus vacunas del primer año
          </h2>
          <p className="texto-centrado">Te avisamos por WhatsApp antes de cada una.</p>
          <div className="grilla-planes">
            {planes.map((plan) => (
              <article key={plan.id} className="plan">
                {plan.fotoUrl && <img src={plan.fotoUrl} alt="" loading="lazy" className="plan-foto" />}
                <div className="plan-cuerpo">
                  <h3>{plan.nombre}</h3>
                  <ol className="linea-tiempo">
                    {plan.dosis.map((d) => (
                      <li key={d.id}>
                        <span className="linea-tiempo-edad">{edadDosis(d)}</span>
                        <span>{d.producto}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ---------- Adopción ---------- */}
      <section className="contenedor seccion" aria-labelledby="titulo-adopcion">
        <div className="adopcion-invitacion">
          <img src="/fotos/perros-asomados.webp" alt="" className="asomado asomado-perros" loading="lazy" />
          <div>
            <p className="pastilla pastilla-izquierda">Adopción</p>
            <h2 id="titulo-adopcion">Perros y gatos de Goya buscan familia</h2>
            <p>Ayudamos a difundirlos y la adopción es gratuita. Elegí por tamaño, edad o cómo son.</p>
            <Link to="/adopcion" className="boton boton-grande boton-secundario">
              <HeartHandshake size={22} aria-hidden="true" />
              Conocelos
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Equipo ---------- */}
      {equipo.length > 0 && (
        <section id="equipo" className="contenedor seccion" aria-labelledby="titulo-equipo">
          <p className="pastilla">Nuestro equipo</p>
          <h2 id="titulo-equipo" className="titulo-centrado">
            Quiénes atienden a tu mascota
          </h2>
          <p className="texto-centrado">Nos capacitamos en forma permanente para cuidar mejor a tu mascota.</p>
          <ul className="grilla-equipo">
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
        </section>
      )}

      {/* ---------- Opiniones ---------- */}
      {opiniones.length > 0 && (
        <section className="contenedor seccion" aria-labelledby="titulo-opiniones">
          <p className="pastilla">Opiniones</p>
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
                    <summary>{p.pregunta}</summary>
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
      <section className="contenedor seccion" aria-labelledby="titulo-dudas">
        <Dudas whatsapp={clinica.whatsapp} />
      </section>

      {/* ---------- Contacto ---------- */}
      <section id="contacto" className="contenedor seccion" aria-labelledby="titulo-contacto">
        <p className="pastilla">Contacto</p>
        <h2 id="titulo-contacto" className="titulo-centrado">
          Dónde estamos
        </h2>
        <div className="contacto">
          <div className="contacto-tarjeta">
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
              <a href={`tel:+${clinica.whatsapp}`} className="boton boton-claro">
                <Phone size={20} aria-hidden="true" />
                Llamar
              </a>
              <a href={mapaGoogle} target="_blank" rel="noreferrer" className="boton boton-claro">
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
      <img src="/fotos/siames-saluda.webp" alt="" className="dudas-foto" loading="lazy" />
    </div>
  )
}
