// React Router guarda en el historial del navegador cuántas pantallas se recorrieron dentro del sistema ("idx").
// Si es mayor que 0, hay una pantalla anterior a la que volver con "atrás".
export function hayPantallaAnterior() {
  const estado = window.history.state as { idx?: number } | null
  return (estado?.idx ?? 0) > 0
}
