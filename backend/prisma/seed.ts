// Datos de prueba para desarrollo y para la demo.
// Se ejecuta con: npm run db:seed
//
// Usuarios de prueba (solo para desarrollo, no usar en producción):
//   admin@vetya.test        / vetya-admin-2026   (ADMIN)
//   veterinario@vetya.test  / vetya-vet-2026     (VETERINARIO)

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const existente = await prisma.clinica.findUnique({ where: { id: 1 } });
  if (existente) {
    console.log("La base ya tiene datos de prueba. No se cargó nada.");
    return;
  }

  // Clínica ficticia ubicada en el centro de Goya.
  const clinica = await prisma.clinica.create({
    data: {
      nombre: "Clínica Veterinaria VetYa",
      direccion: "Colón 800, Goya, Corrientes",
      telefono: "3777 000000",
      whatsapp: "5493777000000",
      email: "contacto@vetya.test",
      latitud: -29.1435,
      longitud: -59.2643,
      horasCancelacion: 24,
    },
  });

  // Horario cortado típico de Goya: mañana y tarde de lunes a viernes, sábado a la mañana.
  const franjas = [];
  for (let dia = 1; dia <= 5; dia++) {
    franjas.push({ clinicaId: clinica.id, diaSemana: dia, horaInicio: "09:00", horaFin: "12:30" });
    franjas.push({ clinicaId: clinica.id, diaSemana: dia, horaInicio: "17:00", horaFin: "20:30" });
  }
  franjas.push({ clinicaId: clinica.id, diaSemana: 6, horaInicio: "09:00", horaFin: "12:30" });
  await prisma.horarioAtencion.createMany({ data: franjas });

  await prisma.servicio.createMany({
    data: [
      { clinicaId: clinica.id, nombre: "Consulta y control", categoria: "CLINICA", duracionMin: 20, descripcion: "Examen físico general, orientación diagnóstica y controles de rutina." },
      { clinicaId: clinica.id, nombre: "Vacunación", categoria: "CLINICA", duracionMin: 15, descripcion: "Plan de vacunación para perros y gatos, con registro en el carnet digital." },
      { clinicaId: clinica.id, nombre: "Desparasitación", categoria: "CLINICA", duracionMin: 15, descripcion: "Desparasitación interna y externa." },
      { clinicaId: clinica.id, nombre: "Análisis de sangre y orina", categoria: "DIAGNOSTICO", duracionMin: 20, descripcion: "Extracción de muestras para análisis clínicos." },
      { clinicaId: clinica.id, nombre: "Ecografía", categoria: "DIAGNOSTICO", duracionMin: 30, descripcion: "Estudio por imágenes para detectar problemas a tiempo." },
      { clinicaId: clinica.id, nombre: "Castración / esterilización", categoria: "CIRUGIA", duracionMin: 120, reservableOnline: false, descripcion: "Cirugía programada. Se coordina con la clínica." },
      { clinicaId: clinica.id, nombre: "Limpieza dental", categoria: "CIRUGIA", duracionMin: 60, reservableOnline: false, descripcion: "Eliminación de sarro y placa bacteriana." },
      { clinicaId: clinica.id, nombre: "Baño y peluquería", categoria: "ESTETICA", duracionMin: 90, descripcion: "Baño, secado, limpieza de oídos, corte de uñas y peinado." },
    ],
  });

  await prisma.preguntaFrecuente.createMany({
    data: [
      { clinicaId: clinica.id, orden: 1, pregunta: "¿Atienden urgencias?", respuesta: "Sí. Ante una urgencia comunicate directamente por teléfono o WhatsApp antes de venir." },
      { clinicaId: clinica.id, orden: 2, pregunta: "¿Necesito crear una cuenta para sacar turno?", respuesta: "No. Podés sacar turno solo con tu nombre, tu teléfono y los datos de tu mascota." },
      { clinicaId: clinica.id, orden: 3, pregunta: "¿Cada cuánto hay que vacunar a mi mascota?", respuesta: "Depende de la edad y la vacuna. En general los refuerzos son anuales; te avisamos por WhatsApp cuando le toca." },
      { clinicaId: clinica.id, orden: 4, pregunta: "¿Qué tengo que hacer antes de una castración?", respuesta: "La mascota debe venir con 8 a 12 horas de ayuno. Te damos las indicaciones al confirmar el turno." },
      { clinicaId: clinica.id, orden: 5, pregunta: "¿Puedo cancelar un turno?", respuesta: "Sí, con al menos 24 horas de anticipación desde la web o por WhatsApp." },
    ],
  });

  const admin = await prisma.usuario.create({
    data: {
      clinicaId: clinica.id,
      nombre: "Admin",
      apellido: "VetYa",
      email: "admin@vetya.test",
      passwordHash: await bcrypt.hash("vetya-admin-2026", 10),
      rol: "ADMIN",
    },
  });

  const vet = await prisma.usuario.create({
    data: {
      clinicaId: clinica.id,
      nombre: "Laura",
      apellido: "Gómez",
      email: "veterinario@vetya.test",
      passwordHash: await bcrypt.hash("vetya-vet-2026", 10),
      rol: "VETERINARIO",
    },
  });

  // Un cliente sin cuenta, con una mascota y una vacuna por vencer, para probar los recordatorios.
  const cliente = await prisma.cliente.create({
    data: {
      clinicaId: clinica.id,
      nombre: "Juan",
      apellido: "Pérez",
      telefono: "5493777111111",
      mascotas: {
        create: { nombre: "Firulais", especie: "PERRO", sexo: "MACHO", raza: "Mestizo", castrado: true },
      },
    },
    include: { mascotas: true },
  });

  const haceUnAnio = new Date();
  haceUnAnio.setFullYear(haceUnAnio.getFullYear() - 1);
  const enCincoDias = new Date();
  enCincoDias.setDate(enCincoDias.getDate() + 5);

  await prisma.consulta.create({
    data: {
      mascotaId: cliente.mascotas[0].id,
      veterinarioId: vet.id,
      fecha: haceUnAnio,
      motivo: "Control anual y vacunación",
      pesoKg: 18.5,
      diagnostico: "Buen estado general",
      aplicaciones: {
        create: {
          mascotaId: cliente.mascotas[0].id,
          tipo: "VACUNA",
          producto: "Antirrábica",
          fechaAplicacion: haceUnAnio,
          fechaProximaDosis: enCincoDias,
        },
      },
    },
  });

  console.log(`Datos de prueba cargados. Admin: ${admin.email}, veterinario: ${vet.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
