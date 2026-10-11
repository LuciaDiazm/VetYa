import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { rutaInicial, useAuth } from '../context/AuthContext'

export function Ingresar() {
  const { ingresar } = useAuth()
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
    <main className="contenedor formulario-centrado">
      <h1>Ingresar</h1>
      <form onSubmit={enviar} className="formulario">
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label>
          Contraseña
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="boton" disabled={enviando}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
      <p>¿No tenés cuenta? <Link to="/registro">Creá una</Link></p>
    </main>
  )
}
