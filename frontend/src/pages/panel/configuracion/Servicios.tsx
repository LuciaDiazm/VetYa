import { Pencil, Plus } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { apiGet, apiPatch, apiPost, apiPut } from '../../../lib/api'
import { olvidarSitio } from '../../../lib/sitio'
import type { CategoriaServicio, ServicioConfig } from '../../../types'

const CATEGORIAS: Record<CategoriaServicio, string> = {
  CLINICA: 'Clínica',
  DIAGNOSTICO: 'Diagnóstico',
  CIRUGIA: 'Cirugía',
  ESTETICA: 'Estética',
}

interface Formulario {
  nombre: string
  categoria: CategoriaServicio
  descripcion: string
  duracionMin: string
  reservableOnline: boolean
}

const NUEVO: Formulario = { nombre: '', categoria: 'CLINICA', descripcion: '', duracionMin: '20', reservableOnline: true }

function FormularioServicio({
  inicial,
  alGuardar,
  alCancelar,
}: {
  inicial: Formulario
  alGuardar: (datos: Formulario) => Promise<void>
  alCancelar: () => void
}) {
  const [datos, setDatos] = useState(inicial)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setGuardando(true)
    try {
      await alGuardar(datos)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
      setGuardando(false)
    }
  }

  return (
    <form className="formulario formulario-en-lista" onSubmit={enviar}>
      <div className="fila-campos">
        <label className="campo">
          Nombre
          <input value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} required />
        </label>
        <label className="campo">
          Tipo
          <select
            value={datos.categoria}
            onChange={(e) => setDatos({ ...datos, categoria: e.target.value as CategoriaServicio })}
          >
            {Object.entries(CATEGORIAS).map(([clave, nombre]) => (
              <option key={clave} value={clave}>
                {nombre}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="campo">
        Descripción (opcional)
        <textarea
          rows={2}
          value={datos.descripcion}
          onChange={(e) => setDatos({ ...datos, descripcion: e.target.value })}
        />
      </label>
      <label className="campo campo-corto">
        Duración del turno (minutos)
        <input
          type="number"
          min={5}
          max={480}
          step={5}
          value={datos.duracionMin}
          onChange={(e) => setDatos({ ...datos, duracionMin: e.target.value })}
          required
        />
        <span className="ayuda">Cambiarla no modifica los turnos ya dados.</span>
      </label>
      <label className="casilla">
        <input
          type="checkbox"
          checked={datos.reservableOnline}
          onChange={(e) => setDatos({ ...datos, reservableOnline: e.target.checked })}
        />
        Se puede pedir turno desde la web
      </label>
      {error && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}
      <div className="formulario-botones">
        <button type="submit" className="boton" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" className="boton-texto" onClick={alCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

// Servicios que ofrece la clínica. No se borran (tienen turnos e historia): se dejan de ofrecer.
export function Servicios() {
  const [servicios, setServicios] = useState<ServicioConfig[] | null>(null)
  const [editando, setEditando] = useState<number | 'nuevo' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(() => {
    apiGet<ServicioConfig[]>('/configuracion/servicios')
      .then(setServicios)
      .catch(() => setError('No se pudieron cargar los servicios.'))
  }, [])
  useEffect(cargar, [cargar])

  async function guardar(id: number | 'nuevo', datos: Formulario) {
    const cuerpo = { ...datos, duracionMin: Number(datos.duracionMin) }
    if (id === 'nuevo') await apiPost('/configuracion/servicios', cuerpo)
    else await apiPut(`/configuracion/servicios/${id}`, cuerpo)
    olvidarSitio()
    setEditando(null)
    cargar()
  }

  async function cambiarActivo(s: ServicioConfig) {
    setError(null)
    try {
      await apiPatch(`/configuracion/servicios/${s.id}/activo`, { activo: !s.activo })
      olvidarSitio()
      cargar()
    } catch {
      setError('No se pudo cambiar el servicio.')
    }
  }

  if (!servicios) return error ? <p className="mensaje-error">{error}</p> : <p className="cargando">Cargando…</p>

  return (
    <section className="tarjeta">
      <div className="bloque-ficha-titulo">
        <h2>Servicios</h2>
        {editando !== 'nuevo' && (
          <button type="button" className="boton" onClick={() => setEditando('nuevo')}>
            <Plus size={18} aria-hidden="true" /> Nuevo servicio
          </button>
        )}
      </div>
      {error && <p className="mensaje-error">{error}</p>}
      {editando === 'nuevo' && (
        <FormularioServicio inicial={NUEVO} alGuardar={(d) => guardar('nuevo', d)} alCancelar={() => setEditando(null)} />
      )}

      <ul className="lista-config">
        {servicios.map((s) =>
          editando === s.id ? (
            <li key={s.id}>
              <FormularioServicio
                inicial={{
                  nombre: s.nombre,
                  categoria: s.categoria,
                  descripcion: s.descripcion ?? '',
                  duracionMin: String(s.duracionMin),
                  reservableOnline: s.reservableOnline,
                }}
                alGuardar={(d) => guardar(s.id, d)}
                alCancelar={() => setEditando(null)}
              />
            </li>
          ) : (
            <li key={s.id} className={s.activo ? '' : 'inactivo'}>
              <div>
                <strong>{s.nombre}</strong>
                <span className="ayuda">
                  {CATEGORIAS[s.categoria]} · {s.duracionMin} min ·{' '}
                  {s.reservableOnline ? 'Se pide desde la web' : 'Solo por WhatsApp o en la clínica'}
                  {!s.activo && ' · No se ofrece'}
                </span>
              </div>
              <div className="acciones-config">
                {s.activo && (
                  <button type="button" className="boton boton-contorno" onClick={() => setEditando(s.id)}>
                    <Pencil size={16} aria-hidden="true" /> Editar
                  </button>
                )}
                <button type="button" className="boton-texto enlace-chico" onClick={() => cambiarActivo(s)}>
                  {s.activo ? 'Dejar de ofrecer' : 'Volver a ofrecer'}
                </button>
              </div>
            </li>
          ),
        )}
      </ul>
    </section>
  )
}
