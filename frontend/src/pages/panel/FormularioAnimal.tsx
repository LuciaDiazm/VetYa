import { ArrowLeft, Camera, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { COLORES, COMPORTAMIENTOS, EDADES, EDADES_DETALLE, SALUD, TAMANOS } from '../../lib/adopcion'
import { apiDelete, apiGet, apiPost, apiPut, apiSubir } from '../../lib/api'
import type { AnimalAdopcion, EdadAproximada, Tamano } from '../../types'

const MAX_FOTOS = 4

type Datos = Omit<AnimalAdopcion, 'id' | 'estado' | 'publicadoEn' | 'adoptadoEn' | 'fotos' | '_count' | 'historia'> & {
  historia: string
}

const VACIO: Datos = {
  nombre: '',
  especie: 'PERRO',
  sexo: 'HEMBRA',
  edad: 'JOVEN',
  tamano: 'MEDIANO',
  color: '',
  historia: '',
  tranquilo: false,
  jugueton: false,
  buenoConChicos: false,
  conviveConPerros: false,
  conviveConGatos: false,
  vacunado: false,
  desparasitado: false,
  castrado: false,
}

// Botones grandes para elegir una opción, más fáciles de tocar en el celular que un desplegable.
function Opciones<T extends string>({
  titulo,
  opciones,
  valor,
  cambiar,
}: {
  titulo: string
  opciones: [T, string][]
  valor: T
  cambiar: (v: T) => void
}) {
  return (
    <fieldset className="grupo-filtro">
      <legend>{titulo}</legend>
      <div className="chips">
        {opciones.map(([v, texto]) => (
          <button
            key={v}
            type="button"
            className={`chip chip-grande${valor === v ? ' chip-activo' : ''}`}
            aria-pressed={valor === v}
            onClick={() => cambiar(v)}
          >
            {texto}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

// Una sola pantalla para publicar o editar un animal en adopción: casi todo se toca, poco se escribe.
export function FormularioAnimal() {
  const { id } = useParams()
  const esNuevo = !id
  const navegar = useNavigate()
  const [datos, setDatos] = useState<Datos>(VACIO)
  const [animal, setAnimal] = useState<AnimalAdopcion | null>(null)
  const [fotosNuevas, setFotosNuevas] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (esNuevo) return
    apiGet<AnimalAdopcion[]>('/adopciones')
      .then((lista) => {
        const encontrado = lista.find((a) => a.id === Number(id))
        if (!encontrado) return setError('No se encontró el animal.')
        setAnimal(encontrado)
        const { id: _id, estado: _e, publicadoEn: _p, adoptadoEn: _a, fotos: _f, _count, historia, ...resto } = encontrado
        setDatos({ ...resto, historia: historia ?? '' })
      })
      .catch(() => setError('No se pudo cargar el animal.'))
  }, [esNuevo, id])

  // Vistas previas de las fotos elegidas que todavía no se subieron.
  const vistasPrevias = useMemo(() => fotosNuevas.map((f) => URL.createObjectURL(f)), [fotosNuevas])
  useEffect(() => () => vistasPrevias.forEach((u) => URL.revokeObjectURL(u)), [vistasPrevias])

  const cambiar = <K extends keyof Datos>(clave: K, valor: Datos[K]) => setDatos((d) => ({ ...d, [clave]: valor }))
  const fotosActuales = animal?.fotos ?? []
  const lugaresLibres = MAX_FOTOS - fotosActuales.length - fotosNuevas.length

  function elegirFotos(archivos: FileList | null) {
    if (!archivos) return
    const elegidas = Array.from(archivos).slice(0, Math.max(lugaresLibres, 0))
    setFotosNuevas((f) => [...f, ...elegidas])
  }

  async function borrarFotoGuardada(fotoId: number) {
    if (!animal) return
    const actualizado = await apiDelete<AnimalAdopcion>(`/adopciones/${animal.id}/fotos/${fotoId}`)
    setAnimal(actualizado)
  }

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!datos.color) return setError('Elegí un color')
    setError(null)
    setGuardando(true)
    try {
      const guardado = esNuevo
        ? await apiPost<AnimalAdopcion>('/adopciones', datos)
        : await apiPut<AnimalAdopcion>(`/adopciones/${id}`, datos)
      if (fotosNuevas.length > 0) {
        const formulario = new FormData()
        fotosNuevas.forEach((f) => formulario.append('fotos', f))
        await apiSubir(`/adopciones/${guardado.id}/fotos`, formulario)
      }
      navegar('/panel/adopciones')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar() {
    if (!animal || !window.confirm(`¿Seguro que querés borrar a ${animal.nombre}? No se puede deshacer.`)) return
    await apiDelete(`/adopciones/${animal.id}`)
    navegar('/panel/adopciones')
  }

  return (
    <>
      <Link to="/panel/adopciones" className="volver">
        <ArrowLeft size={20} aria-hidden="true" /> Volver
      </Link>
      <div className="panel-encabezado">
        <h1>{esNuevo ? 'Publicar animal' : `Editar a ${animal?.nombre ?? ''}`}</h1>
        <p>Completá lo que sepas. Lo podés cambiar cuando quieras.</p>
      </div>

      <form className="formulario formulario-animal" onSubmit={guardar}>
        {/* ---------- Fotos ---------- */}
        <section className="tarjeta">
          <h2>Fotos</h2>
          <p className="ayuda">Hasta {MAX_FOTOS} fotos. La primera es la que se ve en la lista.</p>
          <div className="fotos-carga">
            {fotosActuales.map((f) => (
              <div key={f.id} className="foto-carga">
                <img src={f.url} alt="" />
                <button type="button" onClick={() => borrarFotoGuardada(f.id)} aria-label="Borrar foto">
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
            {vistasPrevias.map((url, i) => (
              <div key={url} className="foto-carga">
                <img src={url} alt="" />
                <button
                  type="button"
                  onClick={() => setFotosNuevas((f) => f.filter((_, j) => j !== i))}
                  aria-label="Quitar foto"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
            {lugaresLibres > 0 && (
              <label className="foto-agregar">
                <Camera size={30} aria-hidden="true" />
                Agregar foto
                <input type="file" accept="image/*" multiple onChange={(e) => elegirFotos(e.target.files)} />
              </label>
            )}
          </div>
        </section>

        {/* ---------- Datos ---------- */}
        <section className="tarjeta formulario">
          <h2>Datos</h2>
          <label className="campo">
            Nombre
            <input value={datos.nombre} onChange={(e) => cambiar('nombre', e.target.value)} required />
          </label>
          <Opciones
            titulo="Es un"
            opciones={[['PERRO', 'Perro'], ['GATO', 'Gato']]}
            valor={datos.especie}
            cambiar={(v) => cambiar('especie', v)}
          />
          <Opciones
            titulo="Sexo"
            opciones={[['HEMBRA', 'Hembra'], ['MACHO', 'Macho']]}
            valor={datos.sexo}
            cambiar={(v) => cambiar('sexo', v)}
          />
          <Opciones
            titulo="Edad aproximada"
            opciones={(Object.keys(EDADES) as EdadAproximada[]).map((e) => [e, `${EDADES[e]} (${EDADES_DETALLE[e].toLowerCase()})`])}
            valor={datos.edad}
            cambiar={(v) => cambiar('edad', v)}
          />
          <Opciones
            titulo="Tamaño"
            opciones={Object.entries(TAMANOS) as [Tamano, string][]}
            valor={datos.tamano}
            cambiar={(v) => cambiar('tamano', v)}
          />
          <Opciones
            titulo="Color"
            opciones={COLORES.map((c) => [c, c] as [string, string])}
            valor={datos.color}
            cambiar={(v) => cambiar('color', v)}
          />
        </section>

        {/* ---------- Comportamiento y salud ---------- */}
        <section className="tarjeta">
          <h2>Cómo es</h2>
          <p className="ayuda">Tildá todo lo que corresponda.</p>
          <div className="casillas">
            {COMPORTAMIENTOS.map((c) => (
              <label key={c.campo} className="casilla casilla-grande">
                <input type="checkbox" checked={datos[c.campo]} onChange={(e) => cambiar(c.campo, e.target.checked)} />
                {c.texto}
              </label>
            ))}
          </div>
          <h2>Salud</h2>
          <div className="casillas">
            {SALUD.map((s) => (
              <label key={s.campo} className="casilla casilla-grande">
                <input type="checkbox" checked={datos[s.campo]} onChange={(e) => cambiar(s.campo, e.target.checked)} />
                {s.texto}
              </label>
            ))}
          </div>
        </section>

        <section className="tarjeta">
          <label className="campo">
            Su historia (opcional)
            <textarea
              value={datos.historia}
              onChange={(e) => cambiar('historia', e.target.value)}
              rows={3}
              maxLength={600}
              placeholder="Ej.: La encontraron en el barrio Esquina. Es muy mimosa y le encanta pasear."
            />
          </label>
        </section>

        {error && (
          <p className="mensaje-error" role="alert">
            {error}
          </p>
        )}

        <div className="formulario-botones">
          <button type="submit" className="boton boton-grande" disabled={guardando}>
            {guardando ? 'Guardando…' : esNuevo ? 'Publicar' : 'Guardar cambios'}
          </button>
          {!esNuevo && (
            <button type="button" className="boton-texto texto-peligro" onClick={eliminar}>
              <Trash2 size={18} aria-hidden="true" /> Borrar animal
            </button>
          )}
        </div>
      </form>
    </>
  )
}
