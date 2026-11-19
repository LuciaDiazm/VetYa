import { KeyRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { apiPost, guardarToken } from '../lib/api'
import { CampoClave } from './CampoClave'

// "Cambiar mi contraseña": para dueños (en Mi cuenta) y para el personal (en el panel).
// Pide la actual, para que nadie la cambie si encuentra la sesión abierta en una compu ajena.
// Al cambiarla, las sesiones abiertas en otras compus o celulares se cierran; en esta se sigue adentro.
export function CambiarClave({ cerrable = false }: { cerrable?: boolean }) {
  const [abierto, setAbierto] = useState(!cerrable)
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [listo, setListo] = useState(false)
  const [guardando, setGuardando] = useState(false)

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setGuardando(true)
    try {
      const { token } = await apiPost<{ token: string }>('/auth/cambiar-password', { actual, nueva })
      guardarToken(token)
      setActual('')
      setNueva('')
      setListo(true)
      if (cerrable) setAbierto(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar la contraseña')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="cambiar-clave">
      {listo && (
        <p className="mensaje-exito" role="status">
          Listo, tu contraseña cambió. Si tenías la sesión abierta en otra compu o celular, ahí vas a tener que volver a
          entrar.
        </p>
      )}
      {!abierto ? (
        <button
          type="button"
          className="boton boton-contorno"
          onClick={() => {
            setListo(false)
            setAbierto(true)
          }}
        >
          <KeyRound size={18} aria-hidden="true" /> Cambiar mi contraseña
        </button>
      ) : (
        <form className="formulario cambiar-clave-formulario" onSubmit={guardar}>
          <CampoClave etiqueta="Contraseña actual" valor={actual} onCambiar={setActual} />
          <CampoClave
            nueva
            etiqueta="Contraseña nueva"
            valor={nueva}
            onCambiar={setNueva}
            ayuda="Mínimo 8 caracteres. Mejor una frase que puedas recordar."
          />
          {error && (
            <p className="mensaje-error" role="alert">
              {error}
            </p>
          )}
          <div className="formulario-botones">
            <button type="submit" className="boton" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar contraseña'}
            </button>
            {cerrable && (
              <button type="button" className="boton-texto" onClick={() => setAbierto(false)}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
