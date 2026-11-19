import { useState, type FormEvent } from 'react'
import { apiPut } from '../lib/api'
import type { ConsultaResumen } from '../types'

const aTexto = (v: string | null) => (v === null ? '' : Number(v).toLocaleString('es-AR'))
// "12,5" o "12.5" → 12.5; vacío → null
function aNumero(texto: string) {
  const limpio = texto.replace(',', '.').trim()
  return limpio === '' ? null : Number(limpio)
}

// Corregir una consulta ya guardada. Lo que había antes queda en el registro de cambios.
export function CorregirConsulta({
  consulta,
  alTerminar,
}: {
  consulta: ConsultaResumen
  alTerminar: (guardada: boolean) => void
}) {
  const [motivo, setMotivo] = useState(consulta.motivo)
  const [peso, setPeso] = useState(aTexto(consulta.pesoKg))
  const [temperatura, setTemperatura] = useState(aTexto(consulta.temperatura))
  const [diagnostico, setDiagnostico] = useState(consulta.diagnostico ?? '')
  const [tratamiento, setTratamiento] = useState(consulta.tratamiento ?? '')
  const [observaciones, setObservaciones] = useState(consulta.observaciones ?? '')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  async function guardar(e: FormEvent) {
    e.preventDefault()
    const pesoKg = aNumero(peso)
    const temp = aNumero(temperatura)
    if ((pesoKg !== null && Number.isNaN(pesoKg)) || (temp !== null && Number.isNaN(temp))) {
      setError('El peso y la temperatura tienen que ser números (por ejemplo 12,5)')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      await apiPut(`/consultas/${consulta.id}`, {
        motivo,
        pesoKg,
        temperatura: temp,
        diagnostico: diagnostico || undefined,
        tratamiento: tratamiento || undefined,
        observaciones: observaciones || undefined,
      })
      alTerminar(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la corrección')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form className="formulario subformulario" onSubmit={guardar} aria-label="Corregir consulta">
      <label className="campo">
        Motivo
        <input value={motivo} onChange={(e) => setMotivo(e.target.value)} required />
      </label>
      <div className="fila-campos">
        <label className="campo">
          Peso (kg)
          <input value={peso} onChange={(e) => setPeso(e.target.value)} inputMode="decimal" />
        </label>
        <label className="campo">
          Temperatura (°C)
          <input value={temperatura} onChange={(e) => setTemperatura(e.target.value)} inputMode="decimal" />
        </label>
      </div>
      <label className="campo">
        Diagnóstico
        <textarea value={diagnostico} onChange={(e) => setDiagnostico(e.target.value)} rows={2} />
      </label>
      <label className="campo">
        Tratamiento
        <textarea value={tratamiento} onChange={(e) => setTratamiento(e.target.value)} rows={2} />
      </label>
      <label className="campo">
        Observaciones
        <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} />
      </label>
      <p className="ayuda">Queda anotado quién la corrigió y qué decía antes.</p>
      {error && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}
      <div className="formulario-botones">
        <button type="submit" className="boton" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar corrección'}
        </button>
        <button type="button" className="boton-texto" onClick={() => alTerminar(false)}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
