import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { DisenoAcceso } from '../components/DisenoAcceso'
import { rutaInicial, useAuth } from '../context/AuthContext'
import { enlaceWhatsapp, MENSAJE_TURNO, useSitio } from '../lib/sitio'

export function Ingresar() {
  const { ingresar } = useAuth()
  const { datos } = useSitio()
  const navegar = useNavigate()
  const ubicacion = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      const usuario = await ingresar(email, password)
      // Si venía de una página protegida, vuelve ahí; si no, a la página de su rol.
      const desde = (ubicacion.state as { desde?: string } | null)?.desde
      navegar(desde ?? rutaInicial(usuario), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <DisenoAcceso foto="/fotos/labrador-asomado.jpg" frase="Sus vacunas, sus consultas y sus turnos, siempre a mano.">
      <h1>Ingresar</h1>
      <p className="ayuda">Para dueños de mascotas y para el equipo de la clínica.</p>
      <form onSubmit={enviar} className="formulario">
        <label className="campo">
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label className="campo">
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        {error && (
          <p className="mensaje-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="boton" disabled={enviando}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
      <p>
        ¿Todavía no tenés cuenta? <Link to="/registro">Creá una</Link>
      </p>
      {datos && (
        <div className="aviso-sin-cuenta">
          <p>
            <strong>¿Solo querés pedir un turno?</strong> No necesitás cuenta.
          </p>
          <a
            href={enlaceWhatsapp(datos.clinica.whatsapp, MENSAJE_TURNO)}
            target="_blank"
            rel="noreferrer"
            className="boton boton-secundario"
          >
            Pedir turno por WhatsApp
          </a>
        </div>
      )}
    </DisenoAcceso>
  )
}
