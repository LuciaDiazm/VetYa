import { Mail, Menu, MessageCircle, Phone, Siren, X } from 'lucide-react'
import { startTransition, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { rutaInicial, useAuth } from '../context/AuthContext'
import { enlaceWhatsapp, MENSAJE_TURNO, useSitio } from '../lib/sitio'
import { LogoMarca } from './Logo'

// Encabezado de la parte pública: franja de contacto y menú con el logo en el centro.
export function BarraNavegacion() {
  const { usuario, cargando, salir } = useAuth()
  const { datos } = useSitio()
  const navegar = useNavigate()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const clinica = datos?.clinica

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
  const turno = clinica ? enlaceWhatsapp(clinica.whatsapp, MENSAJE_TURNO) : undefined

  return (
    <header className="encabezado">
      <div className="franja-contacto">
        <div className="contenedor franja-interior">
          {clinica && (
            <>
              <a href={`tel:+${clinica.whatsapp}`}>
                <Phone size={15} aria-hidden="true" />
                <span className="sin-corte">{clinica.telefono}</span>
              </a>
              {clinica.email && (
                <a href={`mailto:${clinica.email}`} className="franja-email">
                  <Mail size={15} aria-hidden="true" />
                  {clinica.email}
                </a>
              )}
              <a href={turno} target="_blank" rel="noreferrer">
                <MessageCircle size={15} aria-hidden="true" />
                WhatsApp
              </a>
            </>
          )}
          <Link to="/urgencias" className="franja-urgencias">
            <Siren size={15} aria-hidden="true" />
            Urgencias
          </Link>
        </div>
      </div>

      <div className="barra">
        <div className="contenedor barra-interior">
          <nav className="menu-lado menu-izquierdo" aria-label="Secciones del sitio">
            <Link to="/#servicios" className="barra-enlace">
              Servicios
            </Link>
            <Link to="/#planes" className="barra-enlace">
              Planes
            </Link>
            <Link to="/#equipo" className="barra-enlace">
              Equipo
            </Link>
          </nav>

          <Link to="/" className="logo-central" aria-label="VetYa, ir al inicio" onClick={cerrarMenu}>
            <LogoMarca tamano={52} />
            <span className="logo-central-texto">VetYa</span>
            <span className="logo-central-bajada">Clínica veterinaria</span>
          </Link>

          <nav className="menu-lado menu-derecho" aria-label="Contacto y cuenta">
            <Link to="/#contacto" className="barra-enlace">
              Contacto
            </Link>
            {!cargando &&
              (usuario ? (
                <>
                  <Link to={rutaInicial(usuario)} className="barra-enlace">
                    {usuario.rol === 'DUENIO' ? 'Mi cuenta' : 'Panel'}
                  </Link>
                  <button type="button" className="barra-enlace boton-texto" onClick={cerrarSesion}>
                    Salir
                  </button>
                </>
              ) : (
                <Link to="/ingresar" className="barra-enlace">
                  Ingresar
                </Link>
              ))}
            {turno && (
              <a href={turno} target="_blank" rel="noreferrer" className="boton boton-secundario">
                Pedir turno
              </a>
            )}
          </nav>

          <button
            type="button"
            className="boton-menu"
            aria-expanded={menuAbierto}
            aria-controls="menu-movil"
            aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
            onClick={() => setMenuAbierto((a) => !a)}
          >
            {menuAbierto ? <X size={26} /> : <Menu size={26} />}
          </button>
        </div>

        {/* Menú del celular */}
        {menuAbierto && (
          <nav id="menu-movil" className="menu-movil" aria-label="Menú">
            {[
              ['/#servicios', 'Servicios'],
              ['/#planes', 'Planes'],
              ['/#equipo', 'Equipo'],
              ['/#contacto', 'Contacto'],
            ].map(([ruta, nombre]) => (
              <Link key={ruta} to={ruta} className="barra-enlace" onClick={cerrarMenu}>
                {nombre}
              </Link>
            ))}
            <NavLink to="/urgencias" className="barra-enlace" onClick={cerrarMenu}>
              Urgencias
            </NavLink>
            {!cargando &&
              (usuario ? (
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
              ))}
            {turno && (
              <a href={turno} target="_blank" rel="noreferrer" className="boton boton-secundario" onClick={cerrarMenu}>
                Pedir turno por WhatsApp
              </a>
            )}
          </nav>
        )}
      </div>
    </header>
  )
}
