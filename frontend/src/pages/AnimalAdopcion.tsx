import { ArrowLeft, Check, CircleCheck, HeartHandshake, MessageCircle, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  COMPORTAMIENTOS,
  EDADES,
  EDADES_DETALLE,
  enGenero,
  fotoPrincipal,
  SALUD,
  TAMANOS,
  VIVIENDAS,
} from '../lib/adopcion'
import { apiGet, apiPost } from '../lib/api'
import { enlaceWhatsapp, useSitio } from '../lib/sitio'
import type { AnimalAdopcion as Animal, Vivienda } from '../types'

const COMPROMISO = [
  'Castrarlo si todavía no lo está',
  'Mantener sus vacunas al día',
  'No tenerlo atado ni encerrado todo el día',
  'Si no puedo cuidarlo, avisar a quien me lo dio: nunca abandonarlo',
]

export function AnimalAdopcion() {
  const { id } = useParams()
  const [animal, setAnimal] = useState<Animal | null>(null)
  const [error, setError] = useState(false)
  const [fotoActual, setFotoActual] = useState(0)

  useEffect(() => {
    apiGet<Animal>(`/publico/adopciones/${id}`)
      .then(setAnimal)
      .catch(() => setError(true))
  }, [id])

  if (error) {
    return (
      <main className="contenedor seccion">
        <p className="mensaje-error">No encontramos a este animal. Puede que ya haya sido adoptado.</p>
        <p>
          <Link to="/adopcion">Ver los animales en adopción</Link>
        </p>
      </main>
    )
  }
  if (!animal) return <p className="cargando">Cargando…</p>

  const fotos = animal.fotos.length > 0 ? animal.fotos.map((f) => f.url) : [fotoPrincipal(animal)]
  const comportamientos = COMPORTAMIENTOS.filter((c) => animal[c.campo])

  return (
    <main className="fondo-huellas">
      <div className="contenedor ficha">
        <Link to="/adopcion" className="volver">
          <ArrowLeft size={20} aria-hidden="true" /> Volver a todos
        </Link>

        <div className="ficha-grilla">
          <div className="ficha-fotos">
            <img src={fotos[fotoActual]} alt={`Foto de ${animal.nombre}`} className="ficha-foto-grande" />
            {fotos.length > 1 && (
              <div className="ficha-miniaturas">
                {fotos.map((url, i) => (
                  <button
                    key={url}
                    type="button"
                    className={i === fotoActual ? 'activa' : ''}
                    onClick={() => setFotoActual(i)}
                    aria-label={`Ver foto ${i + 1}`}
                  >
                    <img src={url} alt="" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="ficha-datos">
            <h1>{animal.nombre}</h1>
            <p className="sello-gratis">
              <HeartHandshake size={20} aria-hidden="true" /> Adopción gratuita
            </p>
            {animal.estado === 'RESERVADO' && (
              <p className="aviso-reservado">
                Ya hay una familia interesada. Igual podés anotarte por si no se concreta.
              </p>
            )}

            <dl className="ficha-tabla">
              <div>
                <dt>Especie</dt>
                <dd>{animal.especie === 'GATO' ? 'Gato' : 'Perro'}</dd>
              </div>
              <div>
                <dt>Sexo</dt>
                <dd>{animal.sexo === 'HEMBRA' ? 'Hembra' : 'Macho'}</dd>
              </div>
              <div>
                <dt>Edad</dt>
                <dd>
                  {enGenero(EDADES[animal.edad], animal)} ({EDADES_DETALLE[animal.edad].toLowerCase()})
                </dd>
              </div>
              <div>
                <dt>Tamaño</dt>
                <dd>{enGenero(TAMANOS[animal.tamano], animal)}</dd>
              </div>
              <div>
                <dt>Color</dt>
                <dd>{animal.color}</dd>
              </div>
            </dl>

            {animal.historia && <p className="ficha-historia">{animal.historia}</p>}

            {comportamientos.length > 0 && (
              <>
                <h2>Así es {animal.nombre}</h2>
                <ul className="lista-tildes">
                  {comportamientos.map((c) => (
                    <li key={c.campo}>
                      <Check size={20} aria-hidden="true" /> {enGenero(c.texto, animal)}
                    </li>
                  ))}
                </ul>
              </>
            )}

            <h2>Salud</h2>
            <ul className="lista-tildes">
              {SALUD.map((s) => (
                <li key={s.campo} className={animal[s.campo] ? '' : 'pendiente'}>
                  {animal[s.campo] ? <Check size={20} aria-hidden="true" /> : <X size={20} aria-hidden="true" />}
                  {animal[s.campo] ? enGenero(s.texto, animal) : `${s.texto}: todavía no`}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <FormularioConocer animal={animal} />
      </div>
    </main>
  )
}

// Formulario corto a propósito: nombre, teléfono, dos preguntas de un toque y el compromiso.
// La charla de verdad la hace la clínica por teléfono o en persona.
function FormularioConocer({ animal }: { animal: Animal }) {
  const { datos: sitio } = useSitio()
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [vivienda, setVivienda] = useState<Vivienda | null>(null)
  const [otrosAnimales, setOtrosAnimales] = useState<boolean | null>(null)
  const [acepta, setAcepta] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!vivienda) return setError('Contanos dónde vivís')
    if (otrosAnimales === null) return setError('Contanos si tenés otros animales')
    setError(null)
    setEnviando(true)
    try {
      await apiPost(`/publico/adopciones/${animal.id}/solicitudes`, {
        nombre,
        telefono,
        vivienda,
        otrosAnimales,
        aceptaCompromiso: acepta,
      })
      setEnviado(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar. Probá de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  if (enviado) {
    return (
      <section className="conocer conocer-listo" aria-live="polite">
        <CircleCheck size={48} aria-hidden="true" />
        <h2>¡Listo, {nombre.split(' ')[0]}!</h2>
        <p>
          Recibimos tu pedido para conocer a {animal.nombre}. Le pasamos tus datos a quien lo cuida y te van a llamar al{' '}
          {telefono} para coordinar una visita.
        </p>
        {sitio && (
          <a
            href={enlaceWhatsapp(
              sitio.clinica.whatsapp,
              `Hola, soy ${nombre}. Envié un pedido para conocer a ${animal.nombre}, en adopción.`,
            )}
            target="_blank"
            rel="noreferrer"
            className="boton boton-grande boton-whatsapp"
          >
            <MessageCircle size={22} aria-hidden="true" />
            Avisar también por WhatsApp
          </a>
        )}
      </section>
    )
  }

  return (
    <section className="conocer" aria-labelledby="titulo-conocer">
      <h2 id="titulo-conocer">Quiero conocer a {animal.nombre}</h2>
      <p className="ayuda-grande">Dejanos tus datos: se los pasamos a quien lo cuida para que te llame y coordinen una visita.</p>

      <form className="formulario" onSubmit={enviar}>
        <div className="fila-campos">
          <label className="campo">
            Tu nombre
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} required autoComplete="name" />
          </label>
          <label className="campo">
            Tu teléfono
            <input
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              required
              placeholder="3777 123456"
              autoComplete="tel"
            />
          </label>
        </div>

        <fieldset className="grupo-filtro">
          <legend>¿Dónde vivís?</legend>
          <div className="chips">
            {(Object.entries(VIVIENDAS) as [Vivienda, string][]).map(([v, texto]) => (
              <button
                key={v}
                type="button"
                className={`chip chip-grande${vivienda === v ? ' chip-activo' : ''}`}
                aria-pressed={vivienda === v}
                onClick={() => setVivienda(v)}
              >
                {texto}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="grupo-filtro">
          <legend>¿Tenés otros animales?</legend>
          <div className="chips">
            {[
              [true, 'Sí'],
              [false, 'No'],
            ].map(([v, texto]) => (
              <button
                key={String(v)}
                type="button"
                className={`chip chip-grande${otrosAnimales === v ? ' chip-activo' : ''}`}
                aria-pressed={otrosAnimales === v}
                onClick={() => setOtrosAnimales(v as boolean)}
              >
                {texto as string}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="compromiso">
          <p>
            <strong>Me comprometo a:</strong>
          </p>
          <ul>
            {COMPROMISO.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <label className="casilla">
            <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} required />
            Acepto el compromiso de adopción responsable
          </label>
        </div>

        {error && (
          <p className="mensaje-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="boton boton-grande" disabled={enviando}>
          {enviando ? 'Enviando…' : `Quiero conocer a ${animal.nombre}`}
        </button>
      </form>
    </section>
  )
}
