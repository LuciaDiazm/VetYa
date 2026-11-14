import { HeartHandshake, PartyPopper, SlidersHorizontal } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { HuellaAdopcion } from '../components/HuellaAdopcion'
import { EDADES, enGenero, fotoPrincipal, TAMANOS } from '../lib/adopcion'
import { apiGet } from '../lib/api'
import type { AnimalAdopcion, EdadAproximada, Tamano } from '../types'

interface Filtros {
  especie: 'PERRO' | 'GATO' | null
  sexo: 'MACHO' | 'HEMBRA' | null
  tamano: Tamano | null
  edad: EdadAproximada | null
  caracter: 'tranquilo' | 'jugueton' | 'buenoConChicos' | null
  color: string | null
}

const SIN_FILTROS: Filtros = { especie: null, sexo: null, tamano: null, edad: null, caracter: null, color: null }

// Un grupo de botones grandes: tocar uno lo elige, tocarlo de nuevo lo quita.
function GrupoFiltro<T extends string>({
  titulo,
  opciones,
  valor,
  cambiar,
}: {
  titulo: string
  opciones: [T, string][]
  valor: T | null
  cambiar: (v: T | null) => void
}) {
  return (
    <fieldset className="grupo-filtro">
      <legend>{titulo}</legend>
      <div className="chips">
        {opciones.map(([v, texto]) => (
          <button
            key={v}
            type="button"
            className={`chip${valor === v ? ' chip-activo' : ''}`}
            aria-pressed={valor === v}
            onClick={() => cambiar(valor === v ? null : v)}
          >
            {texto}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export function Adopcion() {
  const [datos, setDatos] = useState<{ enAdopcion: AnimalAdopcion[]; adoptados: AnimalAdopcion[] } | null>(null)
  const [error, setError] = useState(false)
  const [filtros, setFiltros] = useState<Filtros>(SIN_FILTROS)

  useEffect(() => {
    apiGet<{ enAdopcion: AnimalAdopcion[]; adoptados: AnimalAdopcion[] }>('/publico/adopciones')
      .then(setDatos)
      .catch(() => setError(true))
  }, [])

  const coloresDisponibles = useMemo(
    () => [...new Set(datos?.enAdopcion.map((a) => a.color) ?? [])].sort(),
    [datos],
  )

  const filtrados = useMemo(
    () =>
      (datos?.enAdopcion ?? []).filter(
        (a) =>
          (!filtros.especie || a.especie === filtros.especie) &&
          (!filtros.sexo || a.sexo === filtros.sexo) &&
          (!filtros.tamano || a.tamano === filtros.tamano) &&
          (!filtros.edad || a.edad === filtros.edad) &&
          (!filtros.caracter || a[filtros.caracter]) &&
          (!filtros.color || a.color === filtros.color),
      ),
    [datos, filtros],
  )

  const cambiar = <K extends keyof Filtros>(clave: K) => (valor: Filtros[K]) =>
    setFiltros((f) => ({ ...f, [clave]: valor }))
  const hayFiltros = Object.values(filtros).some(Boolean)

  if (error) {
    return (
      <main className="contenedor seccion">
        <p className="mensaje-error">No pudimos cargar los animales en adopción. Probá recargar la página.</p>
      </main>
    )
  }
  if (!datos) return <p className="cargando">Cargando…</p>

  return (
    <main className="fondo-huellas">
      <section className="contenedor adopcion-portada">
        {datos.enAdopcion.length > 0 ? (
          <HuellaAdopcion animales={datos.enAdopcion}>
            <h1>¿Buscás un amigo?</h1>
            <p>Perros y gatos de Goya que buscan familia. Nosotros ayudamos a difundirlos.</p>
            <p className="sello-gratis">
              <HeartHandshake size={20} aria-hidden="true" /> Adopción gratuita
            </p>
            <a href="#animales" className="boton boton-grande boton-secundario">
              Conocelos
            </a>
          </HuellaAdopcion>
        ) : (
          <div className="adopcion-vacia">
            <h1>Adopción</h1>
            <p>Por ahora no hay animales esperando familia. ¡Volvé pronto!</p>
          </div>
        )}
      </section>

      {datos.enAdopcion.length > 0 && (
        <section id="animales" className="contenedor seccion" aria-labelledby="titulo-animales">
          <h2 id="titulo-animales" className="titulo-centrado">
            Elegí cómo lo buscás
          </h2>

          <div className="filtros">
            <GrupoFiltro
              titulo="Perro o gato"
              opciones={[['PERRO', 'Perro'], ['GATO', 'Gato']]}
              valor={filtros.especie}
              cambiar={cambiar('especie')}
            />
            <GrupoFiltro
              titulo="Sexo"
              opciones={[['MACHO', 'Macho'], ['HEMBRA', 'Hembra']]}
              valor={filtros.sexo}
              cambiar={cambiar('sexo')}
            />
            <GrupoFiltro
              titulo="Tamaño"
              opciones={Object.entries(TAMANOS) as [Tamano, string][]}
              valor={filtros.tamano}
              cambiar={cambiar('tamano')}
            />
            <GrupoFiltro
              titulo="Edad"
              opciones={Object.entries(EDADES) as [EdadAproximada, string][]}
              valor={filtros.edad}
              cambiar={cambiar('edad')}
            />
            <GrupoFiltro
              titulo="Cómo es"
              opciones={[
                ['tranquilo', 'Tranquilo'],
                ['jugueton', 'Juguetón'],
                ['buenoConChicos', 'Bueno con chicos'],
              ]}
              valor={filtros.caracter}
              cambiar={cambiar('caracter')}
            />
            {coloresDisponibles.length > 1 && (
              <GrupoFiltro
                titulo="Color"
                opciones={coloresDisponibles.map((c) => [c, c] as [string, string])}
                valor={filtros.color}
                cambiar={cambiar('color')}
              />
            )}
          </div>

          <div className="filtros-resultado" aria-live="polite">
            <SlidersHorizontal size={18} aria-hidden="true" />
            {filtrados.length === 1 ? 'Encontramos 1 animal' : `Encontramos ${filtrados.length} animales`}
            {hayFiltros && (
              <button type="button" className="boton-texto" onClick={() => setFiltros(SIN_FILTROS)}>
                Ver todos
              </button>
            )}
          </div>

          {filtrados.length === 0 ? (
            <p className="adopcion-sin-resultados">
              Ninguno coincide con todo eso. Probá quitando algún filtro o tocá <strong>Ver todos</strong>.
            </p>
          ) : (
            <ul className="grilla-adopcion">
              {filtrados.map((a) => (
                <li key={a.id}>
                  <Link to={`/adopcion/${a.id}`} className="tarjeta-animal">
                    <span className="tarjeta-animal-foto">
                      <img src={fotoPrincipal(a)} alt="" loading="lazy" />
                      {a.estado === 'RESERVADO' && <span className="cinta-reservado">Reservado</span>}
                    </span>
                    <span className="tarjeta-animal-cuerpo">
                      <strong>{a.nombre}</strong>
                      <span className="chips chips-chicas">
                        <span className="chip-dato">{a.sexo === 'HEMBRA' ? 'Hembra' : 'Macho'}</span>
                        <span className="chip-dato">{enGenero(EDADES[a.edad], a)}</span>
                        <span className="chip-dato">{enGenero(TAMANOS[a.tamano], a)}</span>
                      </span>
                      <span className="tarjeta-animal-ver">Conocer a {a.nombre}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {datos.adoptados.length > 0 && (
        <section className="contenedor seccion" aria-labelledby="titulo-adoptados">
          <h2 id="titulo-adoptados" className="titulo-centrado">
            <PartyPopper size={30} aria-hidden="true" /> ¡Ya tienen familia!
          </h2>
          <ul className="grilla-adoptados">
            {datos.adoptados.map((a) => (
              <li key={a.id}>
                <img src={fotoPrincipal(a)} alt="" loading="lazy" />
                <span>{a.nombre}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
