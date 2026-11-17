import type { SVGProps } from 'react'

// Sirena simple (cúpula, base y un rayito), con el mismo estilo de línea que lucide-react.
export function IconoSirena({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M7 18v-5a5 5 0 0 1 10 0v5" />
      <path d="M5 18h14" />
      <path d="M12 3v2" />
    </svg>
  )
}
