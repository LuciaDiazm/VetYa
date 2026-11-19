import { BotonVolver } from '../../components/BotonVolver'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CamposCliente } from '../../components/CamposCliente'
import { CamposMascota } from '../../components/CamposMascota'
import { CLIENTE_VACIO, MASCOTA_VACIA, type DatosCliente, type DatosMascota } from '../../lib/formularios'
import { apiPost, ErrorApi } from '../../lib/api'
import type { Cliente } from '../../types'

// Alta rápida en el mostrador: el dueño y su mascota en una sola pantalla.
export function NuevoCliente() {
  const navegar = useNavigate()
  const [cliente, setCliente] = useState<DatosCliente>(CLIENTE_VACIO)
  const [mascota, setMascota] = useState<DatosMascota>(MASCOTA_VACIA)
  const [conMascota, setConMascota] = useState(true)
  const [error, setError] = useState<{ texto: string; clienteId?: number } | null>(null)
  const [guardando, setGuardando] = useState(false)

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setGuardando(true)
    try {
      const creado = await apiPost<Cliente>('/clientes', { ...cliente, mascota: conMascota ? mascota : undefined })
      // Si cargó una mascota, va directo a su ficha (lo más común es atenderla en ese momento).
      navegar(creado.mascotas[0] ? `/panel/mascotas/${creado.mascotas[0].id}` : `/panel/clientes/${creado.id}`, { replace: true })
    } catch (err) {
      if (err instanceof ErrorApi && err.status === 409) {
        setError({ texto: err.message, clienteId: err.datos?.clienteId as number | undefined })
      } else {
        setError({ texto: err instanceof Error ? err.message : 'No se pudo guardar' })
      }
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      <BotonVolver siNoHay="/panel/clientes" />
      <div className="panel-encabezado">
        <h1>Nuevo cliente</h1>
        <p>Cargá al dueño y a su mascota. Lo demás se puede completar después.</p>
      </div>

      <form className="formulario formulario-animal" onSubmit={guardar}>
        <section className="tarjeta formulario">
          <h2>Dueño</h2>
          <CamposCliente datos={cliente} cambiar={setCliente} />
        </section>

        <section className="tarjeta formulario">
          <h2>Mascota</h2>
          {conMascota ? (
            <>
              <CamposMascota datos={mascota} cambiar={setMascota} />
              <button type="button" className="boton-texto enlace-chico" onClick={() => setConMascota(false)}>
                Cargar solo al dueño, sin mascota
              </button>
            </>
          ) : (
            <button type="button" className="boton boton-contorno" onClick={() => setConMascota(true)}>
              Agregar mascota
            </button>
          )}
        </section>

        {error && (
          <div className="mensaje-error" role="alert">
            {error.texto}.{' '}
            {error.clienteId && <Link to={`/panel/clientes/${error.clienteId}`}>Ir a su ficha</Link>}
          </div>
        )}

        <div className="formulario-botones">
          <button type="submit" className="boton boton-grande" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </>
  )
}
