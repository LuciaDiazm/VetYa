import { useState } from 'react'
import { edadTexto, ESPECIES, fechaDesdeEdad } from '../lib/mascotas'
import { type DatosMascota } from '../lib/formularios'
import type { EspecieMascota } from '../types'

// Fecha de hoy para no permitir nacimientos en el futuro.
const HOY = new Date().toISOString().slice(0, 10)

function Botones<T extends string>({
  titulo,
  opciones,
  valor,
  cambiar,
}: {
  titulo: string
  opciones: [T, string][]
  valor: T
  cambiar: (v: T) => void
}) {
  return (
    <fieldset className="grupo-filtro">
      <legend>{titulo}</legend>
      <div className="chips">
        {opciones.map(([v, texto]) => (
          <button
            key={v}
            type="button"
            className={`chip chip-grande${valor === v ? ' chip-activo' : ''}`}
            aria-pressed={valor === v}
            onClick={() => cambiar(v)}
          >
            {texto}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

// Campos de una mascota. Si el dueño no sabe la fecha de nacimiento, se carga la edad aproximada en años.
export function CamposMascota({ datos, cambiar }: { datos: DatosMascota; cambiar: (d: DatosMascota) => void }) {
  const [porEdad, setPorEdad] = useState(false)
  const poner = <K extends keyof DatosMascota>(clave: K, valor: DatosMascota[K]) => cambiar({ ...datos, [clave]: valor })
  const edad = edadTexto(datos.fechaNacimiento || null)

  return (
    <>
      <label className="campo">
        Nombre de la mascota
        <input value={datos.nombre} onChange={(e) => poner('nombre', e.target.value)} required />
      </label>
      <Botones
        titulo="Es un"
        opciones={Object.entries(ESPECIES) as [EspecieMascota, string][]}
        valor={datos.especie}
        cambiar={(v) => poner('especie', v)}
      />
      {datos.especie === 'OTRO' && (
        <label className="campo">
          ¿Qué animal es?
          <input
            value={datos.otraEspecie}
            onChange={(e) => poner('otraEspecie', e.target.value)}
            required
            maxLength={60}
            placeholder="Ej.: conejo, tortuga, hurón"
          />
        </label>
      )}
      <Botones
        titulo="Sexo"
        opciones={[['MACHO', 'Macho'], ['HEMBRA', 'Hembra']]}
        valor={datos.sexo}
        cambiar={(v) => poner('sexo', v)}
      />
      <div className="fila-campos">
        <label className="campo">
          Raza (opcional)
          <input value={datos.raza} onChange={(e) => poner('raza', e.target.value)} placeholder="Mestizo" />
        </label>
        <label className="campo">
          Color (opcional)
          <input value={datos.color} onChange={(e) => poner('color', e.target.value)} />
        </label>
      </div>

      <div className="campo">
        <span>{porEdad ? 'Edad aproximada (años)' : 'Fecha de nacimiento (opcional)'}</span>
        {porEdad ? (
          <input
            type="number"
            min={0}
            max={30}
            step={0.5}
            onChange={(e) => poner('fechaNacimiento', e.target.value ? fechaDesdeEdad(Number(e.target.value)) : '')}
          />
        ) : (
          <input
            type="date"
            value={datos.fechaNacimiento}
            max={HOY}
            onChange={(e) => poner('fechaNacimiento', e.target.value)}
          />
        )}
        <span className="ayuda">
          {edad ? `Tiene ${edad}. ` : ''}
          <button type="button" className="boton-texto enlace-chico" onClick={() => setPorEdad((p) => !p)}>
            {porEdad ? 'Prefiero poner la fecha' : 'No sé la fecha: poner edad aproximada'}
          </button>
        </span>
      </div>

      <label className="casilla casilla-grande">
        <input type="checkbox" checked={datos.castrado} onChange={(e) => poner('castrado', e.target.checked)} />
        {datos.sexo === 'HEMBRA' ? 'Está castrada' : 'Está castrado'}
      </label>

      <label className="campo">
        Observaciones (opcional)
        <textarea
          value={datos.observaciones}
          onChange={(e) => poner('observaciones', e.target.value)}
          rows={2}
          placeholder="Alergias, carácter, si muerde…"
        />
      </label>
    </>
  )
}
