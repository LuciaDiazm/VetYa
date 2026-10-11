import { Link } from 'react-router-dom'
import { agruparHorarios } from '../lib/horarios'
import { useSitio } from '../lib/sitio'
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
          <p className="pie-texto">Teléfono: {clinica.telefono}</p>
          {clinica.email && <p className="pie-texto">{clinica.email}</p>}
          <p className="pie-texto">
            <Link to="/urgencias">Qué hacer en una urgencia</Link>
          </p>
        </div>
      </div>
      <div className="contenedor pie-legal">
        Fotos de Unsplash (Alexander Mass, Judy Beth Morris, Sueda Güzeldere, Buddy AN, Alvan Nee, NordWood
        Themes, Marios Gkortsilas, Victoria Fischer, FLOUFFY, ac dc, Slavy Darozhkin y Pedro Miguel Aires) y de
        Pexels (Sam Lion). Video de Vũ Nguyễn en Pexels. Mapa © colaboradores de OpenStreetMap.
      </div>
    </footer>
  )
}
