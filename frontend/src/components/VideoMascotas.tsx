import { useState } from 'react'

// Video de mascotas descansando. Mientras carga se ve una imagen del mismo video.
// Si la persona pidió reducir el movimiento en su dispositivo, queda solo la imagen.
export function VideoMascotas() {
  const [reducirMovimiento] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  if (reducirMovimiento) {
    return <img className="video-mascotas" src="/videos/portada-poster.jpg" alt="" />
  }

  return (
    <video
      className="video-mascotas"
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
