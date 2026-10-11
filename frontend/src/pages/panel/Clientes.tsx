import { Cat, Dog, PawPrint, Plus, Search, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiGet } from '../../lib/api'
import { formatearTelefono } from '../../lib/mascotas'
import type { Cliente, EspecieMascota } from '../../types'

export function IconoEspecie({ especie, size = 18 }: { especie: EspecieMascota; size?: number }) {
  if (especie === 'PERRO') return <Dog size={size} aria-hidden="true" />
  if (especie === 'GATO') return <Cat size={size} aria-hidden="true" />
  return <PawPrint size={size} aria-hidden="true" />
}

// Buscador de clientes: por nombre, apellido, DNI, teléfono o nombre de la mascota.
export function Clientes() {
  const [parametros, setParametros] = useSearchParams()
  const [texto, setTexto] = useState(parametros.get('q') ?? '')
  const [clientes, setClientes] = useState<Cliente[] | null>(null)
  const [error, setError] = useState(false)

  // Busca mientras se escribe, esperando un momento para no consultar en cada tecla.
  useEffect(() => {
    const espera = window.setTimeout(() => {
      apiGet<Cliente[]>(`/clientes?q=${encodeURIComponent(texto.trim())}`)
        .then((r) => {
          setClientes(r)
          setError(false)
        })
        .catch(() => setError(true))
      setParametros(texto.trim() ? { q: texto.trim() } : {}, { replace: true })
    }, 300)
    return () => window.clearTimeout(espera)
  }, [texto, setParametros])

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

      {clientes === null ? (
        <p className="cargando">Buscando…</p>
      ) : clientes.length === 0 ? (
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
          {!texto.trim() && <p className="subtitulo-lista">Últimos clientes cargados</p>}
          <ul className="lista-clientes">
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
        </>
      )}
    </>
  )
}
