import { useState } from 'react'

// Campo de contraseña con un botón "Mostrar" adentro, para ver lo que se escribió
// (ayuda mucho en el celular, donde es fácil equivocarse una letra).
export function CampoClave({
  etiqueta = 'Contraseña',
  valor,
  onCambiar,
  ayuda,
  nueva = false,
}: {
  etiqueta?: string
  valor: string
  onCambiar: (valor: string) => void
  ayuda?: string
  nueva?: boolean
}) {
  const [ver, setVer] = useState(false)

  return (
    <div className="campo">
      <label htmlFor={nueva ? 'clave-nueva' : 'clave'}>{etiqueta}</label>
      <span className="campo-con-boton">
        <input
          id={nueva ? 'clave-nueva' : 'clave'}
          type={ver ? 'text' : 'password'}
          value={valor}
          onChange={(e) => onCambiar(e.target.value)}
          required
          minLength={nueva ? 8 : undefined}
          autoComplete={nueva ? 'new-password' : 'current-password'}
        />
        <button type="button" className="ver-clave" onClick={() => setVer((v) => !v)} aria-pressed={ver}>
          {ver ? 'Ocultar' : 'Mostrar'}
        </button>
      </span>
      {ayuda && <span className="ayuda">{ayuda}</span>}
    </div>
  )
}
