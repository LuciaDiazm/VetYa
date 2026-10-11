import type { HorarioAtencion } from '../types'

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
// Orden de la semana empezando por el lunes.
const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0]

export interface RenglonHorario {
  dias: string
  horas: string
}

// Agrupa los días consecutivos que tienen el mismo horario.
// Ej.: lunes a viernes 09:00–12:30 y 17:00–20:30 → { dias: "Lunes a viernes", horas: "9:00 a 12:30 y 17:00 a 20:30" }
export function agruparHorarios(horarios: HorarioAtencion[]): RenglonHorario[] {
  const grupos: { inicio: number; fin: number; horas: string }[] = []
  let actual: (typeof grupos)[number] | null = null

  for (const dia of ORDEN_SEMANA) {
    const horas = horarios
      .filter((h) => h.diaSemana === dia)
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
      .map((h) => `${sinCero(h.horaInicio)} a ${sinCero(h.horaFin)}`)
      .join(' y ')

    if (!horas) {
      actual = null // un día cerrado corta el grupo
    } else if (actual && actual.horas === horas) {
      actual.fin = dia
    } else {
      actual = { inicio: dia, fin: dia, horas }
      grupos.push(actual)
    }
  }

  return grupos.map((g) => ({
    dias: g.inicio === g.fin ? DIAS[g.inicio] : `${DIAS[g.inicio]} a ${DIAS[g.fin].toLowerCase()}`,
    horas: g.horas,
  }))
}

// "09:00" → "9:00"
function sinCero(hora: string) {
  return hora.replace(/^0/, '')
}
