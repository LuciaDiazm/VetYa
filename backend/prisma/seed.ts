// Datos de prueba para desarrollo y para la demo.
// Se ejecuta con: npm run db:seed
//
// Es incremental: completa solo lo que falta y no modifica ni borra lo que ya existe.
// Así se puede volver a correr cada vez que se agregan tablas nuevas.
//
// Usuarios de prueba (solo para desarrollo, no usar en producción):
//   admin@vetya.test        / vetya-admin-2026   (ADMIN)
//   veterinario@vetya.test  / vetya-vet-2026     (VETERINARIO)
//   martin.sosa@vetya.test  / vetya-vet-2026     (VETERINARIO)
//
// Todos los datos son ficticios: la clínica, el equipo, las opiniones y los teléfonos.
// Las fotos son de Unsplash (ver frontend/public/fotos/CREDITOS.md).

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // ---------- Clínica ficticia en el centro de Goya ----------
  const clinica =
    (await prisma.clinica.findUnique({ where: { id: 1 } })) ??
    (await prisma.clinica.create({
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
    }));
  const clinicaId = clinica.id;

  if (!clinica.telefonoUrgencias) {
    await prisma.clinica.update({
      where: { id: clinicaId },
      data: { telefonoUrgencias: "5493777000000", horarioUrgencias: "Todos los días de 8 a 22 h" },
    });
  }

  // ---------- Horario cortado típico de Goya ----------
  if ((await prisma.horarioAtencion.count({ where: { clinicaId } })) === 0) {
    const franjas = [];
    for (let dia = 1; dia <= 5; dia++) {
      franjas.push({ clinicaId, diaSemana: dia, horaInicio: "09:00", horaFin: "12:30" });
      franjas.push({ clinicaId, diaSemana: dia, horaInicio: "17:00", horaFin: "20:30" });
    }
    franjas.push({ clinicaId, diaSemana: 6, horaInicio: "09:00", horaFin: "12:30" });
    await prisma.horarioAtencion.createMany({ data: franjas });
  }

  // ---------- Servicios (se crean si faltan y se les agrega la foto) ----------
  const servicios = [
    { nombre: "Consulta y control", categoria: "CLINICA", duracionMin: 20, fotoUrl: "/fotos/gatito-control.jpg", descripcion: "Examen físico general, orientación diagnóstica y controles de rutina." },
    { nombre: "Vacunación", categoria: "CLINICA", duracionMin: 15, fotoUrl: "/fotos/vacunacion.jpg", descripcion: "Plan de vacunación para perros y gatos, con registro en el carnet digital." },
    { nombre: "Desparasitación", categoria: "CLINICA", duracionMin: 15, fotoUrl: "/fotos/cachorro.jpg", descripcion: "Desparasitación interna y externa." },
    { nombre: "Análisis de sangre y orina", categoria: "DIAGNOSTICO", duracionMin: 20, fotoUrl: "/fotos/gato-consulta.jpg", descripcion: "Extracción de muestras para análisis clínicos." },
    { nombre: "Ecografía", categoria: "DIAGNOSTICO", duracionMin: 30, fotoUrl: "/fotos/ecografia.jpg", descripcion: "Estudio por imágenes para detectar problemas a tiempo." },
    { nombre: "Castración / esterilización", categoria: "CIRUGIA", duracionMin: 120, reservableOnline: false, fotoUrl: "/fotos/cirugia.jpg", descripcion: "Cirugía programada. Se coordina con la clínica." },
    { nombre: "Limpieza dental", categoria: "CIRUGIA", duracionMin: 60, reservableOnline: false, fotoUrl: "/fotos/dental.jpg", descripcion: "Eliminación de sarro y placa bacteriana." },
    { nombre: "Baño y peluquería", categoria: "ESTETICA", duracionMin: 90, fotoUrl: "/fotos/peluqueria.jpg", descripcion: "Baño, secado, limpieza de oídos, corte de uñas y peinado." },
  ] as const;

  for (const s of servicios) {
    const existente = await prisma.servicio.findFirst({ where: { clinicaId, nombre: s.nombre } });
    if (!existente) {
      await prisma.servicio.create({ data: { clinicaId, ...s } });
    } else if (!existente.fotoUrl) {
      await prisma.servicio.update({ where: { id: existente.id }, data: { fotoUrl: s.fotoUrl } });
    }
  }

  // ---------- Preguntas frecuentes ----------
  const RESPUESTA_CUENTA = "Sí. Se crea una sola vez, con tu nombre, tu teléfono y un email. Si preferís, pedí el turno por WhatsApp.";
  // Las bases que ya tenían la respuesta anterior (cuando no hacía falta cuenta) se corrigen.
  await prisma.preguntaFrecuente.updateMany({
    where: { clinicaId, respuesta: "No. Podés sacar turno solo con tu nombre, tu teléfono y los datos de tu mascota." },
    data: { respuesta: RESPUESTA_CUENTA },
  });
  if ((await prisma.preguntaFrecuente.count({ where: { clinicaId } })) === 0) {
    await prisma.preguntaFrecuente.createMany({
      data: [
        { clinicaId, orden: 1, pregunta: "¿Atienden urgencias?", respuesta: "Sí. Ante una urgencia comunicate directamente por teléfono o WhatsApp antes de venir." },
        { clinicaId, orden: 2, pregunta: "¿Necesito crear una cuenta para sacar turno?", respuesta: RESPUESTA_CUENTA },
        { clinicaId, orden: 3, pregunta: "¿Cada cuánto hay que vacunar a mi mascota?", respuesta: "Depende de la edad y la vacuna. En general los refuerzos son anuales; te avisamos por WhatsApp cuando le toca." },
        { clinicaId, orden: 4, pregunta: "¿Qué tengo que hacer antes de una castración?", respuesta: "La mascota debe venir con 8 a 12 horas de ayuno. Te damos las indicaciones al confirmar el turno." },
        { clinicaId, orden: 5, pregunta: "¿Puedo cancelar un turno?", respuesta: "Sí, con al menos 24 horas de anticipación desde la web o por WhatsApp." },
      ],
    });
  }

  // ---------- Usuarios y equipo ----------
  await prisma.usuario.upsert({
    where: { email: "admin@vetya.test" },
    update: {},
    create: {
      clinicaId,
      nombre: "Admin",
      apellido: "VetYa",
      email: "admin@vetya.test",
      passwordHash: await bcrypt.hash("vetya-admin-2026", 10),
      rol: "ADMIN",
    },
  });

  const perfilLaura = {
    visibleEnWeb: true,
    matricula: "M.P. 0001",
    especialidad: "Clínica de pequeños animales",
    presentacion: "Me ocupo de los controles, las vacunas y el seguimiento de cada paciente desde cachorro.",
  };
  const vet = await prisma.usuario.upsert({
    where: { email: "veterinario@vetya.test" },
    update: perfilLaura,
    create: {
      clinicaId,
      nombre: "Laura",
      apellido: "Gómez",
      email: "veterinario@vetya.test",
      passwordHash: await bcrypt.hash("vetya-vet-2026", 10),
      rol: "VETERINARIO",
      ...perfilLaura,
    },
  });

  await prisma.usuario.upsert({
    where: { email: "martin.sosa@vetya.test" },
    update: {},
    create: {
      clinicaId,
      nombre: "Martín",
      apellido: "Sosa",
      email: "martin.sosa@vetya.test",
      passwordHash: await bcrypt.hash("vetya-vet-2026", 10),
      rol: "VETERINARIO",
      visibleEnWeb: true,
      matricula: "M.P. 0002",
      especialidad: "Cirugía y diagnóstico por imágenes",
      presentacion: "Realizo las cirugías programadas y las ecografías de la clínica.",
    },
  });

  // ---------- Opiniones de ejemplo (ficticias) ----------
  if ((await prisma.opinion.count({ where: { clinicaId } })) === 0) {
    await prisma.opinion.createMany({
      data: [
        { clinicaId, autor: "Carolina R.", mascota: "Lola", puntaje: 5, fecha: new Date("2026-08-14"), texto: "Me avisaron por WhatsApp que a Lola le tocaba la vacuna y saqué turno en un minuto. Muy atentos." },
        { clinicaId, autor: "Diego M.", mascota: "Tom", puntaje: 5, fecha: new Date("2026-09-02"), texto: "Castraron a Tom y nos explicaron todo antes y después. Se recuperó perfecto." },
        { clinicaId, autor: "Silvia A.", mascota: "Coco", puntaje: 4, fecha: new Date("2026-09-21"), texto: "Me gusta poder ver el carnet de vacunas desde el celular, ya no pierdo la libreta." },
      ],
    });
  }

  // ---------- Formas de pago ----------
  if ((await prisma.formaPago.count({ where: { clinicaId } })) === 0) {
    await prisma.formaPago.createMany({
      data: [
        { clinicaId, orden: 1, nombre: "Efectivo" },
        { clinicaId, orden: 2, nombre: "Transferencia bancaria", detalle: "Te pasamos el alias al confirmar el turno." },
        { clinicaId, orden: 3, nombre: "Mercado Pago", detalle: "Con QR en el mostrador o link de pago." },
        { clinicaId, orden: 4, nombre: "Tarjetas de débito y crédito" },
      ],
    });
  }

  // ---------- Planes sanitarios (calendarios orientativos; el veterinario los adapta) ----------
  if ((await prisma.planSanitario.count({ where: { clinicaId } })) === 0) {
    await prisma.planSanitario.create({
      data: {
        clinicaId,
        nombre: "Plan cachorro",
        especie: "PERRO",
        fotoUrl: "/fotos/cachorro.jpg",
        descripcion: "Las vacunas y desparasitaciones del primer año, en el orden recomendado. Te avisamos por WhatsApp antes de cada una.",
        dosis: {
          create: [
            { tipo: "DESPARASITACION", producto: "Desparasitación interna", edadSemanas: 2 },
            { tipo: "DESPARASITACION", producto: "Desparasitación interna", edadSemanas: 4 },
            { tipo: "VACUNA", producto: "Primera dosis séxtuple", edadSemanas: 6 },
            { tipo: "VACUNA", producto: "Segunda dosis séxtuple", edadSemanas: 9 },
            { tipo: "VACUNA", producto: "Tercera dosis séxtuple", edadSemanas: 12 },
            { tipo: "VACUNA", producto: "Antirrábica", edadSemanas: 16, nota: "Obligatoria. Refuerzo anual." },
          ],
        },
      },
    });

    await prisma.planSanitario.create({
      data: {
        clinicaId,
        nombre: "Plan gatito",
        especie: "GATO",
        fotoUrl: "/fotos/gatito.jpg",
        descripcion: "Los controles del primer año de tu gato, para que crezca sano y protegido.",
        dosis: {
          create: [
            { tipo: "DESPARASITACION", producto: "Desparasitación interna", edadSemanas: 3 },
            { tipo: "DESPARASITACION", producto: "Desparasitación interna", edadSemanas: 6 },
            { tipo: "VACUNA", producto: "Primera dosis triple felina", edadSemanas: 8 },
            { tipo: "VACUNA", producto: "Segunda dosis triple felina", edadSemanas: 12 },
            { tipo: "VACUNA", producto: "Antirrábica", edadSemanas: 16, nota: "Obligatoria. Refuerzo anual." },
          ],
        },
      },
    });
  }

  // ---------- Promoción ----------
  if ((await prisma.promocion.count({ where: { clinicaId } })) === 0) {
    await prisma.promocion.create({
      data: {
        clinicaId,
        titulo: "10% de descuento en la primera consulta",
        descripcion: "Para mascotas que se atienden por primera vez en la clínica. Una mascota por consulta.",
        porcentajeDescuento: 10,
        soloPrimeraAtencion: true,
        vigenteDesde: new Date("2026-10-01"),
        vigenteHasta: new Date("2026-12-31"),
      },
    });
  }

  // ---------- Animales en adopción (ficticios; la clínica sube sus propias fotos) ----------
  if ((await prisma.animalAdopcion.count({ where: { clinicaId } })) === 0) {
    const animales = [
      {
        nombre: "Canela", especie: "PERRO", sexo: "HEMBRA", edad: "JOVEN", tamano: "MEDIANO", color: "Dorado / caramelo",
        historia: "La encontraron sola cerca del puerto. Es muy cariñosa y le encanta que le rasquen las orejas.",
        tranquilo: true, buenoConChicos: true, conviveConPerros: true, vacunado: true, desparasitado: true, castrado: true,
        fotos: ["/fotos/labrador-asomado.jpg"],
      },
      {
        nombre: "Tito", especie: "PERRO", sexo: "MACHO", edad: "ADULTO", tamano: "CHICO", color: "Blanco y marrón",
        historia: "Lo trajeron de la calle con una patita lastimada. Ya está sano y tiene muchísima energía.",
        jugueton: true, buenoConChicos: true, vacunado: true, desparasitado: true, castrado: true,
        fotos: ["/fotos/jack-russell.jpg"],
      },
      {
        nombre: "Copito", especie: "PERRO", sexo: "MACHO", edad: "CACHORRO", tamano: "CHICO", color: "Blanco",
        historia: "Tiene unos 3 meses. Es curioso, juguetón y aprende rápido.",
        jugueton: true, buenoConChicos: true, conviveConPerros: true, conviveConGatos: true, vacunado: true, desparasitado: true,
        fotos: ["/fotos/caniche-cachorro.jpg"],
      },
      {
        nombre: "Michi", especie: "GATO", sexo: "MACHO", edad: "JOVEN", tamano: "CHICO", color: "Atigrado",
        historia: "Un gato tranquilo y dormilón. Ideal para departamento.",
        tranquilo: true, conviveConGatos: true, vacunado: true, desparasitado: true, castrado: true,
        fotos: ["/fotos/gato-lengua.jpg"],
      },
      {
        nombre: "Nieve", especie: "GATO", sexo: "HEMBRA", edad: "CACHORRO", tamano: "CHICO", color: "Blanco",
        historia: "Una gatita de 2 meses, muy mimosa. Busca una familia paciente.",
        tranquilo: true, buenoConChicos: true, conviveConGatos: true, desparasitado: true,
        fotos: ["/fotos/gatito-blanco.jpg"],
      },
    ] as const;

    for (const { fotos, ...datos } of animales) {
      await prisma.animalAdopcion.create({
        data: { clinicaId, ...datos, fotos: { create: fotos.map((url, orden) => ({ url, orden })) } },
      });
    }

    await prisma.animalAdopcion.create({
      data: {
        clinicaId, nombre: "Luna", especie: "GATO", sexo: "HEMBRA", edad: "ADULTO", tamano: "CHICO", color: "Crema",
        historia: "Ya encontró una familia.", tranquilo: true, vacunado: true, desparasitado: true, castrado: true,
        estado: "ADOPTADO", adoptadoEn: new Date("2026-09-28"),
        fotos: { create: [{ url: "/fotos/siames.jpg", orden: 0 }] },
      },
    });
  }

  // ---------- Cliente sin cuenta con una vacuna por vencer (para probar recordatorios) ----------
  if ((await prisma.cliente.count({ where: { clinicaId } })) === 0) {
    const cliente = await prisma.cliente.create({
      data: {
        clinicaId,
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
  }

  // ---------- Más clientes ficticios, para probar la búsqueda ----------
  const masClientes = [
    {
      nombre: "María", apellido: "Fernández", telefono: "5493777222333", dni: "30111222",
      mascotas: [
        { nombre: "Lola", especie: "PERRO", sexo: "HEMBRA", raza: "Mestiza", color: "Negro", castrado: true, fechaNacimiento: new Date("2021-03-10") },
        { nombre: "Simón", especie: "GATO", sexo: "MACHO", color: "Atigrado", castrado: true, fechaNacimiento: new Date("2023-07-01") },
      ],
    },
    {
      nombre: "Diego", apellido: "Martínez", telefono: "5493777444555",
      mascotas: [{ nombre: "Tom", especie: "PERRO", sexo: "MACHO", raza: "Mestizo", color: "Marrón", castrado: false, fechaNacimiento: new Date("2024-01-15") }],
    },
    {
      nombre: "Silvia", apellido: "Acosta", telefono: "5493777666777",
      mascotas: [{ nombre: "Coco", especie: "GATO", sexo: "HEMBRA", color: "Blanco", castrado: true, fechaNacimiento: new Date("2019-11-20") }],
    },
  ] as const;

  for (const { mascotas, ...c } of masClientes) {
    if (await prisma.cliente.findFirst({ where: { clinicaId, telefono: c.telefono } })) continue;
    await prisma.cliente.create({ data: { clinicaId, ...c, mascotas: { create: [...mascotas] } } });
  }

  // ---------- Historia de ejemplo, para que los recordatorios tengan casos en la demo ----------
  // Las fechas son relativas al día en que se corre el seed.
  const lola = await prisma.mascota.findFirst({ where: { nombre: "Lola", cliente: { clinicaId } } });
  const simon = await prisma.mascota.findFirst({ where: { nombre: "Simón", cliente: { clinicaId } } });
  if (lola && simon && (await prisma.consulta.count({ where: { mascotaId: { in: [lola.id, simon.id] } } })) === 0) {
    const fecha = (dias: number) => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + dias);
      return new Date(`${d.toISOString().slice(0, 10)}T00:00:00.000Z`);
    };
    // Lola: no viene hace 8 meses y tiene la séxtuple vencida hace 2 meses → "para recuperar".
    await prisma.consulta.create({
      data: {
        mascotaId: lola.id, veterinarioId: vet.id, fecha: fecha(-240), motivo: "Control y vacunación", pesoKg: 21.3,
        diagnostico: "Buen estado general",
        aplicaciones: { create: { mascotaId: lola.id, tipo: "VACUNA", producto: "Séxtuple", fechaAplicacion: fecha(-240), fechaProximaDosis: fecha(-60) } },
      },
    });
    // Simón: le toca la desparasitación en 3 días → "por vencer".
    await prisma.consulta.create({
      data: {
        mascotaId: simon.id, veterinarioId: vet.id, fecha: fecha(-87), motivo: "Desparasitación", pesoKg: 4.2,
        aplicaciones: { create: { mascotaId: simon.id, tipo: "DESPARASITACION", producto: "Desparasitación interna", fechaAplicacion: fecha(-87), fechaProximaDosis: fecha(3) } },
      },
    });
  }

  // ---------- Historial de turnos de ejemplo (para la pantalla de estadísticas) ----------
  // Turnos ya pasados de los últimos 10 meses, con estados y orígenes variados. Solo se crean si
  // todavía no hay ningún turno pasado. No generan consultas, así no cambian los casos de los recordatorios.
  const inicioDeHoy = new Date(`${new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10)}T03:00:00.000Z`);
  if ((await prisma.turno.count({ where: { clinicaId, fechaHoraInicio: { lt: inicioDeHoy } } })) === 0) {
    const nombres = ["Firulais", "Tom", "Coco"];
    const mascotasHistorial = await prisma.mascota.findMany({
      where: { nombre: { in: nombres }, cliente: { clinicaId } },
      include: { cliente: true },
    });
    const serviciosHistorial = await prisma.servicio.findMany({ where: { clinicaId, reservableOnline: true } });
    const veterinaria = await prisma.usuario.findFirst({ where: { clinicaId, rol: "VETERINARIO" } });
    const horas = ["09:00", "09:45", "10:30", "11:15", "17:00", "17:45", "18:30", "19:15"];

    // Números "al azar" pero siempre iguales, para que la demo sea reproducible.
    let semilla = 20261012;
    const azar = () => {
      semilla = (semilla * 1103515245 + 12345) % 2147483648;
      return semilla / 2147483648;
    };
    const elegir = <T,>(lista: T[]) => lista[Math.floor(azar() * lista.length)];

    const turnos = [];
    for (let dias = 300; dias >= 1; dias--) {
      const dia = new Date(inicioDeHoy.getTime() - dias * 24 * 3600 * 1000);
      const diaSemana = new Date(dia.getTime() - 3 * 3600 * 1000).getUTCDay();
      if (diaSemana === 0) continue; // domingo cerrado
      // Lunes y viernes vienen más cargados; el sábado solo hay mañana.
      const cantidad = Math.floor(azar() * (diaSemana === 1 || diaSemana === 5 ? 5 : 3.5));
      const horasDelDia = diaSemana === 6 ? horas.slice(0, 4) : horas;
      const usadas = new Set<string>();
      for (let i = 0; i < cantidad && usadas.size < horasDelDia.length; i++) {
        let hora = elegir(horasDelDia);
        while (usadas.has(hora)) hora = elegir(horasDelDia);
        usadas.add(hora);
        const servicio = elegir(serviciosHistorial);
        const inicio = new Date(dia.getTime() + (Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3))) * 60 * 1000);
        const r = azar();
        const o = azar();
        turnos.push({
          clinicaId,
          mascotaId: elegir(mascotasHistorial).id,
          servicioId: servicio.id,
          veterinarioId: veterinaria?.id ?? null,
          fechaHoraInicio: inicio,
          fechaHoraFin: new Date(inicio.getTime() + servicio.duracionMin * 60 * 1000),
          estado: r < 0.8 ? ("ATENDIDO" as const) : r < 0.92 ? ("AUSENTE" as const) : ("CANCELADO" as const),
          origen: o < 0.3 ? ("ONLINE" as const) : o < 0.8 ? ("TELEFONO" as const) : ("MOSTRADOR" as const),
          creadoEn: new Date(inicio.getTime() - Math.floor(1 + azar() * 6) * 24 * 3600 * 1000),
        });
      }
    }
    if (mascotasHistorial.length > 0 && serviciosHistorial.length > 0) {
      await prisma.turno.createMany({ data: turnos });

      // Avisos de "te extrañamos" de hace 3 meses, para el indicador de clientes recuperados.
      if (veterinaria) {
        for (const [i, m] of mascotasHistorial.entries()) {
          const enviado = new Date(inicioDeHoy.getTime() - (82 - i) * 24 * 3600 * 1000);
          await prisma.recordatorio.create({
            data: {
              clienteId: m.clienteId,
              usuarioId: veterinaria.id,
              tipo: "RECUPERO",
              mensaje: `Hola ${m.cliente.nombre}, hace mucho que no vemos a ${m.nombre}. ¿Le damos un turno para un control?`,
              enviadoEn: enviado,
            },
          });
        }
      }
    }
  }

  console.log("Datos de prueba al día.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
