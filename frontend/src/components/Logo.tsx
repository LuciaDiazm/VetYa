// Logo de VetYa: una huella cuya almohadilla principal es una cruz médica.

export function LogoMarca({ tamano = 36 }: { tamano?: number }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="11" fill="#1E5A87" />
      {/* Dedos de la huella */}
      <ellipse cx="11" cy="15" rx="3.4" ry="4.2" fill="#FFD15C" />
      <ellipse cx="17.3" cy="10" rx="3.4" ry="4.2" fill="#FFD15C" />
      <ellipse cx="22.7" cy="10" rx="3.4" ry="4.2" fill="#FFD15C" />
      <ellipse cx="29" cy="15" rx="3.4" ry="4.2" fill="#FFD15C" />
      {/* Almohadilla en forma de cruz */}
      <rect x="16.5" y="17" width="7" height="17" rx="2.6" fill="#FFD15C" />
      <rect x="11.5" y="22" width="17" height="7" rx="2.6" fill="#FFD15C" />
    </svg>
  )
}

export function Logo() {
  return (
    <span className="logo">
      <LogoMarca />
      <span className="logo-texto">VetYa</span>
    </span>
  )
}
