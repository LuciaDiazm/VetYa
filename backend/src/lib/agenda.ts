import { prisma } from "./prisma";

// ---------------------------------------------------------------------------
// Horarios y zona horaria
//
// Las fechas se guardan en UTC. Los horarios de atención ("09:00") y lo que elige
// la gente están en hora de Argentina, que es UTC-3 todo el año (no hay horario de verano).
// ---------------------------------------------------------------------------

const DIFERENCIA_HORAS = 3; // Argentina = UTC-3
export const INTERVALO_MINUTOS = 15; // los turnos empiezan cada 15 minutos
const MINUTO = 60 * 1000;

export const ESTADOS_QUE_OCUPAN = ["PENDIENTE", "CONFIRMADO", "ATENDIDO", "AUSENTE"] as const;

// "2026-10-16" + "09:30" (hora argentina) → Date en UTC
export function aFechaUTC(fecha: string, hora: string): Date {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const [h, m] = hora.split(":").map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia, h + DIFERENCIA_HORAS, m));
}

// Date en UTC → "HH:MM" en hora argentina
export function horaArgentina(fecha: Date): string {
  const local = new Date(fecha.getTime() - DIFERENCIA_HORAS * 3600 * 1000);
  return `${String(local.getUTCHours()).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")}`;
}

// Date → "AAAA-MM-DD" del día en Argentina
export function diaArgentina(fecha: Date): string {
  return new Date(fecha.getTime() - DIFERENCIA_HORAS * 3600 * 1000).toISOString().slice(0, 10);
}

export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function diaDeLaSemana(fecha: string): number {
  return new Date(`${fecha}T12:00:00.000Z`).getUTCDay(); // 0 = domingo
}

function aMinutos(hora: string) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

function deMinutos(minutos: number) {
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

export function esFechaValida(fecha: unknown): fecha is string {
  return typeof fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fecha) && !Number.isNaN(Date.parse(fecha));
}

export function esHoraValida(hora: unknown): hora is string {
  return typeof hora === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(hora);
}

// ---------------------------------------------------------------------------
// Disponibilidad
// ---------------------------------------------------------------------------

interface Opciones {
  // Anticipación mínima para sacar un turno (los turnos online no se pueden pedir "para ya").
  anticipacionMinutos?: number;
  // Turno que se ignora al buscar superposiciones (para reprogramar).
  ignorarTurnoId?: number;
}

// Horarios libres ("HH:MM") de varios días seguidos para un servicio. Hace pocas consultas a la base:
// trae de una vez los horarios, los días bloqueados y los turnos del período.
export async function horariosLibres(
  clinicaId: number,
  servicioId: number,
  desde: string,
  cantidadDias: number,
  opciones: Opciones = {},
): Promise<Record<string, string[]>> {
  const grilla = await grillaHorarios(clinicaId, servicioId, desde, cantidadDias, opciones);
  return Object.fromEntries(
    Object.entries(grilla).map(([fecha, horas]) => [fecha, horas.filter((h) => h.libre).map((h) => h.hora)]),
  );
}

// Todos los horarios de atención de varios días, marcando cuáles están libres y cuáles ocupados.
// Los que ya pasaron (o quedan antes de la anticipación mínima) no se incluyen.
export async function grillaHorarios(
  clinicaId: number,
  servicioId: number,
  desde: string,
  cantidadDias: number,
  opciones: Opciones = {},
): Promise<Record<string, { hora: string; libre: boolean }[]>> {
  const servicio = await prisma.servicio.findFirst({ where: { id: servicioId, clinicaId, activo: true } });
  if (!servicio) return {};

  const hasta = sumarDias(desde, cantidadDias);
  const [franjas, bloqueados, turnos] = await Promise.all([
    prisma.horarioAtencion.findMany({ where: { clinicaId } }),
    prisma.diaBloqueado.findMany({
      where: { clinicaId, fecha: { gte: new Date(`${desde}T00:00:00.000Z`), lt: new Date(`${hasta}T00:00:00.000Z`) } },
    }),
    prisma.turno.findMany({
      where: {
        clinicaId,
        estado: { in: [...ESTADOS_QUE_OCUPAN] },
        fechaHoraInicio: { lt: aFechaUTC(hasta, "00:00") },
        fechaHoraFin: { gt: aFechaUTC(desde, "00:00") },
        ...(opciones.ignorarTurnoId ? { NOT: { id: opciones.ignorarTurnoId } } : {}),
      },
      select: { fechaHoraInicio: true, fechaHoraFin: true },
    }),
  ]);

  const diasDelServicio = servicio.diasSemana ? servicio.diasSemana.split(",").map(Number) : null;
  const diasBloqueados = new Set(bloqueados.map((b) => b.fecha.toISOString().slice(0, 10)));
  const limite = new Date(Date.now() + (opciones.anticipacionMinutos ?? 0) * MINUTO);
  const resultado: Record<string, { hora: string; libre: boolean }[]> = {};

  for (let i = 0; i < cantidadDias; i++) {
    const fecha = sumarDias(desde, i);
    resultado[fecha] = [];
    if (diasBloqueados.has(fecha)) continue;

    // Si el servicio tiene días propios (por ejemplo, peluquería solo martes y jueves), los demás días no se ofrece.
    if (diasDelServicio && !diasDelServicio.includes(diaDeLaSemana(fecha))) continue;

    const franjasDelDia = franjas
      .filter((f) => f.diaSemana === diaDeLaSemana(fecha))
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));

    for (const franja of franjasDelDia) {
      // El horario propio del servicio recorta el de la clínica (nunca lo agranda).
      const desde = Math.max(aMinutos(franja.horaInicio), servicio.horaDesde ? aMinutos(servicio.horaDesde) : 0);
      const fin = Math.min(aMinutos(franja.horaFin), servicio.horaHasta ? aMinutos(servicio.horaHasta) : 24 * 60);
      for (let inicio = desde; inicio + servicio.duracionMin <= fin; inicio += INTERVALO_MINUTOS) {
        const hora = deMinutos(inicio);
        const comienzo = aFechaUTC(fecha, hora);
        const final = new Date(comienzo.getTime() + servicio.duracionMin * MINUTO);
        if (comienzo < limite) continue;
        // Se superpone si empieza antes de que termine otro y termina después de que el otro empezó.
        const ocupado = turnos.some((t) => comienzo < t.fechaHoraFin && final > t.fechaHoraInicio);
        resultado[fecha].push({ hora, libre: !ocupado });
      }
    }
  }
  return resultado;
}

// Verifica que un turno se pueda dar en ese día y horario. Devuelve el motivo si no se puede.
export async function validarHorario(
  clinicaId: number,
  servicioId: number,
  fecha: string,
  hora: string,
  opciones: Opciones & { sobreturno?: boolean } = {},
): Promise<string | null> {
  if (opciones.sobreturno) {
    // Un sobreturno lo agrega el personal a propósito: solo se exige que sea en un día de atención.
    const bloqueado = await prisma.diaBloqueado.findFirst({
      where: { clinicaId, fecha: new Date(`${fecha}T00:00:00.000Z`) },
    });
    return bloqueado ? "Ese día la clínica no atiende" : null;
  }
  const libres = await horariosLibres(clinicaId, servicioId, fecha, 1, opciones);
  if (libres[fecha]?.includes(hora)) return null;
  return "Ese horario ya no está disponible. Elegí otro, por favor.";
}
