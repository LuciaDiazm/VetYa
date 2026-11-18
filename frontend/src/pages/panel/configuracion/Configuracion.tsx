import { useSearchParams } from 'react-router-dom'
import { DatosClinica } from './DatosClinica'
import { DiasCerrados } from './DiasCerrados'
import { Horarios } from './Horarios'
import { PersonalClinica } from './PersonalClinica'
import { Servicios } from './Servicios'

const SECCIONES = [
  { clave: 'clinica', nombre: 'Clínica', componente: DatosClinica },
  { clave: 'horarios', nombre: 'Horarios', componente: Horarios },
  { clave: 'cerrado', nombre: 'Días cerrados', componente: DiasCerrados },
  { clave: 'servicios', nombre: 'Servicios', componente: Servicios },
  { clave: 'personal', nombre: 'Personal', componente: PersonalClinica },
] as const

// Configuración de la clínica (solo administración). La sección elegida queda en la dirección,
// así al recargar la página se vuelve al mismo lugar.
export function Configuracion() {
  const [parametros, setParametros] = useSearchParams()
  const actual = SECCIONES.find((s) => s.clave === parametros.get('seccion')) ?? SECCIONES[0]
  const Seccion = actual.componente

  return (
    <>
      <div className="panel-encabezado">
        <h1>Ajustes</h1>
        <p>Los datos de la clínica, cuándo atiende, qué servicios ofrece y quiénes trabajan.</p>
      </div>

      <div className="pestanas pestanas-desplazables" role="tablist">
        {SECCIONES.map((s) => (
          <button
            key={s.clave}
            type="button"
            role="tab"
            aria-selected={s === actual}
            className={s === actual ? 'activa' : ''}
            onClick={() => setParametros(s === SECCIONES[0] ? {} : { seccion: s.clave })}
          >
            {s.nombre}
          </button>
        ))}
      </div>

      <Seccion />
    </>
  )
}
