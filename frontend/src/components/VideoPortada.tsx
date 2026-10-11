import { useState } from 'react'

// Video de fondo de la portada. Mientras carga, o si el archivo no está, se ve la foto (poster).
// Si la persona pidió reducir el movimiento en su dispositivo, no se reproduce y queda la foto.
export function VideoPortada() {
  const [reducirMovimiento] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  if (reducirMovimiento) {
    return <img className="portada-video-fondo" src="/videos/portada-poster.jpg" alt="" />
  }

  return (
    <video
      className="portada-video-fondo"
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      poster="/videos/portada-poster.jpg"
      aria-hidden="true"
    >
      <source src="/videos/portada.mp4" type="video/mp4" />
    </video>
  )
}
