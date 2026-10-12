import { Router } from "express";
import { z } from "zod";
import { aFechaUTC, diaArgentina, sumarDias } from "../lib/agenda";
import { requiereRol, requiereSesion } from "../lib/auth";
import { prisma } from "../lib/prisma";

// Recordatorios por WhatsApp: el sistema arma la lista de a quién avisar y el mensaje;
// la veterinaria lo envía con un toque y queda registrado para no avisar dos veces.
export const recordatoriosRouter = Router();
recordatoriosRouter.use(requiereSesion, requiereRol("VETERINARIO", "ADMIN"));

const DIAS_ANTES_DE_LA_DOSIS = 7; // se avisa desde una semana antes
const DIAS_VENCIDA_PARA_AVISAR = 30; // y hasta un mes después de vencida (después pasa a "recuperar")
const MESES_SIN_VENIR = 6;
const DIAS_ENTRE_AVISOS_DE_RECUPERO = 60;

const dueno = { select: { id: true, nombre: true, apellido: true, telefono: true } };
const mascotaConDueno = { select: { id: true, nombre: true, especie: true, cliente: dueno } };

function aFechaSinHora(fecha: string) {
  return new Date(`${fecha}T00:00:00.000Z`);
}

// Calcula las tres listas. Se usa para la pantalla de recordatorios y para el resumen de "Hoy".
async function calcularPendientes(clinicaId: number) {
  const hoy = diaArgentina(new Date());
  const manana = sumarDias(hoy, 1);

  // Mascotas con un turno pendiente o confirmado de hoy en adelante: a esas no hace falta "recuperarlas".
  const turnosFuturos = await prisma.turno.findMany({
    where: { clinicaId, estado: { in: ["PENDIENTE", "CONFIRMADO"] }, fechaHoraInicio: { gte: aFechaUTC(hoy, "00:00") } },
    select: { mascotaId: true, fechaHoraInicio: true },
  });
  const conTurno = new Set(turnosFuturos.map((t) => t.mascotaId));

  // ---------- 1. Turnos de mañana sin recordar ----------
  const turnosManana = await prisma.turno.findMany({
    where: {
      clinicaId,
      estado: { in: ["PENDIENTE", "CONFIRMADO"] },
      recordatorioEnviadoEn: null,
      fechaHoraInicio: { gte: aFechaUTC(manana, "00:00"), lt: aFechaUTC(sumarDias(manana, 1), "00:00") },
    },
    include: { mascota: mascotaConDueno, servicio: { select: { nombre: true } } },
    orderBy: { fechaHoraInicio: "asc" },
  });

  // ---------- 2. Vacunas y desparasitaciones por vencer (o vencidas hace poco) ----------
  const candidatas = await prisma.aplicacionSanitaria.findMany({
    where: {
      mascota: { activo: true, cliente: { clinicaId } },
      fechaProximaDosis: {
        gte: aFechaSinHora(sumarDias(hoy, -DIAS_VENCIDA_PARA_AVISAR)),
        lte: aFechaSinHora(sumarDias(hoy, DIAS_ANTES_DE_LA_DOSIS)),
      },
      recordatorios: { none: {} }, // a esta dosis todavía no se le avisó
    },
    include: { mascota: mascotaConDueno },
    orderBy: { fechaProximaDosis: "asc" },
  });

  // Si después se aplicó el mismo producto (el refuerzo ya se dio), esa dosis no se recuerda.
  const posteriores = await prisma.aplicacionSanitaria.findMany({
    where: { mascotaId: { in: candidatas.map((c) => c.mascotaId) } },
    select: { mascotaId: true, producto: true, fechaAplicacion: true },
  });
  const dosis = candidatas
    .filter(
      (c) =>
        !posteriores.some(
          (p) =>
            p.mascotaId === c.mascotaId &&
            p.producto.toLowerCase() === c.producto.toLowerCase() &&
            p.fechaAplicacion > c.fechaAplicacion,
        ),
    )
    .map((c) => ({ ...c, tieneTurno: conTurno.has(c.mascotaId) }));

  // ---------- 3. Clientes para recuperar ----------
  // Mascotas activas sin turno próximo que no vienen hace más de 6 meses
  // o que tienen una dosis vencida hace más de un mes.
  const limiteVisita = new Date();
  limiteVisita.setMonth(limiteVisita.getMonth() - MESES_SIN_VENIR);
  const limiteAviso = new Date(Date.now() - DIAS_ENTRE_AVISOS_DE_RECUPERO * 24 * 3600 * 1000);

  // Las que ya están en la lista de dosis por vencer tampoco: sería avisarles dos veces lo mismo.
  const yaEnDosis = dosis.map((d) => d.mascotaId);
  const mascotas = await prisma.mascota.findMany({
    where: { activo: true, cliente: { clinicaId }, id: { notIn: [...conTurno, ...yaEnDosis] } },
    select: {
      id: true,
      nombre: true,
      especie: true,
      cliente: {
        select: {
          ...dueno.select,
          creadoEn: true,
          // Si ya se le mandó un aviso de recupero hace poco, no se lo vuelve a sugerir.
          recordatorios: { where: { tipo: "RECUPERO", enviadoEn: { gte: limiteAviso } }, select: { id: true } },
        },
      },
      consultas: { orderBy: { fecha: "desc" }, take: 1, select: { fecha: true } },
      aplicaciones: { select: { producto: true, fechaAplicacion: true, fechaProximaDosis: true } },
    },
  });

  const vencidaHace = aFechaSinHora(sumarDias(hoy, -DIAS_VENCIDA_PARA_AVISAR));
  const recuperar = mascotas
    .filter((m) => m.cliente.recordatorios.length === 0)
    .map((m) => {
      const ultimaVisita = m.consultas[0]?.fecha ?? null;
      // Dosis vencidas: la última de cada producto, con la próxima ya pasada hace más de un mes.
      const ultimas = new Map<string, (typeof m.aplicaciones)[number]>();
      for (const a of m.aplicaciones) {
        const clave = a.producto.toLowerCase();
        const previa = ultimas.get(clave);
        if (!previa || a.fechaAplicacion > previa.fechaAplicacion) ultimas.set(clave, a);
      }
      const vencidas = [...ultimas.values()]
        .filter((a) => a.fechaProximaDosis && a.fechaProximaDosis < vencidaHace)
        .map((a) => a.producto);
      const sinVenir = ultimaVisita ? ultimaVisita < limiteVisita : m.cliente.creadoEn < limiteVisita;
      return { mascota: m, ultimaVisita, vencidas, sinVenir };
    })
    .filter((r) => r.sinVenir || r.vencidas.length > 0)
    .map(({ mascota: { consultas: _c, aplicaciones: _a, cliente: { recordatorios: _r, creadoEn: _cr, ...cliente }, ...mascota }, ...resto }) => ({
      ...resto,
      mascota: { ...mascota, cliente },
    }));

  return { turnosManana, dosis, recuperar };
}

