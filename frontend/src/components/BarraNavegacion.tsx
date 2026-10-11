import { Menu, Siren, X } from 'lucide-react'
import { startTransition, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { rutaInicial, useAuth } from '../context/AuthContext'
import { Logo } from './Logo'

const SECCIONES = [
  { ruta: '/#servicios', nombre: 'Servicios' },
  { ruta: '/adopcion', nombre: 'Adopción' },
  { ruta: '/#equipo', nombre: 'Equipo' },
  { ruta: '/#preguntas', nombre: 'Preguntas' },
  { ruta: '/#contacto', nombre: 'Contacto' },
]

// Encabezado de la parte pública. Pocas opciones y bien grandes:
// lo más buscado (pedir turno y urgencias) siempre queda a la vista.
export function BarraNavegacion() {
  const { usuario, cargando, salir } = useAuth()
  const navegar = useNavigate()
  const [menuAbierto, setMenuAbierto] = useState(false)

  function cerrarSesion() {
    // React Router navega dentro de una transición. Si la sesión se borrara por fuera de ella,
    // la página protegida se volvería a mostrar sin usuario y redirigiría al login.
    startTransition(() => {
      navegar('/')
      salir()
    })
    setMenuAbierto(false)
  }

  const cerrarMenu = () => setMenuAbierto(false)

  const enlacesCuenta = cargando ? null : usuario ? (
    <>
      <Link to={rutaInicial(usuario)} className="barra-enlace" onClick={cerrarMenu}>
        {usuario.rol === 'DUENIO' ? 'Mi cuenta' : 'Panel'}
      </Link>
      <button type="button" className="barra-enlace boton-texto" onClick={cerrarSesion}>
        Salir
      </button>
    </>
  ) : (
    <Link to="/ingresar" className="barra-enlace" onClick={cerrarMenu}>
      Ingresar
    </Link>
  )

  return (
    <header className="encabezado">
      <div className="contenedor barra-interior">
        <Link to="/" className="enlace-logo" aria-label="VetYa, ir al inicio" onClick={cerrarMenu}>
          <Logo />
        </Link>

        <nav className="menu-principal" aria-label="Secciones del sitio">
          {SECCIONES.map((s) => (
            <Link key={s.ruta} to={s.ruta} className="barra-enlace">
              {s.nombre}
            </Link>
          ))}
          {enlacesCuenta}
        </nav>

        <div className="barra-acciones">
          <Link to="/urgencias" className="enlace-urgencias">
            <Siren size={20} aria-hidden="true" />
            <span>Urgencias</span>
          </Link>
          <Link to="/turno" className="boton boton-secundario boton-turno">
            Pedir turno
          </Link>
          <button
            type="button"
            className="boton-menu"
            aria-expanded={menuAbierto}
            aria-controls="menu-movil"
            onClick={() => setMenuAbierto((a) => !a)}
          >
            {menuAbierto ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
            <span>{menuAbierto ? 'Cerrar' : 'Menú'}</span>
          </button>
        </div>
      </div>

      {menuAbierto && (
        <nav id="menu-movil" className="menu-movil" aria-label="Menú">
          {SECCIONES.map((s) => (
            <Link key={s.ruta} to={s.ruta} className="barra-enlace" onClick={cerrarMenu}>
              {s.nombre}
            </Link>
          ))}
          <Link to="/turno" className="barra-enlace" onClick={cerrarMenu}>
            Pedir turno
          </Link>
          <Link to="/urgencias" className="barra-enlace" onClick={cerrarMenu}>
            Urgencias
          </Link>
          {enlacesCuenta}
        </nav>
      )}
    </header>
  )
}
