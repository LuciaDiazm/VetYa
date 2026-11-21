import { Pencil, Plus } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { apiGet, apiPatch, apiPost, apiPut } from '../../../lib/api'
import { leerMonto, montoParaEditar, pesos } from '../../../lib/pagos'
import { olvidarSitio } from '../../../lib/sitio'
import type { CategoriaServicio, ServicioConfig } from '../../../types'
import { Cargando } from '../../../components/Cargando'

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
  precio: string
  reservableOnline: boolean
  horarioPropio: boolean
  horaDesde: string
  horaHasta: string
  dias: number[] // 0 = domingo … 6 = sábado; vacío = todos los días
}

const NUEVO: Formulario = {
  nombre: '',
  categoria: 'CLINICA',
  descripcion: '',
  duracionMin: '20',
  precio: '',
  reservableOnline: true,
  horarioPropio: false,
  horaDesde: '09:00',
  horaHasta: '12:00',
  dias: [],
}

// Lunes primero, como en un almanaque de acá.
const DIAS: [number, string, string][] = [
  [1, 'Lu', 'lunes'],
  [2, 'Ma', 'martes'],
  [3, 'Mi', 'miércoles'],
  [4, 'Ju', 'jueves'],
  [5, 'Vi', 'viernes'],
  [6, 'Sá', 'sábado'],
  [0, 'Do', 'domingo'],
]

// "Martes y jueves de 09:00 a 12:00", para la lista.
function textoHorario(s: ServicioConfig) {
  if (!s.horaDesde && !s.diasSemana) return null
  const dias = s.diasSemana
    ? DIAS.filter(([n]) => s.diasSemana!.split(',').map(Number).includes(n)).map(([, , nombre]) => nombre)
    : []
  const textoDias = dias.length === 0 ? 'Todos los días' : dias.length === 1 ? dias[0] : `${dias.slice(0, -1).join(', ')} y ${dias.at(-1)}`
  const texto = s.horaDesde ? `${textoDias} de ${s.horaDesde} a ${s.horaHasta}` : textoDias
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

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
      <label className="campo campo-corto">
        Precio en pesos
        <input
          inputMode="decimal"
          value={datos.precio}
          onChange={(e) => setDatos({ ...datos, precio: e.target.value })}
          placeholder="Ej.: 18000"
          autoComplete="off"
        />
        <span className="ayuda">Se ve solo en el panel, nunca en la web. Al cobrar un turno ya aparece puesto.</span>
      </label>
      <label className="casilla">
        <input
          type="checkbox"
          checked={datos.horarioPropio}
          onChange={(e) => setDatos({ ...datos, horarioPropio: e.target.checked })}
        />
        Tiene un horario propio (por ejemplo, peluquería solo de 9 a 12)
      </label>
      {datos.horarioPropio && (
        <div className="horario-servicio">
          <div className="fila-campos">
            <label className="campo campo-corto">
              Desde
              <input
                type="time"
                step={300}
                value={datos.horaDesde}
                onChange={(e) => setDatos({ ...datos, horaDesde: e.target.value })}
                required
              />
            </label>
            <label className="campo campo-corto">
              Hasta
              <input
                type="time"
                step={300}
                value={datos.horaHasta}
                onChange={(e) => setDatos({ ...datos, horaHasta: e.target.value })}
                required
              />
            </label>
          </div>
          <fieldset className="grupo-filtro">
            <legend>Qué días (si no marcás ninguno, todos los que abre la clínica)</legend>
            <div className="chips">
              {DIAS.map(([n, corto, nombre]) => {
                const marcado = datos.dias.includes(n)
                return (
                  <button
                    key={n}
                    type="button"
                    className={`chip${marcado ? ' chip-activo' : ''}`}
                    aria-pressed={marcado}
                    aria-label={nombre}
                    onClick={() =>
                      setDatos((d) => ({ ...d, dias: marcado ? d.dias.filter((x) => x !== n) : [...d.dias, n] }))
                    }
                  >
                    {corto}
                  </button>
                )
              })}
            </div>
          </fieldset>
          <span className="ayuda">
            Siempre dentro del horario de la clínica: los turnos de este servicio solo se ofrecen en estos días y horas.
          </span>
        </div>
      )}
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
    const { precio, horarioPropio, horaDesde, horaHasta, dias, ...resto } = datos
    const cuerpo = {
      ...resto,
      duracionMin: Number(datos.duracionMin),
      precioReferencia: leerMonto(precio),
      horaDesde: horarioPropio ? horaDesde : null,
      horaHasta: horarioPropio ? horaHasta : null,
      diasSemana: horarioPropio ? dias : null,
    }
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

  if (!servicios) return error ? <p className="mensaje-error">{error}</p> : <Cargando />

  return (
    <section className="tarjeta">
      <div className="bloque-ficha-titulo">
        <h2>Todos los servicios</h2>
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
                  precio: montoParaEditar(s.precioReferencia === null ? null : Number(s.precioReferencia)),
                  reservableOnline: s.reservableOnline,
                  horarioPropio: Boolean(s.horaDesde || s.diasSemana),
                  horaDesde: s.horaDesde ?? '09:00',
                  horaHasta: s.horaHasta ?? '12:00',
                  dias: s.diasSemana ? s.diasSemana.split(',').map(Number) : [],
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
                  {s.precioReferencia === null ? 'Sin precio' : pesos(Number(s.precioReferencia))} ·{' '}
                  {s.reservableOnline ? 'Se pide desde la web' : 'Solo por WhatsApp o en la clínica'}
                  {!s.activo && ' · No se ofrece'}
                </span>
                {textoHorario(s) && <span className="ayuda servicio-horario">Horario: {textoHorario(s)}</span>}
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
