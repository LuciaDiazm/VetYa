import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { CampoClave } from '../components/CampoClave'
import { PanelVentajas } from '../components/PanelVentajas'
import { useAuth, type DatosRegistro } from '../context/AuthContext'

const VACIO: DatosRegistro = { nombre: '', apellido: '', email: '', telefono: '', password: '' }

// Lo que gana el dueño al crear la cuenta (se muestra en la mitad azul)
const VENTAJAS = [
  { titulo: 'Pedí turnos sin llamar', detalle: 'Elegís el día y la hora, y queda confirmado.' },
  { titulo: 'Mirá las vacunas de tus mascotas', detalle: 'Y descargá el carnet cuando lo necesites.' },
  { titulo: 'Te recordamos cada turno', detalle: 'Por WhatsApp, el día anterior.' },
]

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
    // Mitad azul con lo que se gana al tener cuenta; mitad blanca con el formulario.
    <main className="registro">
      <PanelVentajas lema="Tu mascota, a un toque de la clínica" ventajas={VENTAJAS} />

      <div className="acceso-formulario registro-formulario">
        <h1>Crear cuenta</h1>
        <p className="acceso-bajada">Se crea una sola vez y te sirve para todas tus mascotas.</p>
        <form onSubmit={enviar} className="formulario">
          <div className="fila-campos">
            <Campo etiqueta="Nombre">
              <input
                value={datos.nombre}
                onChange={(e) => cambiar('nombre', e.target.value)}
                required
                autoComplete="given-name"
              />
            </Campo>
            <Campo etiqueta="Apellido">
              <input
                value={datos.apellido}
                onChange={(e) => cambiar('apellido', e.target.value)}
                required
                autoComplete="family-name"
              />
            </Campo>
          </div>
          <Campo etiqueta="Email">
            <input
              type="email"
              value={datos.email}
              onChange={(e) => cambiar('email', e.target.value)}
              required
              autoComplete="email"
            />
          </Campo>
          <Campo
            etiqueta="Teléfono con WhatsApp"
            ayuda="Con código de área. Si ya te atendiste en la clínica, usá ese mismo teléfono y vas a ver a tus mascotas."
          >
            <input
              type="tel"
              value={datos.telefono}
              onChange={(e) => cambiar('telefono', e.target.value)}
              required
              placeholder="3777 123456"
              autoComplete="tel"
            />
          </Campo>
          <CampoClave
            nueva
            valor={datos.password}
            onCambiar={(v) => cambiar('password', v)}
            ayuda="Mínimo 8 caracteres."
          />
          {error && (
            <p className="mensaje-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="boton ingreso-boton" disabled={enviando}>
            {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>
        </form>
        <p className="ingreso-registro">
          ¿Ya tenés cuenta?{' '}
          <Link to="/ingresar" state={ubicacion.state}>
            Ingresá
          </Link>
        </p>
      </div>
    </main>
  )
}

// Campo con su nombre arriba y, si hace falta, una ayuda corta debajo (igual que en Ingresar)
function Campo({ etiqueta, ayuda, children }: { etiqueta: string; ayuda?: string; children: ReactNode }) {
  return (
    <label className="campo">
      {etiqueta}
      {children}
      {ayuda && <span className="ayuda">{ayuda}</span>}
    </label>
  )
}
