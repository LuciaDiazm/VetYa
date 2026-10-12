import { useId, useState } from 'react'

export interface Dato {
  etiqueta: string
  valor: number
  // Texto completo para el detalle y los lectores de pantalla (ej. "semana del 6 de octubre").
  detalle?: string
}

const NUMERO = new Intl.NumberFormat('es-AR')

// Tabla con los mismos datos del gráfico: ningún valor depende de pasar el mouse.
function TablaDeDatos({ datos, columna, unidad }: { datos: Dato[]; columna: string; unidad: string }) {
  const [abierta, setAbierta] = useState(false)
  const id = useId()
  return (
    <div className="grafico-tabla">
      <button type="button" className="boton-texto enlace-chico" aria-expanded={abierta} aria-controls={id} onClick={() => setAbierta((a) => !a)}>
        {abierta ? 'Ocultar tabla' : 'Ver como tabla'}
      </button>
      {abierta && (
        <table id={id}>
          <thead>
            <tr>
              <th scope="col">{columna}</th>
              <th scope="col">{unidad}</th>
            </tr>
          </thead>
          <tbody>
            {datos.map((d) => (
              <tr key={d.etiqueta}>
                <td>{d.detalle ?? d.etiqueta}</td>
                <td>{NUMERO.format(d.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// Columnas verticales de una sola serie. Se escribe el valor del máximo (o de todas si son pocas);
// el resto se ve al pasar el mouse o con el teclado, y en la tabla.
export function Columnas({
  datos,
  unidad,
  columna,
  resaltarMaximo = false,
  todosLosValores = false,
}: {
  datos: Dato[]
  unidad: string
  columna: string
  resaltarMaximo?: boolean
  todosLosValores?: boolean
}) {
  const maximo = Math.max(1, ...datos.map((d) => d.valor))
  const indiceMaximo = datos.findIndex((d) => d.valor === maximo)
  // Con muchas columnas, se muestra solo una de cada tantas etiquetas para que no se pisen.
  const paso = Math.ceil(datos.length / 12)

  return (
    <>
      <div className="columnas" style={{ gridTemplateColumns: `repeat(${datos.length}, minmax(0, 1fr))` }}>
        {datos.map((d, i) => {
          const esMaximo = i === indiceMaximo && d.valor > 0
          const conValor = todosLosValores || esMaximo
          return (
            <div
              key={d.etiqueta}
              className={`columna${resaltarMaximo && !esMaximo ? ' columna-apagada' : ''}`}
              tabIndex={0}
              aria-label={`${d.detalle ?? d.etiqueta}: ${NUMERO.format(d.valor)} ${unidad}`}
            >
              <div className="columna-area">
                <span className="columna-barra" style={{ height: `${(d.valor / maximo) * 100}%` }}>
                  {conValor && <span className="columna-valor">{NUMERO.format(d.valor)}</span>}
                </span>
              </div>
              <span className="columna-etiqueta" aria-hidden="true">
                {i % paso === 0 ? d.etiqueta : ''}
              </span>
              <span className="grafico-detalle" role="tooltip">
                <strong>{NUMERO.format(d.valor)}</strong> {unidad}
                <span>{d.detalle ?? d.etiqueta}</span>
              </span>
            </div>
          )
        })}
      </div>
      <TablaDeDatos datos={datos} columna={columna} unidad={unidad} />
    </>
  )
}

// Barras horizontales (para nombres largos, como los servicios), con el valor en la punta.
export function Barras({ datos, unidad, columna }: { datos: Dato[]; unidad: string; columna: string }) {
  const maximo = Math.max(1, ...datos.map((d) => d.valor))
  return (
    <>
      <ul className="barras">
        {datos.map((d) => (
          <li key={d.etiqueta}>
            <span className="barra-nombre">{d.etiqueta}</span>
            <span className="barra-pista">
              <span className="barra-relleno" style={{ width: `${(d.valor / maximo) * 100}%` }} />
              <span className="barra-valor">{NUMERO.format(d.valor)}</span>
            </span>
          </li>
        ))}
      </ul>
      <TablaDeDatos datos={datos} columna={columna} unidad={unidad} />
    </>
  )
}
