import { ArrowLeft, CircleCheck } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CambiarClave } from '../components/CambiarClave'
import { Cargando } from '../components/Cargando'
import { useAuth } from '../context/AuthContext'
import { apiGet, apiPut } from '../lib/api'
import { formatearTelefono } from '../lib/mascotas'

interface DatosCuenta {
  email: string
  cliente: { nombre: string; apellido: string; telefono: string; direccion: string | null } | null
}

// Mis datos del dueño: nombre, teléfono y dirección (los usa la clínica y salen en el carnet), y la contraseña.
export function MisDatos() {
  const { hash } = useLocation()
  const [datos, setDatos] = useState<DatosCuenta | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiGet<DatosCuenta>('/mi-cuenta/datos')
      .then(setDatos)
      .catch(() => setError('No se pudieron ver tus datos. Probá de nuevo en un rato.'))
  }, [])

  // Si viene de "Cambiar contraseña", baja hasta el formulario (cuando ya cargó lo de arriba, para que no salte).
  useEffect(() => {
    if (hash === '#contrasena' && (datos || error)) document.getElementById('contrasena')?.scrollIntoView({ block: 'start' })
  }, [hash, datos, error])

  return (
    <main className="mi-cuenta-fondo">
      <div className="contenedor mi-cuenta mis-datos">
        <Link to="/mi-cuenta" className="enlace-con-icono">
          <ArrowLeft size={18} aria-hidden="true" /> Volver a Mi cuenta
        </Link>
        <h1>Mis datos</h1>

        <section className="cuenta-seccion" aria-labelledby="titulo-datos">
          <h2 id="titulo-datos" className="cuenta-titulo">
            Tus datos
          </h2>
          {error ? (
            <p className="mensaje-error">{error}</p>
          ) : !datos ? (
            <Cargando />
          ) : datos.cliente ? (
            <FormularioDatos email={datos.email} inicial={datos.cliente} />
          ) : (
            <p className="cuenta-vacio">Cuando la clínica cargue tu ficha, vas a poder cambiar tus datos acá.</p>
          )}
        </section>

        {/* Desde el menú "Cambiar contraseña" se llega acá con el formulario ya abierto. */}
        <section id="contrasena" className="cuenta-seccion" aria-labelledby="titulo-clave">
          <h2 id="titulo-clave" className="cuenta-titulo">
            Tu contraseña
          </h2>
          <CambiarClave key={hash} cerrable={hash !== '#contrasena'} />
        </section>
      </div>
    </main>
  )
}

function FormularioDatos({ email, inicial }: { email: string; inicial: NonNullable<DatosCuenta['cliente']> }) {
  const { usuario, actualizar } = useAuth()
  const [nombre, setNombre] = useState(inicial.nombre)
  const [apellido, setApellido] = useState(inicial.apellido)
  const [telefono, setTelefono] = useState(formatearTelefono(inicial.telefono))
  const [direccion, setDireccion] = useState(inicial.direccion ?? '')
  const [error, setError] = useState<string | null>(null)
  const [listo, setListo] = useState(false)
  const [guardando, setGuardando] = useState(false)

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setListo(false)
    setGuardando(true)
    try {
      const nuevo = await apiPut<{ nombre: string; apellido: string; telefono: string }>('/mi-cuenta/datos', {
        nombre,
        apellido,
        telefono,
        direccion,
      })
      setTelefono(formatearTelefono(nuevo.telefono))
      // El saludo y el menú de arriba muestran el nombre nuevo enseguida.
      if (usuario) actualizar({ ...usuario, nombre: nuevo.nombre, apellido: nuevo.apellido, telefono: nuevo.telefono })
      setListo(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron guardar tus datos')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form className="formulario tarjeta mis-datos-formulario" onSubmit={guardar}>
      <div className="fila-campos">
        <label className="campo">
          Nombre
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={60} autoComplete="given-name" />
        </label>
        <label className="campo">
          Apellido
          <input value={apellido} onChange={(e) => setApellido(e.target.value)} required maxLength={60} autoComplete="family-name" />
        </label>
      </div>
      <label className="campo">
        Teléfono (WhatsApp)
        <input
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          required
          inputMode="tel"
          autoComplete="tel"
          placeholder="Ej.: 3777 123456"
        />
        <small>A este número te escribe la clínica para recordarte turnos y vacunas.</small>
      </label>
      <label className="campo">
        Dirección (opcional)
        <input
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          maxLength={150}
          autoComplete="street-address"
          placeholder="Ej.: Belgrano 1234"
        />
        <small>Sale en el carnet de vacunas.</small>
      </label>
      <p className="ayuda">
        Entrás con <strong>{email}</strong>. Para cambiar el email, pedíselo a la clínica.
      </p>
      {error && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}
      {listo && (
        <p className="mensaje-exito" role="status">
          <CircleCheck size={18} aria-hidden="true" /> Listo, guardamos tus datos.
        </p>
      )}
      <div className="formulario-botones">
        <button type="submit" className="boton" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}
