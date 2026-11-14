import { ArrowLeft, Plus } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { FilaAplicacion, type DatosAplicacion } from '../../components/FilaAplicacion'
import { apiGet, apiPost } from '../../lib/api'
import { fechaCortaDe } from '../../lib/fechas'
import { edadTexto, ESPECIES } from '../../lib/mascotas'
import { vacunaNueva } from '../../lib/sanitario'
import type { FichaMascota } from '../../types'


// "12,5" o "12.5" → 12.5; vacío → null
function aNumero(texto: string) {
  const limpio = texto.replace(',', '.').trim()
  return limpio === '' ? null : Number(limpio)
}

// Cargar una consulta en la historia clínica. Si viene de un turno, al guardar el turno queda atendido.
export function NuevaConsulta() {
  const { id } = useParams()
  const [parametros] = useSearchParams()
  const turnoId = parametros.get('turno') ? Number(parametros.get('turno')) : undefined
  const navegar = useNavigate()

  const [mascota, setMascota] = useState<FichaMascota | null>(null)
  const [motivo, setMotivo] = useState('')
  const [peso, setPeso] = useState('')
  const [temperatura, setTemperatura] = useState('')
  const [diagnostico, setDiagnostico] = useState('')
  const [tratamiento, setTratamiento] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [aplicaciones, setAplicaciones] = useState<DatosAplicacion[]>([])
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    apiGet<FichaMascota>(`/mascotas/${id}`).then((m) => {
      setMascota(m)
      // Si viene de un turno, el motivo arranca con el servicio y lo que escribió el dueño.
      const turno = m.turnos.find((t) => t.id === turnoId)
      if (turno) setMotivo(turno.servicio.nombre)
    })
  }, [id, turnoId])

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const pesoKg = aNumero(peso)
    const temp = aNumero(temperatura)
    if ((pesoKg !== null && Number.isNaN(pesoKg)) || (temp !== null && Number.isNaN(temp))) {
      setError('El peso y la temperatura tienen que ser números (por ejemplo 12,5)')
      return
    }
    setGuardando(true)
    try {
      await apiPost('/consultas', {
        mascotaId: Number(id),
        turnoId,
        motivo,
        pesoKg,
        temperatura: temp,
        diagnostico: diagnostico || undefined,
        tratamiento: tratamiento || undefined,
        observaciones: observaciones || undefined,
        aplicaciones: aplicaciones.map((a) => ({
          tipo: a.tipo,
          producto: a.producto,
          lote: a.lote || undefined,
          fechaProximaDosis: a.fechaProximaDosis || undefined,
        })),
      })
      navegar(`/panel/mascotas/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la consulta')
      setGuardando(false)
    }
  }

  if (!mascota) return <p className="cargando">Cargando…</p>

  const ultimoPeso = mascota.consultas.find((c) => c.pesoKg)
  const turno = mascota.turnos.find((t) => t.id === turnoId)

  return (
    <>
      <Link to={`/panel/mascotas/${mascota.id}`} className="volver">
        <ArrowLeft size={20} aria-hidden="true" /> {mascota.nombre}
      </Link>
      <div className="panel-encabezado">
        <h1>Consulta de {mascota.nombre}</h1>
        <p>
          {[ESPECIES[mascota.especie], mascota.sexo === 'HEMBRA' ? 'hembra' : 'macho', mascota.raza, edadTexto(mascota.fechaNacimiento)]
            .filter(Boolean)
            .join(', ')}
          . Dueño: {mascota.cliente.nombre} {mascota.cliente.apellido}.
        </p>
      </div>

      {mascota.observaciones && <p className="observaciones">⚠ {mascota.observaciones}</p>}
      {turno?.observaciones && <p className="aviso-pendientes">El dueño escribió al pedir el turno: “{turno.observaciones}”</p>}

      <form className="formulario formulario-animal" onSubmit={guardar}>
        <section className="tarjeta formulario">
          <label className="campo">
            Motivo de la consulta
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} required placeholder="Ej.: control anual" />
          </label>
          <div className="fila-campos">
            <label className="campo">
              Peso (kg)
              <input inputMode="decimal" value={peso} onChange={(e) => setPeso(e.target.value)} placeholder="Ej.: 12,5" />
              {ultimoPeso && (
                <span className="ayuda">
                  Último: {Number(ultimoPeso.pesoKg).toLocaleString('es-AR')} kg ({fechaCortaDe(ultimoPeso.fecha)})
                </span>
              )}
            </label>
            <label className="campo">
              Temperatura (°C)
              <input inputMode="decimal" value={temperatura} onChange={(e) => setTemperatura(e.target.value)} placeholder="Ej.: 38,5" />
            </label>
          </div>
          <label className="campo">
            Diagnóstico
            <textarea value={diagnostico} onChange={(e) => setDiagnostico(e.target.value)} rows={2} />
          </label>
          <label className="campo">
            Tratamiento e indicaciones
            <textarea value={tratamiento} onChange={(e) => setTratamiento(e.target.value)} rows={3} />
          </label>
          <label className="campo">
            Observaciones (opcional)
            <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} />
          </label>
        </section>

        <section className="tarjeta formulario">
          <h2>Vacunas y desparasitaciones de hoy</h2>
          {aplicaciones.length === 0 && <p className="vacio">No se aplicó nada en esta consulta.</p>}
          {aplicaciones.map((a, i) => (
            <FilaAplicacion
              key={i}
              datos={a}
              especie={mascota.especie}
              cambiar={(nueva) => setAplicaciones((lista) => lista.map((x, j) => (j === i ? nueva : x)))}
              quitar={() => setAplicaciones((lista) => lista.filter((_, j) => j !== i))}
            />
          ))}
          <button
            type="button"
            className="boton boton-contorno"
            onClick={() => setAplicaciones((lista) => [...lista, vacunaNueva()])}
          >
            <Plus size={20} aria-hidden="true" /> Agregar vacuna o desparasitación
          </button>
        </section>

        {error && (
          <p className="mensaje-error" role="alert">
            {error}
          </p>
        )}

        <div className="formulario-botones">
          <button type="submit" className="boton boton-grande" disabled={guardando}>
            {guardando ? 'Guardando…' : turno ? 'Guardar y marcar el turno como atendido' : 'Guardar consulta'}
          </button>
        </div>
      </form>
    </>
  )
}
