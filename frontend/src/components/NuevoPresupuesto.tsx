import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { apiGet, apiPost } from '../lib/api'
import { hoyArgentina, sumarDias } from '../lib/fechas'
import { leerMonto, montoParaEditar, pesos } from '../lib/pagos'
import { DIAS_VALIDEZ } from '../lib/presupuestos'
import type { Mascota, Presupuesto, ServicioConPrecio } from '../types'

interface Renglon {
  clave: number
  descripcion: string
  monto: string
  servicioId?: number
}

// Primero los servicios para los que se suele pedir presupuesto (cirugías y limpieza dental).
function ordenar(servicios: ServicioConPrecio[]) {
  return [...servicios].sort((a, b) => Number(b.categoria === 'CIRUGIA') - Number(a.categoria === 'CIRUGIA'))
}

// Armar un presupuesto: se elige un servicio (ya trae su precio) y se suman renglones si hace falta
// (anestesia, análisis previos, medicación…). Vale 15 días salvo que se cambie.
export function NuevoPresupuesto({
  clienteId,
  mascotas,
  alGuardar,
  alCancelar,
}: {
  clienteId: number
  mascotas: Pick<Mascota, 'id' | 'nombre'>[]
  alGuardar: (p: Presupuesto) => void
  alCancelar: () => void
}) {
  const id = useId()
  const [servicios, setServicios] = useState<ServicioConPrecio[]>([])
  const [mascotaId, setMascotaId] = useState<number | null>(mascotas[0]?.id ?? null)
  const [renglones, setRenglones] = useState<Renglon[]>([{ clave: 1, descripcion: '', monto: '' }])
  const [validoHasta, setValidoHasta] = useState(() => sumarDias(hoyArgentina(), DIAS_VALIDEZ))
  const [hoy] = useState(hoyArgentina)
  const [nota, setNota] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    apiGet<ServicioConPrecio[]>('/presupuestos/servicios')
      .then((s) => setServicios(ordenar(s)))
      .catch(() => {})
  }, [])

  const total = renglones.reduce((s, r) => s + (leerMonto(r.monto) ?? 0), 0)
  const siguienteClave = () => Math.max(0, ...renglones.map((r) => r.clave)) + 1

  function cambiar(clave: number, cambios: Partial<Renglon>) {
    setRenglones((l) => l.map((r) => (r.clave === clave ? { ...r, ...cambios } : r)))
  }

  function agregarServicio(idServicio: string) {
    const s = servicios.find((x) => String(x.id) === idServicio)
    if (!s) return
    const nuevo = { descripcion: s.nombre, monto: montoParaEditar(s.precioReferencia), servicioId: s.id }
    setRenglones((l) => {
      // Si el único renglón está vacío, se usa ese
      if (l.length === 1 && !l[0].descripcion && !l[0].monto) return [{ ...l[0], ...nuevo }]
      return [...l, { clave: siguienteClave(), ...nuevo }]
    })
  }

  async function guardar(e: FormEvent) {
    e.preventDefault()
    const items = renglones
      .filter((r) => r.descripcion.trim() || r.monto.trim())
      .map((r) => ({ descripcion: r.descripcion.trim(), monto: leerMonto(r.monto) }))
    if (items.length === 0) return setError('Agregá al menos un renglón')
    if (items.some((i) => !i.descripcion)) return setError('Escribí qué incluye cada renglón')
    if (items.some((i) => i.monto === null)) return setError('Revisá los montos')
    if (total <= 0) return setError('El total tiene que ser mayor a cero')
    setGuardando(true)
    setError(null)
    try {
      const creado = await apiPost<Presupuesto>('/presupuestos', {
        clienteId,
        mascotaId: mascotaId ?? undefined,
        servicioId: renglones.find((r) => r.servicioId)?.servicioId,
        items,
        validoHasta,
        nota: nota.trim() || undefined,
      })
      alGuardar(creado)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el presupuesto')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form className="formulario nuevo-presupuesto" onSubmit={guardar}>
      {mascotas.length > 1 && (
        <fieldset className="cobro-medios nuevo-presupuesto-mascotas">
          <legend>Para</legend>
          {mascotas.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`chip${mascotaId === m.id ? ' chip-activo' : ''}`}
              aria-pressed={mascotaId === m.id}
              onClick={() => setMascotaId(m.id)}
            >
              {m.nombre}
            </button>
          ))}
        </fieldset>
      )}

      <label className="campo" htmlFor={`${id}-servicio`}>
        Agregar un servicio
        <select id={`${id}-servicio`} value="" onChange={(e) => agregarServicio(e.target.value)}>
          <option value="">Elegí un servicio (trae su precio)</option>
          {servicios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
              {s.precioReferencia !== null ? ` · ${pesos(s.precioReferencia)}` : ''}
            </option>
          ))}
        </select>
      </label>

      <div className="presupuesto-renglones" role="group" aria-label="Qué incluye">
        {renglones.map((r, i) => (
          <div key={r.clave} className="presupuesto-renglon">
            <label className="campo" htmlFor={`${id}-d${r.clave}`}>
              <span className={i === 0 ? undefined : 'solo-lectores'}>Qué incluye</span>
              <input
                id={`${id}-d${r.clave}`}
                value={r.descripcion}
                onChange={(e) => cambiar(r.clave, { descripcion: e.target.value })}
                maxLength={160}
                placeholder={i === 0 ? 'Ej.: Castración' : 'Ej.: Análisis prequirúrgico'}
                autoComplete="off"
              />
            </label>
            <label className="campo presupuesto-renglon-monto" htmlFor={`${id}-m${r.clave}`}>
              <span className={i === 0 ? undefined : 'solo-lectores'}>Monto</span>
              <input
                id={`${id}-m${r.clave}`}
                inputMode="decimal"
                value={r.monto}
                onChange={(e) => cambiar(r.clave, { monto: e.target.value })}
                placeholder="Ej.: 60000"
                autoComplete="off"
              />
            </label>
            {renglones.length > 1 && (
              <button
                type="button"
                className="boton-icono presupuesto-renglon-quitar"
                onClick={() => setRenglones((l) => l.filter((x) => x.clave !== r.clave))}
                aria-label={`Quitar ${r.descripcion || 'renglón'}`}
              >
                <Trash2 size={18} aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          className="boton-texto presupuesto-agregar"
          onClick={() => setRenglones((l) => [...l, { clave: siguienteClave(), descripcion: '', monto: '' }])}
        >
          <Plus size={18} aria-hidden="true" /> Agregar renglón
        </button>
      </div>

      <p className="presupuesto-total">
        Total <strong>{pesos(total)}</strong>
      </p>

      <div className="nuevo-presupuesto-pie">
        <label className="campo" htmlFor={`${id}-vale`}>
          Vale hasta
          <input id={`${id}-vale`} type="date" min={hoy} value={validoHasta} onChange={(e) => setValidoHasta(e.target.value)} required />
        </label>
        <label className="campo" htmlFor={`${id}-nota`}>
          Nota para el dueño (opcional)
          <input
            id={`${id}-nota`}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            maxLength={500}
            placeholder="Ej.: Incluye el control a los 10 días"
            autoComplete="off"
          />
        </label>
      </div>

      {error && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}
      <div className="formulario-botones">
        <button type="submit" className="boton" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar presupuesto'}
        </button>
        <button type="button" className="boton-texto" onClick={alCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
