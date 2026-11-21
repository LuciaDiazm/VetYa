import { ChevronRight, Search, UserPlus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '../lib/api'
import { formatearTelefono } from '../lib/mascotas'
import type { Cliente } from '../types'

// Agregar una mascota desde la lista de Mascotas: primero se elige de quién es.
// Si el dueño ya está, se abre su ficha con el formulario de la mascota; si no, se carga dueño y mascota juntos.
export function ElegirDueno({ cerrar }: { cerrar: () => void }) {
  const [texto, setTexto] = useState('')
  const [clientes, setClientes] = useState<Cliente[] | null>(null)
  const q = texto.trim()

  useEffect(() => {
    if (q.length < 2) return
    let vigente = true
    const espera = window.setTimeout(() => {
      apiGet<Cliente[]>(`/clientes?q=${encodeURIComponent(q)}`)
        .then((lista) => vigente && setClientes(lista.slice(0, 6)))
        .catch(() => vigente && setClientes([]))
    }, 250)
    return () => {
      vigente = false
      window.clearTimeout(espera)
    }
  }, [q])

  const resultados = q.length < 2 ? null : clientes

  return (
    <section className="tarjeta elegir-dueno" aria-labelledby="titulo-elegir-dueno">
      <div className="elegir-dueno-titulo">
        <h2 id="titulo-elegir-dueno">¿De quién es la mascota?</h2>
        <button type="button" className="boton-icono" onClick={cerrar} aria-label="Cerrar">
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <label className="buscador">
        <Search size={20} aria-hidden="true" />
        <span className="solo-lectores">Buscar al dueño</span>
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Nombre, apellido o teléfono del dueño"
          autoFocus
        />
      </label>

      {resultados && resultados.length === 0 && <p className="ayuda">No encontramos a nadie con “{q}”.</p>}
      {resultados && resultados.length > 0 && (
        <ul className="elegir-dueno-lista">
          {resultados.map((c) => (
            <li key={c.id}>
              <Link to={`/panel/clientes/${c.id}?agregar=mascota`} className="elegir-dueno-fila">
                <strong>
                  {c.apellido}, {c.nombre}
                </strong>
                <span>{formatearTelefono(c.telefono)}</span>
                <ChevronRight size={18} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link to="/panel/clientes/nuevo" className="enlace-con-icono">
        <UserPlus size={18} aria-hidden="true" /> Es de un cliente nuevo: cargar dueño y mascota
      </Link>
    </section>
  )
}
