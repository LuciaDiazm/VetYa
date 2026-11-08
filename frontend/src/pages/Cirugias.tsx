import { CalendarCheck, Download, MessageCircle, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '../lib/api'
import { enlaceWhatsapp, useSitio } from '../lib/sitio'
import type { Cirugia } from '../types'

const PASOS = [
  ['Escribinos', 'Nos contás qué necesita tu mascota y acordamos el día.'],
  ['Preparala', 'Seguí las recomendaciones. Podés descargarlas para tenerlas a mano.'],
  ['Te lo recordamos', 'El día anterior te llega un WhatsApp con lo más importante.'],
]

// Las cirugías no se reservan solas: esta página explica cómo coordinarlas y cómo preparar a la mascota.
export function Cirugias() {
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

  return (
    <main className="fondo-huellas">
      <section className="contenedor seccion">
        <h1>Cirugías</h1>
        <p className="ayuda-grande">
          Las coordinamos con vos, para que tu mascota llegue bien preparada y sepas cómo cuidarla después.
        </p>

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

        {cirugias.map((c) => (
          <article key={c.id} className="tarjeta cirugia">
            <h2>{c.nombre}</h2>
            {c.descripcion && <p>{c.descripcion}</p>}

            <div className="cirugia-botones">
              {c.reservableOnline ? (
                <Link to="/turno?categoria=CIRUGIA" className="boton boton-grande">
                  <CalendarCheck size={22} aria-hidden="true" /> Pedir turno
                </Link>
              ) : (
                sitio && (
                  <a
                    href={enlaceWhatsapp(sitio.clinica.whatsapp, `Hola, quiero coordinar este servicio para mi mascota: ${c.nombre}.`)}
                    target="_blank"
                    rel="noreferrer"
                    className="boton boton-grande boton-whatsapp"
                  >
                    <MessageCircle size={22} aria-hidden="true" /> Coordinar por WhatsApp
                  </a>
                )
              )}
              <a href={`/api/publico/cirugias/${c.id}/recomendaciones.pdf`} download className="boton boton-grande boton-contorno">
                <Download size={22} aria-hidden="true" /> Descargar recomendaciones
              </a>
            </div>

            <div className="cirugia-columnas">
              <section>
                <h3>Antes de la cirugía</h3>
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
