import { Link } from 'react-router-dom'
import { agruparHorarios } from '../lib/horarios'
import { enlaceTelefono, useSitio } from '../lib/sitio'
import { Logo } from './Logo'

// Pie de página de la parte pública, igual en todas las páginas.
export function Pie() {
  const { datos } = useSitio()
  if (!datos) return null
  const { clinica } = datos

  return (
    <footer className="pie">
      <div className="contenedor pie-columnas">
        <div>
          <Logo />
          <p className="pie-texto">
            {clinica.nombre}
            <br />
            {clinica.direccion}
          </p>
        </div>
        <div>
          <h2 className="pie-titulo">Horarios</h2>
          {agruparHorarios(clinica.horarios).map((r) => (
            <p key={r.dias} className="pie-texto">
              {r.dias}: {r.horas}
            </p>
          ))}
        </div>
        <div>
          <h2 className="pie-titulo">Contacto</h2>
          <p className="pie-texto">
            <a href={enlaceTelefono(clinica.telefono)}>Llamar a la clínica</a>
          </p>
          {clinica.email && <p className="pie-texto">{clinica.email}</p>}
          <p className="pie-texto">
            <Link to="/urgencias">Qué hacer en una urgencia</Link>
          </p>
          <p className="pie-texto">
            <Link to="/#equipo">Nuestro equipo</Link>
          </p>
          <p className="pie-texto">
            <Link to="/#preguntas">Preguntas frecuentes</Link>
          </p>
        </div>
      </div>
      <div className="contenedor pie-legal">
        Sitio de ejemplo para un Trabajo Final: la clínica, el equipo y las fotos son ilustrativos. Mapa ©
        colaboradores de OpenStreetMap.
      </div>
    </footer>
  )
}
