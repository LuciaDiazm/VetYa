import { Cat, Dog, PawPrint, Plus, Search, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Cargando } from '../../components/Cargando'
import { Paginacion } from '../../components/Paginacion'
import { apiGet } from '../../lib/api'
import { formatearTelefono } from '../../lib/mascotas'
import type { Cliente, EspecieMascota } from '../../types'

export function IconoEspecie({ especie, size = 18 }: { especie: EspecieMascota; size?: number }) {
  if (especie === 'PERRO') return <Dog size={size} aria-hidden="true" />
  if (especie === 'GATO') return <Cat size={size} aria-hidden="true" />
  return <PawPrint size={size} aria-hidden="true" />
}

interface PaginaClientes {
  clientes: Cliente[]
  total: number
  pagina: number
  porPagina: number
}

// Buscador de clientes: por nombre, apellido, DNI, teléfono o nombre de la mascota.
// Los resultados vienen de a 10 por página desde el servidor.
export function Clientes() {
  const [parametros, setParametros] = useSearchParams()
  const [texto, setTexto] = useState(parametros.get('q') ?? '')
  // Lo que se buscó y la página quedan en la dirección: se puede volver atrás o recargar igual.
  const q = parametros.get('q') ?? ''
  const pagina = Math.max(1, Number(parametros.get('pagina')) || 1)
  const clave = `${q}|${pagina}`
  const [resultado, setResultado] = useState<(PaginaClientes & { clave: string }) | null>(null)
  const [error, setError] = useState(false)

  // Mientras se escribe, espera un momento para no consultar en cada tecla. Una búsqueda nueva vuelve a la página 1.
  useEffect(() => {
    if (texto.trim() === q) return
    const espera = window.setTimeout(() => {
      setParametros(texto.trim() ? { q: texto.trim() } : {}, { replace: true })
    }, 300)
    return () => window.clearTimeout(espera)
  }, [texto, q, setParametros])

  // La consulta al servidor: cada vez que cambia lo buscado o la página.
  useEffect(() => {
    let vigente = true
    apiGet<PaginaClientes>(`/clientes?q=${encodeURIComponent(q)}&pagina=${pagina}`)
      .then((r) => {
        if (!vigente) return
        setResultado({ ...r, clave })
        setError(false)
      })
      .catch(() => vigente && setError(true))
    return () => {
      vigente = false
    }
  }, [q, pagina, clave])

  const buscando = !error && (resultado?.clave !== clave || texto.trim() !== q)
  const clientes = resultado?.clientes ?? []

  function irAPagina(nueva: number) {
    setParametros(q ? { q, pagina: String(nueva) } : { pagina: String(nueva) })
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  return (
    <>
      <div className="panel-encabezado panel-encabezado-acciones">
        <div>
          <h1>Clientes y mascotas</h1>
          <p>Buscá por nombre, teléfono, DNI o nombre de la mascota.</p>
        </div>
        <Link to="/panel/clientes/nuevo" className="boton boton-grande boton-secundario">
          <Plus size={22} aria-hidden="true" /> Nuevo cliente
        </Link>
      </div>

      <label className="buscador">
        <Search size={22} aria-hidden="true" />
        <span className="solo-lectores">Buscar cliente</span>
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ej.: Pérez, Firulais o 3777 123456"
          autoFocus
        />
      </label>

      {error && <p className="mensaje-error">No se pudo buscar. Revisá la conexión y probá de nuevo.</p>}

      {resultado === null ? (
        !error && <Cargando texto="Buscando…" />
      ) : clientes.length === 0 && !buscando ? (
        <div className="tarjeta vacio-con-accion">
          <p className="vacio">
            {texto.trim() ? `No encontramos a nadie con “${texto.trim()}”.` : 'Todavía no hay clientes cargados.'}
          </p>
          <Link to="/panel/clientes/nuevo" className="boton">
            <Plus size={20} aria-hidden="true" /> Cargar cliente nuevo
          </Link>
        </div>
      ) : (
        <>
          {/* Mientras llega la búsqueda nueva, el anillo flota sobre la lista anterior, más tenue */}
          {buscando && (
            <div className="cargando-flotante">
              <Cargando texto="Buscando…" />
            </div>
          )}
          {!q && <p className="subtitulo-lista">Últimos clientes cargados</p>}
          <ul className={`lista-clientes${buscando ? ' recargando' : ''}`} aria-busy={buscando}>
            {clientes.map((c) => (
              <li key={c.id}>
                <Link to={`/panel/clientes/${c.id}`} className="cliente-fila">
                  <span className="icono-circulo">
                    <UserRound size={22} aria-hidden="true" />
                  </span>
                  <span className="cliente-fila-datos">
                    <strong>
                      {c.apellido}, {c.nombre}
                    </strong>
                    <span>{formatearTelefono(c.telefono)}</span>
                  </span>
                  <span className="cliente-fila-mascotas">
                    {c.mascotas.length === 0 ? (
                      <span className="chip-dato">Sin mascotas</span>
                    ) : (
                      c.mascotas.map((m) => (
                        <span key={m.id} className="chip-dato chip-mascota">
                          <IconoEspecie especie={m.especie} size={16} /> {m.nombre}
                        </span>
                      ))
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Paginacion
            pagina={resultado.pagina}
            total={resultado.total}
            porPagina={resultado.porPagina}
            queSeCuenta="clientes"
            alCambiar={irAPagina}
          />
        </>
      )}
    </>
  )
}
