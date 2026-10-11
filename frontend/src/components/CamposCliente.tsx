import { useState } from 'react'
import { type DatosCliente } from '../lib/formularios'

// Campos del dueño. Lo obligatorio va a la vista; DNI, email y dirección quedan en "Más datos".
export function CamposCliente({ datos, cambiar }: { datos: DatosCliente; cambiar: (d: DatosCliente) => void }) {
  const tieneExtras = Boolean(datos.dni || datos.email || datos.direccion)
  const [verMas, setVerMas] = useState(tieneExtras)
  const poner = (clave: keyof DatosCliente, valor: string) => cambiar({ ...datos, [clave]: valor })

  return (
    <>
      <div className="fila-campos">
        <label className="campo">
          Nombre
          <input value={datos.nombre} onChange={(e) => poner('nombre', e.target.value)} required />
        </label>
        <label className="campo">
          Apellido
          <input value={datos.apellido} onChange={(e) => poner('apellido', e.target.value)} required />
        </label>
      </div>
      <label className="campo">
        Teléfono con WhatsApp
        <input
          type="tel"
          value={datos.telefono}
          onChange={(e) => poner('telefono', e.target.value)}
          required
          placeholder="3777 123456"
        />
        <span className="ayuda">Con código de área, por ejemplo 3777 123456. Es por donde le llegan los recordatorios.</span>
      </label>

      {verMas ? (
        <>
          <div className="fila-campos">
            <label className="campo">
              DNI (opcional)
              <input value={datos.dni} onChange={(e) => poner('dni', e.target.value)} inputMode="numeric" />
            </label>
            <label className="campo">
              Email (opcional)
              <input type="email" value={datos.email} onChange={(e) => poner('email', e.target.value)} />
            </label>
          </div>
          <label className="campo">
            Dirección (opcional)
            <input value={datos.direccion} onChange={(e) => poner('direccion', e.target.value)} />
          </label>
        </>
      ) : (
        <button type="button" className="boton-texto enlace-chico" onClick={() => setVerMas(true)}>
          + Más datos (DNI, email, dirección)
        </button>
      )}
    </>
  )
}
