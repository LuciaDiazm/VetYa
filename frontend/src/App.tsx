import { useEffect, useState } from 'react'
import { apiGet } from './lib/api'
import type { CategoriaServicio, Clinica, Servicio } from './types'

const NOMBRE_CATEGORIA: Record<CategoriaServicio, string> = {
  CLINICA: 'Clínica',
  DIAGNOSTICO: 'Diagnóstico',
  CIRUGIA: 'Cirugía',
  ESTETICA: 'Estética',
}

const NOMBRE_DIA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

// Primera versión: verifica que el frontend recibe datos reales del backend.
// La landing definitiva se diseña más adelante.
function App() {
  const [clinica, setClinica] = useState<Clinica | null>(null)
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([apiGet<Clinica>('/publico/clinica'), apiGet<Servicio[]>('/publico/servicios')])
      .then(([c, s]) => {
        setClinica(c)
        setServicios(s)
      })
      .catch(() => setError('No se pudo conectar con el servidor. ¿Está corriendo el backend?'))
  }, [])

  if (error) return <main className="contenedor"><p className="error">{error}</p></main>
  if (!clinica) return <main className="contenedor"><p>Cargando…</p></main>

  return (
    <main className="contenedor">
      <header>
        <h1>{clinica.nombre}</h1>
        <p>{clinica.direccion}</p>
        <a className="boton-whatsapp" href={`https://wa.me/${clinica.whatsapp}`} target="_blank" rel="noreferrer">
          Escribinos por WhatsApp
        </a>
      </header>

      <section>
        <h2>Servicios</h2>
        <ul className="servicios">
          {servicios.map((s) => (
            <li key={s.id}>
              <span className="categoria">{NOMBRE_CATEGORIA[s.categoria]}</span>
              <strong>{s.nombre}</strong>
              {s.descripcion && <p>{s.descripcion}</p>}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Horarios</h2>
        <ul>
          {clinica.horarios.map((h) => (
            <li key={h.id}>
              {NOMBRE_DIA[h.diaSemana]}: {h.horaInicio} a {h.horaFin}
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}

export default App
