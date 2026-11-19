import {
  ArrowRight,
  Bandage,
  CalendarCheck,
  Check,
  Clock,
  CreditCard,
  MapPin,
  MessageCircle,
  Microscope,
  Scissors,
  Phone,
  ShoppingBag,
  Star,
  Syringe,
} from 'lucide-react'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { IconoDiente } from '../components/IconoDiente'
import { Mapa } from '../components/Mapa'
import { diaSemanaHoy } from '../lib/fechas'
import { agruparHorarios, horarioDelDia } from '../lib/horarios'
import { enlaceTelefono, enlaceWhatsapp, esLimpiezaDental, MENSAJE_TURNO, useSitio } from '../lib/sitio'
import { Cargando } from '../components/Cargando'
import type { HorarioAtencion } from '../types'

type Clave = 'CLINICA' | 'DIAGNOSTICO' | 'CIRUGIA' | 'LIMPIEZA' | 'ESTETICA'

// Cada servicio con su ícono, su foto (la que se ve al lado de la lista) y a dónde lleva.
const SERVICIOS: {
  clave: Clave
  nombre: string
  icono: ReactNode
  foto: string
  textoFoto: string
  enlace: string
  accion: string
}[] = [
  {
    clave: 'CLINICA',
    nombre: 'Consultas y vacunas',
    icono: <Syringe size={24} aria-hidden="true" />,
    foto: '/fotos/vacuna-gatito.webp',
    textoFoto: 'Una veterinaria vacuna a un gatito',
    enlace: '/turno?categoria=CLINICA',
    accion: 'Pedir turno',
  },
  {
    clave: 'DIAGNOSTICO',
    nombre: 'Análisis y ecografías',
    icono: <Microscope size={24} aria-hidden="true" />,
    foto: '/fotos/analisis.webp',
    textoFoto: 'Manos con guantes alrededor de la cara de un cachorro',
    enlace: '/turno?categoria=DIAGNOSTICO',
    accion: 'Pedir turno',
  },
  {
    clave: 'CIRUGIA',
    nombre: 'Cirugías',
    icono: <Bandage size={24} aria-hidden="true" />,
    foto: '/fotos/cirugia.webp',
    textoFoto: 'Manos con guantes sostienen la pata de un perro',
    enlace: '/cirugias',
    accion: 'Cómo se coordinan',
  },
  {
    clave: 'LIMPIEZA',
    nombre: 'Limpieza dental',
    icono: <IconoDiente size={24} aria-hidden="true" />,
    foto: '/fotos/limpieza-dental.webp',
    textoFoto: 'Un perro con un cepillo de dientes en la boca',
    enlace: '/limpieza-dental',
    accion: 'Cómo se coordina',
  },
  {
    clave: 'ESTETICA',
    nombre: 'Baño y peluquería',
    icono: <Scissors size={24} aria-hidden="true" />,
    foto: '/fotos/perro-toalla.webp',
    textoFoto: 'Un perro envuelto en una toalla después del baño',
    enlace: '/turno?categoria=ESTETICA',
    accion: 'Pedir turno',
  },
]

// Cómo se saca un turno por la web, tal como funciona hoy el sistema.
// Las fotos son del mismo corgi (una pequeña historia): mira la compu, espera al lado y queda contento.
const PASOS: { titulo: string; texto: string; foto: string }[] = [
  {
    titulo: 'Creá tu cuenta',
    texto: 'Con tu nombre, tu email y el teléfono de WhatsApp.',
    foto: '/fotos/paso-cuenta.webp',
  },
  {
    titulo: 'Elegí servicio, día y hora',
    texto: 'Ves los horarios libres y el turno queda confirmado en el momento.',
    foto: '/fotos/paso-dia.webp',
  },
  {
    titulo: 'Te avisamos el día anterior',
    texto: 'Te escribimos por WhatsApp para recordarte el turno.',
    foto: '/fotos/paso-aviso.webp',
  },
]

// La frase de las vacunas: cada palabra se enciende a medida que la sección sube (ver .palabras-encienden).
const FRASE_VACUNAS =
  'Anotamos cada vacuna con la fecha de la próxima. Cuando se acerca, te escribimos por WhatsApp. En tu cuenta ves todas sus vacunas y bajás el carnet en PDF.'

// Para no repetir "Pedir turno": mientras se ve el de la portada o el de "Dónde estamos",
// el del encabezado se oculta (ver index.css). Se anotan los botones que están a la vista.
const botonesTurnoALaVista = new Set<Element>()

