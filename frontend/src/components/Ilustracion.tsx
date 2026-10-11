// Ilustración propia de VetYa: un perro con pañuelo de cruz médica y un gato.
// Los colores coinciden con los de la guía visual (docs/02-guia-visual.md).

const TINTA = '#1D3046'
const AMARILLO = '#FFD15C'
const AMARILLO_OSCURO = '#F2A93B'
const CREMA = '#FFF1C9'
const CELESTE = '#7CC6EA'
const GRIS_GATO = '#DCE8F1'
const ROSA = '#F28B9B'

export function IlustracionMascotas({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 320 300"
      role="img"
      aria-label="Un perro y un gato, pacientes de la clínica"
      stroke={TINTA}
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Sombras en el piso */}
      <ellipse cx="130" cy="284" rx="70" ry="9" fill="#D6EEF9" stroke="none" />
      <ellipse cx="244" cy="286" rx="46" ry="7" fill="#D6EEF9" stroke="none" />

      {/* ---------- Perro ---------- */}
      {/* Cola */}
      <path d="M182 236 C214 230 222 196 208 178" fill="none" strokeWidth="17" />
      <path d="M182 236 C214 230 222 196 208 178" fill="none" stroke={AMARILLO} strokeWidth="9" />

      {/* Cuerpo y panza */}
      <ellipse cx="130" cy="218" rx="58" ry="60" fill={AMARILLO} />
      <ellipse cx="130" cy="232" rx="32" ry="38" fill={CREMA} stroke="none" />

      {/* Patas delanteras */}
      <rect x="98" y="236" width="28" height="48" rx="14" fill={AMARILLO} />
      <rect x="134" y="236" width="28" height="48" rx="14" fill={AMARILLO} />
      <path d="M108 276 v6 M116 276 v6 M144 276 v6 M152 276 v6" strokeWidth="2.5" />

      {/* Pañuelo celeste con cruz médica */}
      <path d="M90 166 Q130 184 170 166 L130 214 Z" fill={CELESTE} />
      <rect x="126" y="178" width="8" height="20" rx="2" fill="#FFFFFF" stroke="none" />
      <rect x="120" y="184" width="20" height="8" rx="2" fill="#FFFFFF" stroke="none" />

      {/* Cabeza */}
      <ellipse cx="130" cy="118" rx="54" ry="50" fill={AMARILLO} />
      {/* Mancha sobre el ojo */}
      <ellipse cx="153" cy="104" rx="17" ry="13" fill={AMARILLO_OSCURO} stroke="none" />
      {/* Orejas caídas */}
      <path d="M84 92 C58 96 52 150 72 160 C88 166 94 128 94 108 Z" fill={AMARILLO_OSCURO} />
      <path d="M176 92 C202 96 208 150 188 160 C172 166 166 128 166 108 Z" fill={AMARILLO_OSCURO} />

      {/* Ojos */}
      <circle cx="110" cy="112" r="7" fill={TINTA} stroke="none" />
      <circle cx="150" cy="112" r="7" fill={TINTA} stroke="none" />
      <circle cx="112.5" cy="109" r="2.4" fill="#FFFFFF" stroke="none" />
      <circle cx="152.5" cy="109" r="2.4" fill="#FFFFFF" stroke="none" />

      {/* Cachetes */}
      <ellipse cx="98" cy="136" rx="8" ry="5" fill="#F7B7A3" opacity="0.7" stroke="none" />
      <ellipse cx="162" cy="136" rx="8" ry="5" fill="#F7B7A3" opacity="0.7" stroke="none" />

      {/* Hocico, nariz, boca y lengua */}
      <ellipse cx="130" cy="140" rx="26" ry="19" fill={CREMA} strokeWidth="3" />
      <path d="M124 148 Q130 162 136 148 Z" fill={ROSA} strokeWidth="2.5" />
      <path d="M130 136 V144 M130 144 Q122 151 116 144 M130 144 Q138 151 144 144" fill="none" strokeWidth="3" />
      <ellipse cx="130" cy="130" rx="9" ry="6.5" fill={TINTA} stroke="none" />

      {/* ---------- Gato ---------- */}
      {/* Cola */}
      <path d="M268 270 C302 268 304 222 284 214" fill="none" strokeWidth="15" />
      <path d="M268 270 C302 268 304 222 284 214" fill="none" stroke={GRIS_GATO} strokeWidth="7" />

      {/* Cuerpo */}
      <ellipse cx="244" cy="240" rx="34" ry="44" fill={GRIS_GATO} />
      <ellipse cx="244" cy="250" rx="18" ry="26" fill="#FFFFFF" stroke="none" />
      <ellipse cx="232" cy="281" rx="11" ry="7" fill={GRIS_GATO} strokeWidth="3" />
      <ellipse cx="256" cy="281" rx="11" ry="7" fill={GRIS_GATO} strokeWidth="3" />

      {/* Orejas */}
      <path d="M220 170 L216 138 L240 154 Z" fill={GRIS_GATO} />
      <path d="M268 170 L272 138 L248 154 Z" fill={GRIS_GATO} />
      <path d="M222 160 L220 146 L231 154 Z" fill={ROSA} stroke="none" />
      <path d="M266 160 L268 146 L257 154 Z" fill={ROSA} stroke="none" />

      {/* Cabeza */}
      <circle cx="244" cy="180" r="31" fill={GRIS_GATO} />

      {/* Collar con medalla */}
      <path d="M220 204 Q244 216 268 204" fill="none" stroke={AMARILLO} strokeWidth="6" />
      <circle cx="244" cy="214" r="5.5" fill={AMARILLO} strokeWidth="2.5" />

      {/* Cara: ojos felices, nariz, boca y bigotes */}
      <path d="M229 179 Q234 173 239 179 M249 179 Q254 173 259 179" fill="none" strokeWidth="3" />
      <path d="M241 187 H247 L244 191 Z" fill={ROSA} strokeWidth="2" />
      <path d="M244 191 Q240 196 236 193 M244 191 Q248 196 252 193" fill="none" strokeWidth="2.5" />
      <path d="M220 188 H206 M220 193 L207 197 M268 188 H282 M268 193 L281 197" fill="none" strokeWidth="2.5" />

      {/* Corazón entre los dos */}
      <path
        d="M196 64 C196 56 206 54 208 61 C210 54 220 56 220 64 C220 73 208 80 208 80 C208 80 196 73 196 64 Z"
        fill={AMARILLO}
        strokeWidth="3"
      />
    </svg>
  )
}
