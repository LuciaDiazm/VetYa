import { ArrowLeft, KeyRound, MessageCircle, Pencil, Phone, Plus } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CamposCliente } from '../../components/CamposCliente'
import { CamposMascota } from '../../components/CamposMascota'
import { datosDeCliente, MASCOTA_VACIA, type DatosCliente, type DatosMascota } from '../../lib/formularios'
import { apiGet, apiPatch, apiPost, apiPut } from '../../lib/api'
import { edadTexto, ESPECIES, formatearTelefono } from '../../lib/mascotas'
import { enlaceWhatsapp } from '../../lib/sitio'
import { TurnosDelCliente } from '../../components/TurnosDelCliente'
import type { ClienteDetalle as DatosClienteDetalle, Mascota } from '../../types'
import { IconoEspecie } from './Clientes'
import { Cargando } from '../../components/Cargando'

// Ficha del dueño: sus datos, contacto rápido y sus mascotas.
export function ClienteDetalle() {
  const { id } = useParams()
  const navegar = useNavigate()
  const [cliente, setCliente] = useState<DatosClienteDetalle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)
  const [datos, setDatos] = useState<DatosCliente | null>(null)
  const [agregando, setAgregando] = useState(false)
  const [nuevaMascota, setNuevaMascota] = useState<DatosMascota>(MASCOTA_VACIA)
  const [guardando, setGuardando] = useState(false)
  const [cambiandoClave, setCambiandoClave] = useState(false)
  const [claveNueva, setClaveNueva] = useState('')
  const [claveLista, setClaveLista] = useState(false)

  const cargar = useCallback(() => {
    apiGet<DatosClienteDetalle>(`/clientes/${id}`)
      .then(setCliente)
      .catch(() => setError('No se encontró el cliente.'))
  }, [id])
  useEffect(cargar, [cargar])

  async function guardarCliente(e: FormEvent) {
    e.preventDefault()
    if (!datos) return
    setGuardando(true)
    setError(null)
    try {
      await apiPut(`/clientes/${id}`, datos)
      setEditando(false)
      cargar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  async function guardarMascota(e: FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      const mascota = await apiPost<Mascota>(`/clientes/${id}/mascotas`, nuevaMascota)
      navegar(`/panel/mascotas/${mascota.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
      setGuardando(false)
    }
  }

  async function guardarClave(e: FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      await apiPatch(`/clientes/${id}/password`, { password: claveNueva })
      setCambiandoClave(false)
      setClaveLista(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar la contraseña')
    } finally {
      setGuardando(false)
    }
  }

  if (!cliente) {
    return error ? <p className="mensaje-error">{error}</p> : <Cargando />
  }

  const activas = cliente.mascotas.filter((m) => m.activo)
  const inactivas = cliente.mascotas.filter((m) => !m.activo)

  return (
    <>
      <Link to="/panel/clientes" className="volver">
        <ArrowLeft size={20} aria-hidden="true" /> Volver a clientes
      </Link>

      <div className="panel-encabezado panel-encabezado-acciones">
        <div>
          <h1>
            {cliente.nombre} {cliente.apellido}
          </h1>
          <p>
            {formatearTelefono(cliente.telefono)}
            {cliente.usuario ? '. Tiene cuenta en la web' : ''}
          </p>
        </div>
        <div className="acciones-contacto">
          <a href={enlaceWhatsapp(cliente.telefono, `Hola ${cliente.nombre}, te escribimos de la veterinaria.`)} target="_blank" rel="noreferrer" className="boton boton-whatsapp">
            <MessageCircle size={20} aria-hidden="true" /> WhatsApp
          </a>
          <a href={`tel:+${cliente.telefono}`} className="boton boton-contorno">
            <Phone size={20} aria-hidden="true" /> Llamar
          </a>
        </div>
      </div>

      {error && <p className="mensaje-error">{error}</p>}

      <section className="tarjeta bloque-ficha">
        <div className="bloque-ficha-titulo">
          <h2>Mascotas</h2>
          {!agregando && (
            <button type="button" className="boton boton-secundario" onClick={() => setAgregando(true)}>
              <Plus size={20} aria-hidden="true" /> Agregar mascota
            </button>
          )}
        </div>

        {agregando && (
          <form className="formulario subformulario" onSubmit={guardarMascota}>
            <CamposMascota datos={nuevaMascota} cambiar={setNuevaMascota} />
            <div className="formulario-botones">
              <button type="submit" className="boton" disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar mascota'}
              </button>
              <button type="button" className="boton-texto" onClick={() => setAgregando(false)}>
                Cancelar
              </button>
            </div>
          </form>
        )}

        {activas.length === 0 && !agregando ? (
          <p className="vacio">Todavía no tiene mascotas cargadas.</p>
        ) : (
          <ul className="lista-mascotas">
            {activas.map((m) => (
              <li key={m.id}>
                <Link to={`/panel/mascotas/${m.id}`} className="mascota-fila">
                  <span className="icono-circulo">
                    <IconoEspecie especie={m.especie} size={22} />
                  </span>
                  <span>
                    <strong>{m.nombre}</strong>
                    <span className="mascota-fila-detalle">
                      {[ESPECIES[m.especie], m.sexo === 'HEMBRA' ? 'hembra' : 'macho', edadTexto(m.fechaNacimiento)]
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  </span>
                  <span className="mascota-fila-ver">Ver ficha</span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {inactivas.length > 0 && (
          <p className="ayuda">
            Ya no se atienden: {inactivas.map((m) => (
              <Link key={m.id} to={`/panel/mascotas/${m.id}`}>
                {m.nombre}{' '}
              </Link>
            ))}
          </p>
        )}
      </section>

      <TurnosDelCliente cliente={cliente} alCambiar={(cambios) => setCliente({ ...cliente, ...cambios })} />

      <section className="tarjeta bloque-ficha">
        <div className="bloque-ficha-titulo">
          <h2>Datos del dueño</h2>
          {!editando && (
            <button
              type="button"
              className="boton boton-contorno"
              onClick={() => {
                setDatos(datosDeCliente(cliente))
                setEditando(true)
              }}
            >
              <Pencil size={18} aria-hidden="true" /> Editar
            </button>
          )}
        </div>

        {editando && datos ? (
          <form className="formulario" onSubmit={guardarCliente}>
            <CamposCliente datos={datos} cambiar={setDatos} />
            <div className="formulario-botones">
              <button type="submit" className="boton" disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar cambios'}
              </button>
              <button type="button" className="boton-texto" onClick={() => setEditando(false)}>
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <dl className="ficha-tabla">
            <div>
              <dt>Teléfono</dt>
              <dd>{formatearTelefono(cliente.telefono)}</dd>
            </div>
            <div>
              <dt>DNI</dt>
              <dd>{cliente.dni ?? 'Sin cargar'}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{cliente.email ?? 'Sin cargar'}</dd>
            </div>
            <div>
              <dt>Dirección</dt>
              <dd>{cliente.direccion ?? 'Sin cargar'}</dd>
            </div>
          </dl>
        )}
      </section>

      {cliente.usuario && (
        <section className="tarjeta bloque-ficha">
          <div className="bloque-ficha-titulo">
            <h2>Cuenta en la web</h2>
            {!cambiandoClave && (
              <button
                type="button"
                className="boton boton-contorno"
                onClick={() => {
                  setClaveNueva('')
                  setClaveLista(false)
                  setCambiandoClave(true)
                }}
              >
                <KeyRound size={18} aria-hidden="true" /> Darle una contraseña nueva
              </button>
            )}
          </div>
          <p>
            Entra con <strong>{cliente.usuario.email}</strong>. Si se olvidó la contraseña, dale una nueva y pasásela por
            WhatsApp o en persona.
          </p>
          {cambiandoClave && (
            <form className="formulario subformulario" onSubmit={guardarClave}>
              <label className="campo">
                Contraseña nueva (mínimo 8 caracteres)
                {/* Se ve mientras se escribe, para poder dictarla o copiarla. */}
                <input
                  type="text"
                  value={claveNueva}
                  onChange={(e) => setClaveNueva(e.target.value)}
                  minLength={8}
                  required
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              <div className="formulario-botones">
                <button type="submit" className="boton" disabled={guardando}>
                  {guardando ? 'Guardando…' : 'Guardar contraseña'}
                </button>
                <button type="button" className="boton-texto" onClick={() => setCambiandoClave(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          )}
          {claveLista && (
            <p className="mensaje-exito" role="status">
              Listo. Ya puede entrar con la contraseña nueva.
            </p>
          )}
        </section>
      )}
    </>
  )
}
