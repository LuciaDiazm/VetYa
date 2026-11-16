import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { DisenoAcceso } from '../components/DisenoAcceso'
import { useAuth, type DatosRegistro } from '../context/AuthContext'

const VACIO: DatosRegistro = { nombre: '', apellido: '', email: '', telefono: '', password: '' }

// Registro de dueños de mascotas. Hace falta para pedir turno por la web.
export function Registro() {
  const { registrarse } = useAuth()
  const navegar = useNavigate()
  const ubicacion = useLocation()
  const [datos, setDatos] = useState<DatosRegistro>(VACIO)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  function cambiar(campo: keyof DatosRegistro, valor: string) {
    setDatos((d) => ({ ...d, [campo]: valor }))
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      await registrarse(datos)
      // Si venía de pedir un turno, vuelve ahí.
      const desde = (ubicacion.state as { desde?: string } | null)?.desde
      navegar(desde ?? '/mi-cuenta', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la cuenta')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <DisenoAcceso
      foto="/fotos/siames-saluda.webp"
      frase="Si ya te atendiste en la clínica, usá el mismo teléfono y vas a ver a tus mascotas.">
      <h1>Crear cuenta</h1>
      <p className="ayuda">
        Con tu cuenta pedís turnos y ves la historia clínica de tus mascotas y el carnet de vacunas.
      </p>
      <form onSubmit={enviar} className="formulario">
        <div className="fila-campos">
          <label className="campo">
            Nombre
            <input
              value={datos.nombre}
              onChange={(e) => cambiar('nombre', e.target.value)}
              required
              autoComplete="given-name"
            />
          </label>
          <label className="campo">
            Apellido
            <input
              value={datos.apellido}
              onChange={(e) => cambiar('apellido', e.target.value)}
              required
              autoComplete="family-name"
            />
          </label>
        </div>
        <label className="campo">
          Email
          <input
            type="email"
            value={datos.email}
            onChange={(e) => cambiar('email', e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label className="campo">
          Teléfono con WhatsApp
          <input
            type="tel"
            value={datos.telefono}
            onChange={(e) => cambiar('telefono', e.target.value)}
            required
            placeholder="3777 123456"
            autoComplete="tel"
          />
          <span className="ayuda">Con código de área, por ejemplo 3777 123456.</span>
        </label>
        <label className="campo">
          Contraseña
          <input
            type="password"
            value={datos.password}
            onChange={(e) => cambiar('password', e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
          <span className="ayuda">Mínimo 8 caracteres.</span>
        </label>
        {error && (
          <p className="mensaje-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="boton" disabled={enviando}>
          {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
      </form>
      <p>
        ¿Ya tenés cuenta?{' '}
        <Link to="/ingresar" state={ubicacion.state}>
          Ingresá
        </Link>
      </p>
    </DisenoAcceso>
  )
}