recordatoriosRouter.get("/pendientes", async (req, res) => {
  res.json(await calcularPendientes(req.usuario!.clinicaId));
});

recordatoriosRouter.get("/resumen", async (req, res) => {
  const { turnosManana, dosis, recuperar } = await calcularPendientes(req.usuario!.clinicaId);
  res.json({ turnosManana: turnosManana.length, dosis: dosis.length, recuperar: recuperar.length });
});

// Registra que se envió (o se avisó por teléfono) un recordatorio.
const esquemaRecordatorio = z.object({
  tipo: z.enum(["TURNO", "VACUNA", "DESPARASITACION", "RECUPERO", "CARNET"]),
  clienteId: z.number().int(),
  turnoId: z.number().int().optional(),
  aplicacionId: z.number().int().optional(),
  mensaje: z.string().trim().min(1).max(1000),
});

recordatoriosRouter.post("/", async (req, res) => {
  const resultado = esquemaRecordatorio.safeParse(req.body);
  if (!resultado.success) {
    res.status(400).json({ error: resultado.error.issues[0].message });
    return;
  }
  const datos = resultado.data;
  const clinicaId = req.usuario!.clinicaId;

  const cliente = await prisma.cliente.findFirst({ where: { id: datos.clienteId, clinicaId } });
  if (!cliente) {
    res.status(404).json({ error: "Cliente no encontrado" });
    return;
  }

  const recordatorio = await prisma.$transaction(async (tx) => {
    if (datos.turnoId) {
      const turno = await tx.turno.findFirst({ where: { id: datos.turnoId, clinicaId } });
      if (!turno) throw new Error("Turno no encontrado");
      await tx.turno.update({ where: { id: turno.id }, data: { recordatorioEnviadoEn: new Date() } });
    }
    return tx.recordatorio.create({
      data: { ...datos, usuarioId: req.usuario!.id },
    });
  });
  res.status(201).json(recordatorio);
});

// Últimos avisos enviados, para ver qué se mandó y cuándo.
recordatoriosRouter.get("/historial", async (req, res) => {
  const historial = await prisma.recordatorio.findMany({
    where: { cliente: { clinicaId: req.usuario!.clinicaId } },
    include: {
      cliente: { select: { nombre: true, apellido: true } },
      usuario: { select: { nombre: true } },
    },
    orderBy: { enviadoEn: "desc" },
    take: 30,
  });
  res.json(historial);
});
