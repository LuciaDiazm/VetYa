import type { SVGProps } from 'react'

// Diente de línea, con el mismo estilo que los íconos de lucide-react (que no trae uno).
export function IconoDiente({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M7 3c-2 0-3.5 1.6-3.5 4 0 2.5 1.3 3.6 1.7 6.2.4 2.8.8 7.8 2.8 7.8 1.6 0 1.3-5 3-5h2c1.7 0 1.4 5 3 5 2 0 2.4-5 2.8-7.8.4-2.6 1.7-3.7 1.7-6.2 0-2.4-1.5-4-3.5-4-2 0-2.5 1-5 1s-3-1-5-1z" />
    </svg>
  )
}
