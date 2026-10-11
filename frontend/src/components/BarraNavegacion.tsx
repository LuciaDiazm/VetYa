import { startTransition } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { rutaInicial, useAuth } from '../context/AuthContext'

export function BarraNavegacion() {
  const { usuario, salir } = useAuth()
  const navegar = useNavigate()

  function cerrarSesion() {
    // React Router navega dentro de una transición. Si la sesión se borrara por fuera de ella,
    // la página protegida se volvería a mostrar sin usuario y redirigiría al login.
    startTransition(() => {
      navegar('/')
      salir()
    })
  }

  return (
    <nav className="barra">
      <div className="barra-interior">
        <Link to="/" className="marca">VetYa</Link>
        <div className="barra-acciones">
          {usuario ? (
            <>
              <Link to={rutaInicial(usuario)}>{usuario.rol === 'DUENIO' ? 'Mi cuenta' : 'Panel'}</Link>
              <button type="button" className="boton-texto" onClick={cerrarSesion}>Salir</button>
            </>
          ) : (
            <>
              <Link to="/ingresar">Ingresar</Link>
              <Link to="/registro" className="boton">Crear cuenta</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
