import { History } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Cargando } from '../../../components/Cargando'
import { apiGet } from '../../../lib/api'
import { diaDe, fechaCortaDe, horaDe, hoyArgentina, sumarDias } from '../../../lib/fechas'
import { NOMBRE_ROL } from '../../../lib/permisos'
import type { Cambio } from '../../../types'

const QUE = [
  ['', 'Todo'],
  ['consulta', 'Consultas'],
  ['aplicacion', 'Vacunas'],
  ['turno', 'Turnos'],
  ['pago', 'Cobros'],
  ['adjunto', 'Archivos'],
  ['mascota', 'Mascotas'],
  ['usuario', 'Personal'],
] as const

const CAMPOS: Record<string, string> = {
  motivo: 'Motivo',
  pesoKg: 'Peso',
  temperatura: 'Temperatura',
  diagnostico: 'Diagnóstico',
  tratamiento: 'Tratamiento',
  observaciones: 'Observaciones',
  rol: 'Perfil',
  fechaHoraInicio: 'Día y hora',
}

function valor(v: unknown) {
  if (v === null || v === undefined || v === '') return '(vacío)'
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return `${fechaCortaDe(v)} ${horaDe(v)}`
  if (typeof v === 'string' && v in NOMBRE_ROL) return NOMBRE_ROL[v as keyof typeof NOMBRE_ROL]
  return String(v)
}

// Registro de cambios (solo administración): quién corrigió una consulta, anuló una vacuna o un cobro,
// movió o canceló un turno, quitó un archivo o cambió algo del personal. No se puede borrar ni editar.
export function RegistroCambios() {
  const hoy = hoyArgentina()
  const [desde, setDesde] = useState(() => sumarDias(hoyArgentina(), -30))
  const [hasta, setHasta] = useState(hoy)
  const [entidad, setEntidad] = useState('')
  const [cambios, setCambios] = useState<Cambio[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const parametros = new URLSearchParams({ desde, hasta, ...(entidad ? { entidad } : {}) })
    let vigente = true
    apiGet<{ cambios: Cambio[] }>(`/auditoria?${parametros}`)
      .then((r) => vigente && setCambios(r.cambios))
      .catch(() => vigente && setError('No se pudo cargar el registro.'))
    return () => {
      vigente = false
    }
  }, [desde, hasta, entidad])

  return (
    <section className="tarjeta bloque-ficha registro-cambios">
      <div className="bloque-ficha-titulo">
        <h2>
          <History size={22} aria-hidden="true" /> Registro de cambios
        </h2>
      </div>
      <p className="ayuda">
        Lo que se corrigió, anuló, movió o quitó, con quién y cuándo. Sirve para saber qué pasó; nadie lo puede borrar.
      </p>

      <div className="registro-filtros">
        <label className="campo">
          Desde
          <input type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label className="campo">
          Hasta
          <input type="date" value={hasta} min={desde} max={hoy} onChange={(e) => setHasta(e.target.value)} />
        </label>
        <label className="campo">
          Qué
          <select value={entidad} onChange={(e) => setEntidad(e.target.value)}>
            {QUE.map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <p className="mensaje-error">{error}</p>
      ) : cambios === null ? (
        <Cargando />
      ) : cambios.length === 0 ? (
        <p className="vacio">No hubo cambios en esas fechas.</p>
      ) : (
        <ol className="registro-lista">
          {cambios.map((c) => {
            const campos = Object.keys(c.despues ?? {})
            return (
              <li key={c.id}>
                <p className="registro-cuando">
                  {diaDe(c.fecha) === hoy ? 'Hoy' : fechaCortaDe(c.fecha)} · {horaDe(c.fecha)}
                </p>
                <p className="registro-que">{c.resumen}</p>
                <p className="ayuda">
                  {c.usuario ? `${c.usuario.nombre} ${c.usuario.apellido} (${NOMBRE_ROL[c.usuario.rol]})` : 'Sistema'}
                </p>
                {campos.length > 0 && (
                  <details className="registro-detalle">
                    <summary>Ver qué decía antes</summary>
                    <dl>
                      {campos.map((k) => (
                        <div key={k}>
                          <dt>{CAMPOS[k] ?? k}</dt>
                          <dd>
                            <s>{valor(c.antes?.[k])}</s> → {valor(c.despues?.[k])}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
