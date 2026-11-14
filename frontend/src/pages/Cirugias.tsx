import { CalendarCheck, Download, Phone, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '../lib/api'
import { enlaceWhatsapp, esLimpiezaDental, useSitio } from '../lib/sitio'
import type { Cirugia } from '../types'

const PASOS = [
  ['Llamanos', 'Nos contás qué necesita tu mascota y acordamos el día.'],
  ['Preparala', 'Seguí las recomendaciones. Podés descargarlas para tenerlas a mano.'],
  ['Te lo recordamos', 'El día anterior te llega un WhatsApp con lo más importante.'],
]

const TEXTOS = {
  cirugia: {
    titulo: 'Cirugías',
    intro: 'Las coordinamos con vos, para que tu mascota llegue bien preparada y sepas cómo cuidarla después.',
  },
  limpieza: {
    titulo: 'Limpieza dental',
    intro: 'Se hace con anestesia. Por eso la coordinamos con vos, para que tu mascota llegue bien preparada.',
  },
}

// Cirugías y limpieza dental no se reservan solas: la página explica cómo coordinarlas y cómo preparar a la mascota.
export function Cirugias({ tipo }: { tipo: keyof typeof TEXTOS }) {
  const { datos: sitio } = useSitio()
  const [cirugias, setCirugias] = useState<Cirugia[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
    apiGet<Cirugia[]>('/publico/cirugias').then(setCirugias).catch(() => setError(true))
  }, [])

  if (error) {
    return (
      <main className="contenedor seccion">
        <p className="mensaje-error">No pudimos cargar esta página. Probá recargarla.</p>
      </main>
    )
  }
  if (!cirugias) return <p className="cargando">Cargando…</p>

  const lista = cirugias.filter((c) => esLimpiezaDental(c) === (tipo === 'limpieza'))
  // En la página de limpieza, el título ya dice de qué servicio se trata.
  const mostrarNombre = tipo === 'cirugia' || lista.length > 1

  return (
    <main className="fondo-huellas">
      <section className="contenedor seccion">
        <h1>{TEXTOS[tipo].titulo}</h1>
        <p className="ayuda-grande">{TEXTOS[tipo].intro}</p>

        <ol className="cirugia-pasos">
          {PASOS.map(([titulo, texto], i) => (
            <li key={titulo}>
              <span className="paso-numero">{i + 1}</span>
              <div>
                <strong>{titulo}</strong>
                <p>{texto}</p>
              </div>
            </li>
          ))}
        </ol>

        {lista.length === 0 && <p className="vacio">Por ahora no ofrecemos este servicio.</p>}

        {lista.map((c) => (
          <article key={c.id} className="tarjeta cirugia">
            {mostrarNombre && <h2>{c.nombre}</h2>}
            {c.descripcion && <p>{c.descripcion}</p>}

            <div className="cirugia-botones">
              {c.reservableOnline ? (
                <Link to="/turno?categoria=CIRUGIA" className="boton boton-grande">
                  <CalendarCheck size={22} aria-hidden="true" /> Pedir turno
                </Link>
              ) : (
                // Se coordinan hablando: llamar es la acción principal.
                sitio && (
                  <a href={`tel:+${sitio.clinica.whatsapp}`} className="boton boton-grande">
                    <Phone size={22} aria-hidden="true" /> Llamar al {sitio.clinica.telefono}
                  </a>
                )
              )}
              <a href={`/api/publico/cirugias/${c.id}/recomendaciones.pdf`} download className="boton boton-grande boton-contorno">
                <Download size={22} aria-hidden="true" /> Descargar recomendaciones
              </a>
            </div>

            {!c.reservableOnline && sitio && (
              <p className="ayuda cirugia-alternativa">
                ¿No podés llamar ahora?{' '}
                <a
                  href={enlaceWhatsapp(sitio.clinica.whatsapp, `Hola, quiero coordinar este servicio para mi mascota: ${c.nombre}. ¿Me pueden llamar?`)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Escribinos por WhatsApp y te llamamos
                </a>
              </p>
            )}

            <div className="cirugia-columnas">
              <section>
                <h3>Antes de la {c.queEs}</h3>
                <ul>
                  {c.antes.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </section>
              <section>
                <h3>Al volver a casa</h3>
                <ul>
                  {c.despues.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </section>
            </div>

            <section className="cirugia-aviso">
              <h3>
                <TriangleAlert size={20} aria-hidden="true" /> Avisanos enseguida si…
              </h3>
              <ul>
                {c.avisar.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </section>
          </article>
        ))}
      </section>
    </main>
  )
}