function actualizarBotonEncabezado() {
  // Los <Link> no avisan cuando se desmontan: se descartan los botones que ya no están en la página.
  for (const b of botonesTurnoALaVista) if (!b.isConnected) botonesTurnoALaVista.delete(b)
  document.documentElement.dataset.turnoPortada = botonesTurnoALaVista.size > 0 ? 'visible' : 'oculto'
}

function observarBotonTurno(boton: HTMLElement | null) {
  if (!boton) return
  // Primera medida en el momento, para que el encabezado no muestre el botón ni un instante de más.
  const caja = boton.getBoundingClientRect()
  if (caja.bottom > 80 && caja.top < window.innerHeight) botonesTurnoALaVista.add(boton)
  actualizarBotonEncabezado()
  // El margen descuenta lo que tapa el encabezado fijo.
  const observador = new IntersectionObserver(
    ([entrada]) => {
      if (!boton.isConnected) observador.disconnect()
      if (entrada.isIntersecting && boton.isConnected) botonesTurnoALaVista.add(boton)
      else botonesTurnoALaVista.delete(boton)
      actualizarBotonEncabezado()
    },
    { rootMargin: '-80px 0px 0px 0px' },
  )
  observador.observe(boton)
}

function iniciales(nombre: string, apellido: string) {
  return `${nombre[0] ?? ''}${apellido[0] ?? ''}`.toUpperCase()
}

