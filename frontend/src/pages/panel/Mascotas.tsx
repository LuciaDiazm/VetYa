import { ChevronRight, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Cargando } from '../../components/Cargando'
import { Paginacion } from '../../components/Paginacion'
import { apiGet } from '../../lib/api'
import { edadTexto, nombreEspecie } from '../../lib/mascotas'
import type { EspecieMascota } from '../../types'
import { IconoEspecie } from './Clientes'

interface MascotaDeLista {
  id: number
  nombre: string
  especie: EspecieMascota
  otraEspecie: string | null
  raza: string | null
  sexo: 'MACHO' | 'HEMBRA'
  fechaNacimiento: string | null
  cliente: { id: number; nombre: string; apellido: string; telefono: string }
  ultimaConsulta: string | null
}

interface PaginaMascotas {
  mascotas: MascotaDeLista[]
  total: number
  pagina: number
  porPagina: number
}

const FILTROS: { valor: '' | EspecieMascota; texto: string }[] = [
  { valor: '', texto: 'Todas' },
  { valor: 'PERRO', texto: 'Perros' },
  { valor: 'GATO', texto: 'Gatos' },
  { valor: 'OTRO', texto: 'Otras' },
]

const FECHA_VISITA = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'America/Argentina/Buenos_Aires',
})

// Todos los pacientes de la clínica: se busca por nombre, raza o dueño y se filtra por especie.
// Cada fila abre la ficha de la mascota.
export function Mascotas() {
  const [parametros, setParametros] = useSearchParams()
  const [texto, setTexto] = useState(parametros.get('q') ?? '')
  const q = parametros.get('q') ?? ''
  const especie = (parametros.get('especie') ?? '') as '' | EspecieMascota
  const pagina = Math.max(1, Number(parametros.get('pagina')) || 1)
  const clave = `${q}|${especie}|${pagina}`
  const [resultado, setResultado] = useState<(PaginaMascotas & { clave: string }) | null>(null)
  const [error, setError] = useState(false)

  function cambiar(nuevos: { q?: string; especie?: string; pagina?: number }) {
    const datos = { q, especie, pagina: 1, ...nuevos }
    const salida: Record<string, string> = {}
    if (datos.q) salida.q = datos.q
    if (datos.especie) salida.especie = datos.especie
    if (datos.pagina > 1) salida.pagina = String(datos.pagina)
    setParametros(salida, { replace: nuevos.pagina === undefined })
  }

  // Espera un momento mientras se escribe, para no consultar en cada tecla.
  useEffect(() => {
    if (texto.trim() === q) return
    const espera = window.setTimeout(() => {
      const salida: Record<string, string> = {}
      if (texto.trim()) salida.q = texto.trim()
      if (especie) salida.especie = especie
      setParametros(salida, { replace: true })
    }, 300)
    return () => window.clearTimeout(espera)
  }, [texto, q, especie, setParametros])

  useEffect(() => {
    let vigente = true
    const filtro = especie ? `&especie=${especie}` : ''
    apiGet<PaginaMascotas>(`/mascotas?q=${encodeURIComponent(q)}${filtro}&pagina=${pagina}`)
      .then((r) => {
        if (!vigente) return
        setResultado({ ...r, clave })
        setError(false)
      })
      .catch(() => vigente && setError(true))
    return () => {
      vigente = false
    }
  }, [q, especie, pagina, clave])

  const buscando = !error && (resultado?.clave !== clave || texto.trim() !== q)
  const mascotas = resultado?.mascotas ?? []

  return (
    <>
      <div className="panel-encabezado">
        <h1>Mascotas</h1>
        <p>Todos los pacientes. Buscá por nombre, raza o dueño.</p>
      </div>

      <label className="buscador">
        <Search size={22} aria-hidden="true" />
        <span className="solo-lectores">Buscar mascota</span>
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ej.: Firulais, caniche o Pérez"
        />
      </label>

      <div className="mascotas-filtros" role="group" aria-label="Especie">
        {FILTROS.map((f) => (
          <button
            key={f.texto}
            type="button"
            className={`chip${especie === f.valor ? ' chip-activo' : ''}`}
            aria-pressed={especie === f.valor}
            onClick={() => cambiar({ especie: f.valor })}
          >
            {f.valor && <IconoEspecie especie={f.valor} size={16} />} {f.texto}
          </button>
        ))}
      </div>

      {error && <p className="mensaje-error">No se pudo buscar. Revisá la conexión y probá de nuevo.</p>}

      {resultado === null ? (
        !error && <Cargando texto="Buscando…" />
      ) : mascotas.length === 0 && !buscando ? (
        <div className="tarjeta vacio-con-accion">
          <p className="vacio">
            {q ? `No encontramos mascotas con “${q}”.` : 'No hay mascotas de esta especie.'}
          </p>
        </div>
      ) : (
        <>
          {buscando && (
            <div className="cargando-flotante">
              <Cargando texto="Buscando…" />
            </div>
          )}
          <div className={`tarjeta tabla-mascotas${buscando ? ' recargando' : ''}`}>
            <div className="tabla-mascotas-encabezado" aria-hidden="true">
              <span>Mascota</span>
              <span>Dueño</span>
              <span>Edad</span>
              <span>Última consulta</span>
            </div>
            <ul className="lista-clientes" aria-busy={buscando}>
              {mascotas.map((m) => (
                <li key={m.id}>
                  <Link to={`/panel/mascotas/${m.id}`} className="paciente-fila">
                    <span className="paciente-fila-nombre">
                      <span className="paciente-fila-icono">
                        <IconoEspecie especie={m.especie} size={20} />
                      </span>
                      <span>
                        <strong>{m.nombre}</strong>
                        <small>
                          {nombreEspecie(m)}
                          {m.raza ? ` · ${m.raza}` : ''} · {m.sexo === 'MACHO' ? 'Macho' : 'Hembra'}
                        </small>
                      </span>
                    </span>
                    <span className="paciente-fila-dato">
                      <span className="paciente-fila-etiqueta">Dueño: </span>
                      {m.cliente.apellido}, {m.cliente.nombre}
                    </span>
                    <span className="paciente-fila-dato">
                      <span className="paciente-fila-etiqueta">Edad: </span>
                      {m.fechaNacimiento ? edadTexto(m.fechaNacimiento) : 'Sin dato'}
                    </span>
                    <span className="paciente-fila-dato">
                      <span className="paciente-fila-etiqueta">Última consulta: </span>
                      {m.ultimaConsulta ? FECHA_VISITA.format(new Date(m.ultimaConsulta)) : 'Todavía ninguna'}
                    </span>
                    <span className="cliente-fila-ver">
                      <span className="paciente-fila-ver-texto">Ver ficha</span> <ChevronRight size={18} aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <Paginacion
            pagina={resultado.pagina}
            total={resultado.total}
            porPagina={resultado.porPagina}
            queSeCuenta="mascotas"
            alCambiar={(n) => {
              cambiar({ pagina: n })
              window.scrollTo({ top: 0, behavior: 'instant' })
            }}
          />
        </>
      )}
    </>
  )
}
