import { Trash2 } from 'lucide-react'
import { diaLargoConAnio, hoyArgentina } from '../lib/fechas'
import { PLAZOS, productosPara, sumarMeses } from '../lib/sanitario'
import type { EspecieMascota } from '../types'

export interface DatosAplicacion {
  tipo: 'VACUNA' | 'DESPARASITACION'
  producto: string
  lote: string
  fechaProximaDosis: string // "AAAA-MM-DD" o vacío (sin refuerzo)
}

// Una vacuna o desparasitación aplicada: tipo, producto (con sugerencias) y cuándo toca la próxima.
// "desde" es la fecha de aplicación, para calcular la próxima dosis.
export function FilaAplicacion({
  datos,
  cambiar,
  quitar,
  especie,
  desde = hoyArgentina(),
}: {
  datos: DatosAplicacion
  cambiar: (d: DatosAplicacion) => void
  quitar?: () => void
  especie: EspecieMascota
  desde?: string
}) {
  const sugeridos = productosPara(especie, datos.tipo)
  const idLista = `productos-${datos.tipo}-${especie}`

  function elegirProducto(nombre: string) {
    const sugerido = sugeridos.find((p) => p.nombre.toLowerCase() === nombre.toLowerCase())
    cambiar({
      ...datos,
      producto: nombre,
      // Al elegir un producto conocido, se propone la fecha del próximo refuerzo.
      fechaProximaDosis: sugerido?.meses ? sumarMeses(desde, sugerido.meses) : datos.fechaProximaDosis,
    })
  }

  return (
    <div className="fila-aplicacion">
      <div className="fila-aplicacion-cabecera">
        <div className="chips">
          {(
            [
              ['VACUNA', 'Vacuna'],
              ['DESPARASITACION', 'Desparasitación'],
            ] as const
          ).map(([v, t]) => (
            <button
              key={v}
              type="button"
              className={`chip${datos.tipo === v ? ' chip-activo' : ''}`}
              aria-pressed={datos.tipo === v}
              // La vacuna se repite una vez al año: si no se carga la fecha, el aviso al dueño no sale.
              onClick={() => cambiar({ ...datos, tipo: v, producto: '', fechaProximaDosis: v === 'VACUNA' ? sumarMeses(desde, 12) : '' })}
            >
              {t}
            </button>
          ))}
        </div>
        {quitar && (
          <button type="button" className="boton-texto texto-peligro" onClick={quitar} aria-label="Quitar">
            <Trash2 size={18} aria-hidden="true" /> Quitar
          </button>
        )}
      </div>

      <div className="fila-campos">
        <label className="campo">
          {datos.tipo === 'VACUNA' ? '¿Qué vacuna?' : '¿Qué producto?'}
          <input
            list={idLista}
            value={datos.producto}
            onChange={(e) => elegirProducto(e.target.value)}
            required
            placeholder={sugeridos[0]?.nombre}
          />
          <datalist id={idLista}>
            {sugeridos.map((p) => (
              <option key={p.nombre} value={p.nombre} />
            ))}
          </datalist>
        </label>
        <label className="campo">
          Lote (opcional)
          <input value={datos.lote} onChange={(e) => cambiar({ ...datos, lote: e.target.value })} />
        </label>
      </div>

      <fieldset className="grupo-filtro">
        <legend>Próxima dosis</legend>
        <div className="chips">
          {PLAZOS.map((p) => {
            const fecha = sumarMeses(desde, p.meses)
            return (
              <button
                key={p.meses}
                type="button"
                className={`chip${datos.fechaProximaDosis === fecha ? ' chip-activo' : ''}`}
                aria-pressed={datos.fechaProximaDosis === fecha}
                onClick={() => cambiar({ ...datos, fechaProximaDosis: fecha })}
              >
                {p.texto}
              </button>
            )
          })}
          <button
            type="button"
            className={`chip${datos.fechaProximaDosis === '' ? ' chip-activo' : ''}`}
            aria-pressed={datos.fechaProximaDosis === ''}
            onClick={() => cambiar({ ...datos, fechaProximaDosis: '' })}
          >
            No lleva
          </button>
        </div>
        <label className="campo campo-fecha campo-en-linea">
          <span>Otra fecha:</span>
          <input
            type="date"
            value={datos.fechaProximaDosis}
            min={desde}
            onChange={(e) => cambiar({ ...datos, fechaProximaDosis: e.target.value })}
          />
        </label>
        {datos.fechaProximaDosis ? (
          <p className="ayuda">Le vamos a avisar al dueño antes del {diaLargoConAnio(datos.fechaProximaDosis)}.</p>
        ) : (
          datos.tipo === 'VACUNA' && (
            <p className="aviso-sin-fecha">Sin fecha no le vamos a avisar al dueño cuando le toque el refuerzo.</p>
          )
        )}
      </fieldset>
    </div>
  )
}
