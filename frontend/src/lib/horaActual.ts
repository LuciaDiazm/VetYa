import { useEffect, useState } from 'react'
import { ZONA } from './fechas'

const HORA_ACTUAL = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: ZONA })

// Hora actual en Argentina ("HH:MM"), actualizada cada minuto. La usan la Agenda y la pantalla Hoy.
export function useHoraActual() {
  const [hora, setHora] = useState(() => HORA_ACTUAL.format(new Date()))
  useEffect(() => {
    const intervalo = window.setInterval(() => setHora(HORA_ACTUAL.format(new Date())), 60_000)
    return () => window.clearInterval(intervalo)
  }, [])
  return hora
}
