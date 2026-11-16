// Logo de VetYa: un perro y un gato dibujados con una línea.
// El dibujo (public/logo.png) se usa como máscara, así toma el color del texto:
// azul en el encabezado y blanco en el pie.

export function Logo() {
  return (
    <span className="logo">
      <span className="logo-marca" aria-hidden="true" />
      <span className="logo-texto">VetYa</span>
    </span>
  )
}
