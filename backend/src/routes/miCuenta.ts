import { Router } from "express";
import { z } from "zod";
import { aFechaUTC, diaArgentina } from "../lib/agenda";
import { requiereRol, requiereSesion } from "../lib/auth";
import { tokenDeCarnet } from "../lib/carnet";
import { prisma } from "../lib/prisma";
import { urlArchivo } from "../lib/subidas";
import { cancelacionesWebRecientes, revisarAbuso, suspensionVigente } from "../lib/sanciones";
import { normalizarTelefono } from "../lib/telefono";

// "Mi cuenta" del dueño: sus mascotas, vacunas, consultas y turnos.
export const miCuentaRouter = Router();
miCuentaRouter.use(requiereSesion, requiereRol("DUENIO"));

async function clienteDelUsuario(usuarioId: number) {
  return prisma.cliente.findUnique({ where: { usuarioId } });
}

miCuentaRouter.get("/", async (req, res) => {
  const cliente = await clienteDelUsuario(req.usuario!.id);
  if (!cliente) {
    res.json({ cliente: null, mascotas: [] });
    return;
  }

  const inicioDeHoy = aFechaUTC(diaArgentina(new Date()), "00:00");
  const mascotas = await prisma.mascota.findMany({
    where: { clienteId: cliente.id, activo: true },
    orderBy: { nombre: "asc" },
    include: {
      aplicaciones: { where: { anulada: false }, orderBy: { fechaAplicacion: "desc" } },
      // Para el dueño, la historia clínica se muestra resumida: fecha, motivo e indicaciones.
      consultas: {
        orderBy: { fecha: "desc" },
        select: {
          id: true,
          fecha: true,
          motivo: true,
          tratamiento: true,
          pesoKg: true,
          veterinario: { select: { nombre: true, apellido: true } },
        },
      },
      turnos: {
        where: { estado: { in: ["PENDIENTE", "CONFIRMADO"] }, fechaHoraInicio: { gte: inicioDeHoy } },
        orderBy: { fechaHoraInicio: "asc" },
        include: { servicio: { select: { nombre: true } } },
      },
    },
  });

  const conCarnet = await Promise.all(
    mascotas.map(async ({ tokenCarnet: _t, ...m }) => ({
      ...m,
      fotoUrl: m.fotoId ? urlArchivo(m.fotoId) : null,
      carnetUrl: `/api/publico/carnet/${await tokenDeCarnet(m.id)}`,
    })),
  );

  const clinica = await prisma.clinica.findUniqueOrThrow({
    where: { id: cliente.clinicaId },
    select: { horasCancelacion: true, limiteCancelaciones: true, diasCancelaciones: true, diasSuspension: true },
  });
  res.json({
    cliente: { nombre: cliente.nombre, apellido: cliente.apellido, telefono: cliente.telefono },
    horasCancelacion: clinica.horasCancelacion,
    // Para avisarle antes de que una cancelación más lo deje sin turnos web.
    suspendidoHasta: suspensionVigente(cliente),
    cancelacionesRecientes: await cancelacionesWebRecientes(cliente.id, clinica.diasCancelaciones),
    limiteCancelaciones: clinica.limiteCancelaciones,
    diasCancelaciones: clinica.diasCancelaciones,
    diasSuspension: clinica.diasSuspension,
    mascotas: conCarnet,
  });
});

// Regla de negocio 4: el dueño puede cancelar con al menos X horas de anticipación (24 por defecto).
miCuentaRouter.patch("/turnos/:id/cancelar", async (req, res) => {
  const cliente = await clienteDelUsuario(req.usuario!.id);
  const turno = cliente
    ? await prisma.turno.findFirst({
        where: { id: Number(req.params.id), mascota: { clienteId: cliente.id } },
        include: { clinica: { select: { horasCancelacion: true } } },
      })
    : null;
  if (!turno) {
    res.status(404).json({ error: "Turno no encontrado" });
    return;
  }
  if (turno.estado !== "PENDIENTE" && turno.estado !== "CONFIRMADO") {
    res.status(400).json({ error: "Ese turno ya no se puede cancelar" });
    return;
  }
  const horasQueFaltan = (turno.fechaHoraInicio.getTime() - Date.now()) / (3600 * 1000);
  if (horasQueFaltan < turno.clinica.horasCancelacion) {
    res.status(400).json({
      error: `Falta menos de ${turno.clinica.horasCancelacion} horas: para cancelar, avisale a la clínica por WhatsApp o por teléfono.`,
    });
    return;
  }
  await prisma.turno.update({
    where: { id: turno.id },
    data: { estado: "CANCELADO", canceladoEn: new Date(), canceladoPor: "DUENIO" },
  });
  // Si viene cancelando muchos seguidos, queda suspendido para la web y la clínica ve el aviso.
  const suspendidoHasta = await revisarAbuso(cliente!.id, turno.clinicaId);
  res.json({ ok: true, suspendidoHasta });
});

// ---------------------------------------------------------------------------
// Mis datos: el dueño corrige su nombre, su teléfono y su dirección (salen en el carnet).
// El email no se cambia acá porque es con el que entra a la cuenta.
// ---------------------------------------------------------------------------

const esquemaMisDatos = z.object({
  nombre: z.string().trim().min(1, "Escribí tu nombre").max(60),
  apellido: z.string().trim().min(1, "Escribí tu apellido").max(60),
  telefono: z.string().trim().min(8, "Escribí un teléfono válido").max(30),
  direccion: z.string().trim().max(150).optional(),
});

miCuentaRouter.get("/datos", async (req, res) => {
  const cliente = await clienteDelUsuario(req.usuario!.id);
  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: req.usuario!.id }, select: { email: true } });
  res.json({
    email: usuario.email,
    cliente: cliente
      ? { nombre: cliente.nombre, apellido: cliente.apellido, telefono: cliente.telefono, direccion: cliente.direccion }
      : null,
  });
});

miCuentaRouter.put("/datos", async (req, res) => {
  const resultado = esquemaMisDatos.safeParse(req.body);
  if (!resultado.success) {
    res.status(400).json({ error: resultado.error.issues[0].message });
    return;
  }
  const cliente = await clienteDelUsuario(req.usuario!.id);
  if (!cliente) {
    res.status(404).json({ error: "Tu cuenta todavía no tiene ficha en la clínica" });
    return;
  }
  const datos = resultado.data;
  const telefono = normalizarTelefono(datos.telefono);
  // El teléfono identifica la ficha: si ya es de otro cliente, se arregla hablando con la clínica.
  const otro = await prisma.cliente.findFirst({ where: { clinicaId: cliente.clinicaId, telefono, NOT: { id: cliente.id } } });
  if (otro) {
    res.status(409).json({ error: "Ese teléfono ya está en otra ficha de la clínica. Escribinos y lo acomodamos." });
    return;
  }
  const [actualizado] = await prisma.$transaction([
    prisma.cliente.update({
      where: { id: cliente.id },
      data: { nombre: datos.nombre, apellido: datos.apellido, telefono, direccion: datos.direccion || null },
    }),
    prisma.usuario.update({
      where: { id: req.usuario!.id },
      data: { nombre: datos.nombre, apellido: datos.apellido, telefono },
    }),
  ]);
  res.json({
    nombre: actualizado.nombre,
    apellido: actualizado.apellido,
    telefono: actualizado.telefono,
    direccion: actualizado.direccion,
  });
});
