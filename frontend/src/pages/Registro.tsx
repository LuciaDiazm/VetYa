import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth, type DatosRegistro } from '../context/AuthContext'

const VACIO: DatosRegistro = { nombre: '', apellido: '', email: '', telefono: '', password: '' }

// Registro de dueños de mascotas. Es opcional: para sacar turno no hace falta cuenta.
export function Registro() {
  const { registrarse } = useAuth()
  const navegar = useNavigate()
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
      navegar('/mi-cuenta', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la cuenta')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="contenedor formulario-centrado">
      <h1>Crear cuenta</h1>
      <p className="ayuda">
        Con tu cuenta podés ver la historia clínica de tus mascotas, tus turnos y descargar el carnet de vacunas.
        Si ya te atendiste en la clínica, usá el mismo teléfono y vas a ver tus mascotas automáticamente.
      </p>
      <form onSubmit={enviar} className="formulario">
        <div className="fila">
          <label>
            Nombre
            <input value={datos.nombre} onChange={(e) => cambiar('nombre', e.target.value)} required autoComplete="given-name" />
          </label>
          <label>
            Apellido
            <input value={datos.apellido} onChange={(e) => cambiar('apellido', e.target.value)} required autoComplete="family-name" />
          </label>
        </div>
        <label>
          Email
          <input type="email" value={datos.email} onChange={(e) => cambiar('email', e.target.value)} required autoComplete="email" />
        </label>
        <label>
          Teléfono (WhatsApp)
          <input
            type="tel"
            value={datos.telefono}
            onChange={(e) => cambiar('telefono', e.target.value)}
            required
            placeholder="3777 123456"
            autoComplete="tel"
          />
          <span className="ayuda">Con código de área, sin el 0 y sin el 15.</span>
        </label>
        <label>
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
        {error && <p className="error">{error}</p>}
        <button type="submit" className="boton" disabled={enviando}>
          {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
      </form>
      <p>¿Ya tenés cuenta? <Link to="/ingresar">Ingresá</Link></p>
    </main>
  )
}
