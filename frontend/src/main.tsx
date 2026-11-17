import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Al recargar, la página arranca siempre arriba:
// - el navegador no vuelve solo a donde estaba la persona;
// - si la dirección quedó con una sección (por ejemplo "/#contacto", de un enlace del menú), se la saca.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
const navegacion = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
if (navegacion?.type === 'reload' && location.hash) {
  history.replaceState(history.state, '', location.pathname + location.search)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
