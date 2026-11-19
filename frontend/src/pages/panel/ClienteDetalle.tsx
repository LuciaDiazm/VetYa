import { CalendarPlus, Globe, KeyRound, MessageCircle, Pencil, Phone, Plus } from 'lucide-react'
import { BotonVolver } from '../../components/BotonVolver'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CamposCliente } from '../../components/CamposCliente'
import { CamposMascota } from '../../components/CamposMascota'
import { datosDeCliente, MASCOTA_VACIA, type DatosCliente, type DatosMascota } from '../../lib/formularios'
import { apiGet, apiPatch, apiPost, apiPut } from '../../lib/api'
import { edadTexto, nombreEspecie, formatearTelefono } from '../../lib/mascotas'
import { enlaceWhatsapp } from '../../lib/sitio'
import { TurnosDelCliente } from '../../components/TurnosDelCliente'
import type { ClienteDetalle as DatosClienteDetalle, Mascota } from '../../types'
import { IconoEspecie } from './Clientes'
import { Cargando } from '../../components/Cargando'

// Ficha del dueño: sus datos y botones de contacto al costado; sus mascotas y turnos al lado.
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
  const [emailCuenta, setEmailCuenta] = useState('')
  const [cuentaUnida, setCuentaUnida] = useState(false)
  const [errorUnir, setErrorUnir] = useState<string | null>(null)

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

  async function unirCuenta(e: FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setErrorUnir(null)
    try {
      await apiPatch(`/clientes/${id}/unir-cuenta`, { email: emailCuenta })
      setEmailCuenta('')
      setCuentaUnida(true)
      cargar()
    } catch (err) {
      setErrorUnir(err instanceof Error ? err.message : 'No se pudo unir la cuenta')
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
      <BotonVolver siNoHay="/panel/clientes" />

      {error && <p className="mensaje-error">{error}</p>}

      {/* Datos del dueño al costado (con los botones para contactarlo) y, al lado, sus mascotas y sus turnos */}
      <div className="ficha-con-costado">
        <aside className="tarjeta ficha-costado" aria-label="Datos del dueño">
          <h1>
            {cliente.nombre} {cliente.apellido}
          </h1>
          {cliente.usuario && (
            <p className="ficha-cliente-cuenta">
              <Globe size={16} aria-hidden="true" /> Tiene cuenta en la web
            </p>
          )}

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
            <>
              <dl className="ficha-costado-lista">
                <div>
                  <dt>Teléfono</dt>
                  <dd>{formatearTelefono(cliente.telefono)}</dd>
                </div>
                <div>
                  <dt>DNI</dt>
                  <dd className={cliente.dni ? undefined : 'sin-cargar'}>{cliente.dni ?? 'Sin cargar'}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd className={cliente.email ? undefined : 'sin-cargar'}>{cliente.email ?? 'Sin cargar'}</dd>
                </div>
                <div>
                  <dt>Dirección</dt>
                  <dd className={cliente.direccion ? undefined : 'sin-cargar'}>{cliente.direccion ?? 'Sin cargar'}</dd>
                </div>
              </dl>
              <div className="ficha-costado-botones">
                <a
                  href={enlaceWhatsapp(cliente.telefono, `Hola ${cliente.nombre}, te escribimos de la veterinaria.`)}
                  target="_blank"
                  rel="noreferrer"
                  className="boton boton-whatsapp"
                >
                  <MessageCircle size={20} aria-hidden="true" /> WhatsApp
                </a>
                <a href={`tel:+${cliente.telefono}`} className="boton boton-contorno">
                  <Phone size={20} aria-hidden="true" /> Llamar
                </a>
                <button
                  type="button"
                  className="boton boton-contorno"
                  onClick={() => {
                    setDatos(datosDeCliente(cliente))
                    setEditando(true)
                  }}
                >
                  <Pencil size={18} aria-hidden="true" /> Editar datos
                </button>
              </div>
            </>
          )}

          {/* Sin cuenta: si se registró en la web con otro email, la clínica la une acá */}
          {!cliente.usuario && (
            <section className="ficha-cliente-clave" aria-labelledby="titulo-unir-cuenta">
              <h2 id="titulo-unir-cuenta">Cuenta en la web</h2>
              <p>
                No tiene cuenta unida. Si ya se registró y no ve a sus mascotas, escribí el email con el que se registró.
              </p>
              <form className="formulario subformulario" onSubmit={unirCuenta}>
                <label className="campo">
                  Email de su cuenta
                  <input
                    type="email"
                    value={emailCuenta}
                    onChange={(e) => setEmailCuenta(e.target.value)}
                    required
                    autoComplete="off"
                    placeholder="Ej.: juan@gmail.com"
                  />
                </label>
                {errorUnir && (
                  <p className="mensaje-error" role="alert">
                    {errorUnir}
                  </p>
                )}
                <button type="submit" className="boton boton-contorno" disabled={guardando}>
                  <Globe size={18} aria-hidden="true" /> Unir cuenta
                </button>
              </form>
            </section>
          )}

          {cliente.usuario && (
            <section className="ficha-cliente-clave" aria-labelledby="titulo-cuenta-web">
              <h2 id="titulo-cuenta-web">Cuenta en la web</h2>
              <p>
                Entra con <strong>{cliente.usuario.email}</strong>. Si se olvidó la contraseña, dale una nueva y
                pasásela por WhatsApp o en persona.
              </p>
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
                  <KeyRound size={18} aria-hidden="true" /> Contraseña nueva
                </button>
              )}
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
              {cuentaUnida && (
                <p className="mensaje-exito" role="status">
                  Listo. Ya ve sus mascotas y turnos en su cuenta.
                </p>
              )}
              {claveLista && (
                <p className="mensaje-exito" role="status">
                  Listo. Ya puede entrar con la contraseña nueva.
                </p>
              )}
            </section>
          )}
        </aside>

        <div className="ficha-principal">
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
                  // La ficha y, al lado, "Dar turno" con la mascota ya elegida (sin buscarla de nuevo)
                  <li key={m.id} className="mascota-con-turno">
                    <Link to={`/panel/mascotas/${m.id}`} className="mascota-fila">
                      <span className="icono-circulo">
                        <IconoEspecie especie={m.especie} size={22} />
                      </span>
                      <span>
                        <strong>{m.nombre}</strong>
                        <span className="mascota-fila-detalle">
                          {[nombreEspecie(m), m.sexo === 'HEMBRA' ? 'hembra' : 'macho', edadTexto(m.fechaNacimiento)]
                            .filter(Boolean)
                            .join(', ')}
                        </span>
                      </span>
                      <span className="mascota-fila-ver">Ver ficha</span>
                    </Link>
                    <Link to={`/panel/agenda/nuevo?mascota=${m.id}`} className="boton boton-contorno">
                      <CalendarPlus size={20} aria-hidden="true" /> Dar turno
                      <span className="solo-lectores"> a {m.nombre}</span>
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
        </div>
      </div>
    </>
  )
}
