import { KeyRound, Mail, MessageCircle, Phone } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { rutaInicial, useAuth } from '../context/AuthContext'
import { enlaceWhatsapp, useSitio } from '../lib/sitio'

export function Ingresar() {
  const { ingresar } = useAuth()
  const navegar = useNavigate()
  const ubicacion = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [olvido, setOlvido] = useState(false)
  const { datos: sitio } = useSitio()

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
    // Fondo del color de la foto (se funde con ella) que pasa al azul de VetYa.
    // La tarjeta blanca y la foto van juntas en el centro, la tarjeta apenas encima del borde de la foto.
    <main className="ingreso">
      <div className="ingreso-interior">
        <div className="acceso-formulario ingreso-tarjeta">
          <h1>Ingresar</h1>
          <form onSubmit={enviar} className="formulario">
            <label className="campo campo-icono">
              Email
              <span className="campo-con-icono">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
                <Mail size={22} aria-hidden="true" />
              </span>
            </label>
            <label className="campo campo-icono">
              Contraseña
              <span className="campo-con-icono">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <KeyRound size={22} aria-hidden="true" />
              </span>
            </label>

            {/* Sin emails automáticos: la clínica le da una contraseña nueva desde la ficha del cliente. */}
            {!olvido ? (
              <button type="button" className="boton-texto" onClick={() => setOlvido(true)} aria-expanded={false}>
                ¿Te olvidaste la contraseña?
              </button>
            ) : (
              sitio && (
                <div className="ingresar-olvido" role="region" aria-label="Recuperar la contraseña">
                  <p>
                    <strong>Tus datos y tus mascotas siguen guardados.</strong> Escribinos o llamanos y te damos una
                    contraseña nueva.
                  </p>
                  <div className="ingresar-olvido-botones">
                    <a
                      className="boton boton-whatsapp"
                      href={enlaceWhatsapp(
                        sitio.clinica.whatsapp,
                        `Hola, me olvidé la contraseña de mi cuenta en la web${email ? ` (${email})` : ''}. ¿Me dan una nueva?`,
                      )}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle size={20} aria-hidden="true" /> Escribir por WhatsApp
                    </a>
                    <a className="boton boton-contorno" href={`tel:+${sitio.clinica.whatsapp}`}>
                      <Phone size={20} aria-hidden="true" /> Llamar al {sitio.clinica.telefono}
                    </a>
                  </div>
                </div>
              )
            )}

            {error && (
              <p className="mensaje-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="boton ingreso-boton" disabled={enviando}>
              {enviando ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>

          <p className="ingreso-registro">
            ¿Todavía no tenés cuenta?{' '}
            <Link to="/registro" state={ubicacion.state}>
              Creá una
            </Link>
          </p>
        </div>
        <img src="/fotos/pastor-aleman-ingreso.webp" alt="" className="ingreso-foto" />
      </div>
    </main>
  )
}