export function Inicio() {
  const { datos, error } = useSitio()
  const { hash } = useLocation()
  // El servicio cuya foto se ve al lado de la lista (cambia al pasar el mouse, al tocar o con Tab).
  const [servicioActivo, setServicioActivo] = useState<Clave>('CLINICA')

  // Al salir del inicio, el botón del encabezado vuelve a verse siempre.
  useEffect(
    () => () => {
      botonesTurnoALaVista.clear()
      delete document.documentElement.dataset.turnoPortada
    },
    [],
  )

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
  if (!datos) return <Cargando />

  const { clinica, servicios, equipo, opiniones, formasPago, preguntas } = datos
  const mapaGoogle = `https://www.google.com/maps/search/?api=1&query=${clinica.latitud},${clinica.longitud}`

  // Solo los servicios que la clínica tiene cargados, cada uno con su lista
  const filas = SERVICIOS.map((c) => ({
    ...c,
    lista: servicios.filter((s) =>
      c.clave === 'LIMPIEZA' ? esLimpiezaDental(s) : s.categoria === c.clave && !esLimpiezaDental(s),
    ),
  })).filter((c) => c.lista.length > 0)
  const activo = filas.some((f) => f.clave === servicioActivo) ? servicioActivo : filas[0]?.clave

  const palabras = FRASE_VACUNAS.split(' ')

  return (
    <main className="inicio">
      {/* ---------- Portada: ocupa sola la primera pantalla, con la franja de hoy al pie ---------- */}
      <div className="portada-escena">
        <div className="portada-vidrio">
          <section className="contenedor portada" aria-labelledby="titulo-portada">
            <div className="portada-texto">
              <h1 id="titulo-portada" className="titulo-portada entra" style={{ '--i': 0 } as CSSProperties}>
                Clínica veterinaria en <span className="resaltado">Goya</span>
              </h1>
              <p className="portada-bajada entra" style={{ '--i': 1 } as CSSProperties}>
                Cuidamos a tu mascota como parte de tu familia.
              </p>
              <div className="portada-acciones entra" style={{ '--i': 2 } as CSSProperties}>
                <Link to="/turno" className="boton boton-grande" ref={observarBotonTurno}>
                  <CalendarCheck size={22} aria-hidden="true" />
                  Pedir turno
                </Link>
                <a href={enlaceTelefono(clinica.telefono)} className="boton boton-grande boton-contorno">
                  <Phone size={22} aria-hidden="true" />
                  Llamar
                </a>
              </div>
              <ul className="portada-ventajas entra" style={{ '--i': 3 } as CSSProperties}>
                <li>
                  <Check size={18} aria-hidden="true" /> Turnos online
                </li>
                <li>
                  <Check size={18} aria-hidden="true" /> Aviso de vacunas por WhatsApp
                </li>
                <li>
                  <Check size={18} aria-hidden="true" /> Atendemos urgencias
                </li>
              </ul>
            </div>

            {/* Collage de adorno: el siamés saluda desde el arco amarillo (la patita se sale por arriba),
                el dálmata se asoma desde atrás en el arco azul y un aviso de ejemplo muestra cómo llega el recordatorio.
                Es solo decoración: los lectores de pantalla lo saltean. */}
            <div className="portada-collage" aria-hidden="true">
              <div className="arco arco-azul entra" style={{ '--i': 2 } as CSSProperties}>
                <img src="/fotos/dalmata-espia.webp" alt="" />
              </div>
              <div className="arco arco-amarillo entra" style={{ '--i': 1 } as CSSProperties}>
                <img src="/fotos/siames-saluda.webp" alt="" />
              </div>
              <div className="aviso-ejemplo entra" style={{ '--i': 4 } as CSSProperties}>
                <span className="aviso-ejemplo-icono">
                  <MessageCircle size={20} />
                </span>
                <div>
                  <p className="aviso-ejemplo-de">
                    Clínica VetYa <span>ahora</span>
                  </p>
                  <p>Hola Juan: mañana le toca la vacuna anual a Firulais.</p>
                </div>
              </div>
              <div className="chip-ejemplo entra" style={{ '--i': 5 } as CSSProperties}>
                <Check size={18} /> Turno confirmado
              </div>
            </div>
          </section>
        </div>

        {/* Franja: horario de hoy y dirección */}
        <FranjaHoy horarios={clinica.horarios} direccion={clinica.direccion} />
      </div>

      {/* ---------- Servicios: la lista a la izquierda y la foto del que está marcado a la derecha ---------- */}
      <section id="servicios" className="bloque bloque-blanco" aria-labelledby="titulo-servicios">
        <div className="contenedor servicios-grilla">
          <div>
            <h2 id="titulo-servicios">Qué atendemos en la clínica</h2>
            <p className="bloque-bajada">Elegí un servicio para pedir turno o ver cómo se coordina.</p>
            <ul className="filas-servicio">
              {filas.map((c) => (
                <li
                  key={c.clave}
                  className={c.clave === activo ? 'fila-servicio activa' : 'fila-servicio'}
                  onMouseEnter={() => setServicioActivo(c.clave)}
                  onFocus={() => setServicioActivo(c.clave)}
                  onClick={() => setServicioActivo(c.clave)}
                >
                  <span className="fila-icono">{c.icono}</span>
                  <div className="fila-texto">
                    <h3>{c.nombre}</h3>
                    <p>
                      {c.lista.map((s) => (s.nombre === c.nombre ? (s.descripcion ?? s.nombre) : s.nombre)).join(' · ')}
                    </p>
                  </div>
                  <Link to={c.enlace} className="fila-enlace" aria-label={`${c.nombre}: ${c.accion.toLowerCase()}`}>
                    {c.accion} <ArrowRight size={18} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
            <p className="servicios-productos">
              <ShoppingBag size={22} aria-hidden="true" />
              También tenemos alimentos, medicamentos y accesorios. Consultanos en la clínica.
            </p>
          </div>
          <div className="servicios-foto">
            {filas.map((c) => (
              <img key={c.clave} src={c.foto} alt={c.textoFoto} hidden={c.clave !== activo} />
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Cómo sacar turno ---------- */}
      <section id="como-sacar-turno" className="bloque" aria-labelledby="titulo-pasos">
        <div className="contenedor">
          <div className="bloque-cabeza">
            <h2 id="titulo-pasos">Sacá turno en 3 pasos</h2>
            <p className="bloque-bajada">Desde el celular o la compu, a cualquier hora.</p>
          </div>
          <ol className="pasos">
            {PASOS.map((p, i) => (
              <li key={p.titulo} className="paso">
                <div className="paso-foto">
                  <img src={p.foto} alt="" loading="lazy" width={800} height={640} />
                </div>
                <span className="paso-numero" aria-hidden="true">
                  {i + 1}
                </span>
                <h3>{p.titulo}</h3>
                <p>{p.texto}</p>
              </li>
            ))}
          </ol>
          <p className="pasos-alternativa">
            ¿Preferís no crear una cuenta?{' '}
            <a href={enlaceWhatsapp(clinica.whatsapp, MENSAJE_TURNO)} target="_blank" rel="noreferrer">
              Pedí el turno por WhatsApp
            </a>{' '}
            y lo carga la clínica.
          </p>
        </div>
      </section>

      {/* ---------- Vacunas: lo que más pidió la clínica en la entrevista ---------- */}
      <section id="vacunas" className="bloque bloque-azul" aria-labelledby="titulo-vacunas">
        <div className="contenedor vacunas-grilla">
          <div>
            <h2 id="titulo-vacunas">Te avisamos cuándo le toca la vacuna</h2>
            <p className="palabras-encienden">
              {palabras.map((p, i) => (
                <span key={i} style={{ '--avance': i / palabras.length } as CSSProperties}>
                  {p}{' '}
                </span>
              ))}
            </p>
            <Link to="/registro" className="boton boton-grande boton-claro">
              Crear mi cuenta
            </Link>
          </div>
          <div className="vacunas-foto">
            <img src="/fotos/gatito-vacuna.webp" alt="Un gatito atigrado parado" loading="lazy" />
          </div>
        </div>
      </section>

      {/* ---------- Equipo y opiniones ---------- */}
      <section id="equipo" className="bloque bloque-blanco" aria-labelledby="titulo-equipo">
        <div className="contenedor">
          <div className="equipo-grilla">
            <div className="equipo-texto">
              <h2 id="titulo-equipo">Veterinarios de Goya que atienden con tiempo, cariño y sin vueltas</h2>
              <p className="bloque-bajada">Nos capacitamos en forma permanente para cuidar mejor a tu mascota.</p>
            </div>
            {equipo.length > 0 && (
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
                      className="boton boton-contorno miembro-whatsapp"
                      aria-label={`Escribirle a ${m.nombre} ${m.apellido} por WhatsApp (se abre en otra pestaña)`}
                    >
                      <MessageCircle size={20} aria-hidden="true" />
                      Escribir por WhatsApp
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {opiniones.length > 0 && (
            <div className="opiniones">
              <h3 className="opiniones-titulo">Lo que dicen las familias</h3>
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
            </div>
          )}
        </div>
      </section>

      {/* ---------- Preguntas: las respuestas abiertas, sin tener que tocar nada ---------- */}
      {preguntas.length > 0 && (
        <section id="preguntas" className="bloque" aria-labelledby="titulo-preguntas">
          <div className="contenedor preguntas-grilla">
            <div className="preguntas-cabeza">
              <h2 id="titulo-preguntas">Preguntas frecuentes</h2>
              <p className="bloque-bajada">¿No está tu pregunta? Escribinos. Te responde una persona de la clínica.</p>
              <a
                href={enlaceWhatsapp(clinica.whatsapp, 'Hola, tengo una consulta sobre mi mascota.')}
                target="_blank"
                rel="noreferrer"
                className="boton boton-grande boton-whatsapp"
              >
                <MessageCircle size={22} aria-hidden="true" />
                Escribir por WhatsApp
              </a>
            </div>
            <div className="preguntas-lista">
              {preguntas.map((p) => (
                <div key={p.id} className="pregunta">
                  <h3>{p.pregunta}</h3>
                  <p>{p.respuesta}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------- Dónde estamos: los datos al lado del mapa ---------- */}
      <section id="contacto" className="bloque bloque-blanco" aria-labelledby="titulo-contacto">
        <div className="contenedor contacto">
          <div className="contacto-datos">
            <h2 id="titulo-contacto">Dónde estamos</h2>
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
              <Link to="/turno" className="boton boton-grande" ref={observarBotonTurno}>
                <CalendarCheck size={22} aria-hidden="true" />
                Pedir turno
              </Link>
              <a href={enlaceTelefono(clinica.telefono)} className="boton boton-grande boton-contorno">
                <Phone size={22} aria-hidden="true" />
                Llamar
              </a>
              <a href={mapaGoogle} target="_blank" rel="noreferrer" className="boton boton-grande boton-contorno">
                <MapPin size={22} aria-hidden="true" />
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

      {/* ---------- Barra fija en el celular: llamar o escribir, siempre a un toque ---------- */}
      <nav className="barra-contacto" aria-label="Contactar a la clínica">
        <a href={enlaceTelefono(clinica.telefono)} className="boton">
          <Phone size={20} aria-hidden="true" />
          Llamar
        </a>
        <a
          href={enlaceWhatsapp(clinica.whatsapp, MENSAJE_TURNO)}
          target="_blank"
          rel="noreferrer"
          className="boton boton-whatsapp"
        >
          <MessageCircle size={20} aria-hidden="true" />
          WhatsApp
        </a>
      </nav>
    </main>
  )
}

// Franja azul al pie de la portada: lo que más se pregunta (si hoy está abierto y dónde queda), de un vistazo.
function FranjaHoy({ horarios, direccion }: { horarios: HorarioAtencion[]; direccion: string }) {
  const [dia] = useState(diaSemanaHoy)
  const horas = horarioDelDia(horarios, dia)
  return (
    <div className="franja-hoy">
      <p className="contenedor franja-hoy-datos">
        <span>
          <Clock size={22} aria-hidden="true" />
          {horas ? (
            <span>
              Hoy atendemos: <strong>{horas}</strong>
            </span>
          ) : (
            <strong>Hoy la clínica está cerrada</strong>
          )}
        </span>
        <span>
          <MapPin size={22} aria-hidden="true" />
          <span>
            Estamos en <strong>{direccion}</strong>
          </span>
        </span>
      </p>
    </div>
  )
}
