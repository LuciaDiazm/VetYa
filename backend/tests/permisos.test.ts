// Pruebas automáticas de seguridad y permisos. Se corren con: npm test
// Usan la base de desarrollo y las cuentas de prueba del seed, pero no cambian datos:
// todo lo que prueban es que el servidor NO deje hacer algo (o que solo lea).
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";

type Perfil = "ADMIN" | "VETERINARIO" | "RECEPCION" | "DUENIO";

// Las cuentas salen del encabezado del seed (las mismas que figuran ahí para probar a mano).
function cuentasDelSeed() {
  const texto = fs.readFileSync(path.resolve(__dirname, "../prisma/seed.ts"), "utf8");
  const cuentas: Partial<Record<Perfil, { email: string; password: string }>> = {};
  for (const linea of texto.split("\n").slice(0, 20)) {
    const m = linea.match(/\/\/\s+(\S+@vetya\.test)\s+\/\s+(\S+)\s+\((\w+)/);
    if (m) cuentas[m[3] as Perfil] = { email: m[1], password: m[2] };
  }
  return cuentas;
}

const cookies: Partial<Record<Perfil, string>> = {};
const como = (perfil: Perfil) => ({ Cookie: cookies[perfil] ?? "" });

beforeAll(async () => {
  const cuentas = cuentasDelSeed();
  for (const perfil of ["ADMIN", "VETERINARIO", "RECEPCION", "DUENIO"] as const) {
    const cuenta = cuentas[perfil];
    if (!cuenta) throw new Error(`Falta la cuenta de ${perfil} en el encabezado del seed`);
    const r = await request(app).post("/api/auth/login").send(cuenta);
    expect(r.status).toBe(200);
    cookies[perfil] = String(r.headers["set-cookie"]?.[0] ?? "").split(";")[0];
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Sesión", () => {
  it("viaja en una cookie que ningún script puede leer, y no en la respuesta", async () => {
    const cuentas = cuentasDelSeed();
    const r = await request(app).post("/api/auth/login").send(cuentas.RECEPCION);
    const cookie = String(r.headers["set-cookie"]?.[0] ?? "");
    expect(cookie).toMatch(/^vetya_sesion=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(r.body.token).toBeUndefined();
    expect(r.body.usuario.passwordHash).toBeUndefined();
  });

  it("sin sesión no se ve nada del panel", async () => {
    const r = await request(app).get("/api/clientes");
    expect(r.status).toBe(401);
  });

  it("un pedido que cambia datos desde otra página se rechaza", async () => {
    const r = await request(app)
      .post("/api/turnos")
      .set(como("ADMIN"))
      .set("Origin", "https://pagina-ajena.example")
      .send({});
    expect(r.status).toBe(403);
  });

  it("manda los encabezados de seguridad", async () => {
    const r = await request(app).get("/api/publico/sitio");
    expect(r.headers["content-security-policy"]).toContain("default-src 'self'");
    expect(r.headers["x-content-type-options"]).toBe("nosniff");
  });
});

describe("Qué ve cada perfil", () => {
  const casos: [string, Record<Perfil, number>][] = [
    ["/api/clientes", { ADMIN: 200, VETERINARIO: 200, RECEPCION: 200, DUENIO: 403 }],
    ["/api/turnos", { ADMIN: 200, VETERINARIO: 200, RECEPCION: 200, DUENIO: 403 }],
    ["/api/pagos/por-cobrar", { ADMIN: 200, VETERINARIO: 200, RECEPCION: 200, DUENIO: 403 }],
    ["/api/presupuestos?clienteId=1", { ADMIN: 200, VETERINARIO: 200, RECEPCION: 200, DUENIO: 403 }],
    ["/api/recordatorios/resumen", { ADMIN: 200, VETERINARIO: 200, RECEPCION: 200, DUENIO: 403 }],
    ["/api/estadisticas", { ADMIN: 200, VETERINARIO: 403, RECEPCION: 403, DUENIO: 403 }],
    ["/api/usuarios", { ADMIN: 200, VETERINARIO: 403, RECEPCION: 403, DUENIO: 403 }],
    ["/api/auditoria", { ADMIN: 200, VETERINARIO: 403, RECEPCION: 403, DUENIO: 403 }],
    ["/api/mi-cuenta", { ADMIN: 403, VETERINARIO: 403, RECEPCION: 403, DUENIO: 200 }],
  ];
  for (const [ruta, esperado] of casos) {
    it(ruta, async () => {
      for (const perfil of Object.keys(esperado) as Perfil[]) {
        const r = await request(app).get(ruta).set(como(perfil));
        expect([perfil, r.status]).toEqual([perfil, esperado[perfil]]);
      }
    });
  }

  it("recepción ve las visitas de una mascota pero no el diagnóstico ni los estudios", async () => {
    const consulta = await prisma.consulta.findFirst({ where: { diagnostico: { not: null } } });
    expect(consulta).not.toBeNull();
    const ruta = `/api/mascotas/${consulta!.mascotaId}`;
    const vet = await request(app).get(ruta).set(como("VETERINARIO"));
    const recepcion = await request(app).get(ruta).set(como("RECEPCION"));
    expect(vet.body.consultas.some((c: { diagnostico: string | null }) => c.diagnostico)).toBe(true);
    expect(recepcion.body.consultas.length).toBe(vet.body.consultas.length);
    expect(recepcion.body.consultas.every((c: { diagnostico: string | null }) => c.diagnostico === null)).toBe(true);
    expect(recepcion.body.adjuntos).toEqual([]);
  });

  it("recepción no puede abrir un estudio adjunto aunque sepa su número", async () => {
    const adjunto = await prisma.adjunto.findFirst({ where: { quitado: false } });
    if (!adjunto) return; // todavía no hay ninguno cargado
    const ruta = `/api/archivos/${adjunto.archivoId}`;
    expect((await request(app).get(ruta).set(como("VETERINARIO"))).status).toBe(200);
    expect((await request(app).get(ruta).set(como("RECEPCION"))).status).toBe(404);
    expect((await request(app).get(ruta)).status).toBe(404);
  });
});

describe("Qué puede hacer cada perfil", () => {
  it("la veterinaria o el veterinario no da turnos ni cobra ni cambia datos del cliente", async () => {
    expect((await request(app).post("/api/turnos").set(como("VETERINARIO")).send({})).status).toBe(403);
    expect((await request(app).post("/api/pagos").set(como("VETERINARIO")).send({})).status).toBe(403);
    expect((await request(app).post("/api/presupuestos").set(como("VETERINARIO")).send({})).status).toBe(403);
    expect((await request(app).post("/api/pagos/cierre").set(como("VETERINARIO")).send({})).status).toBe(403);
    expect((await request(app).put("/api/clientes/1").set(como("VETERINARIO")).send({})).status).toBe(403);
  });

  it("recepción no carga ni corrige consultas, ni anula vacunas", async () => {
    expect((await request(app).post("/api/consultas").set(como("RECEPCION")).send({})).status).toBe(403);
    expect((await request(app).put("/api/consultas/1").set(como("RECEPCION")).send({})).status).toBe(403);
    const r = await request(app).patch("/api/consultas/aplicaciones/1/anular").set(como("RECEPCION")).send({ motivo: "prueba" });
    expect(r.status).toBe(403);
  });

  it("la veterinaria o el veterinario no corrige consultas de días anteriores", async () => {
    const ajena = await prisma.consulta.findFirst({
      // Una consulta de hace más de dos días: ya no se puede corregir aunque sea propia.
      where: { fecha: { lt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) } },
    });
    expect(ajena).not.toBeNull();
    const r = await request(app)
      .put(`/api/consultas/${ajena!.id}`)
      .set(como("VETERINARIO"))
      .send({ motivo: "No debería guardarse" });
    expect(r.status).toBe(403);
  });

  it("solo la administración reabre la caja cerrada", async () => {
    for (const perfil of ["VETERINARIO", "RECEPCION"] as const) {
      const r = await request(app).patch("/api/pagos/cierre/1/reabrir").set(como(perfil)).send({ motivo: "prueba" });
      expect(r.status).toBe(403);
    }
  });

  it("nadie que no sea la administración ve ni cambia el personal", async () => {
    for (const perfil of ["VETERINARIO", "RECEPCION"] as const) {
      const r = await request(app).post("/api/usuarios").set(como(perfil)).send({});
      expect(r.status).toBe(403);
    }
  });
});

describe("Archivos y turnos", () => {
  it("rechaza un archivo que dice ser una foto pero no lo es", async () => {
    const mascota = await prisma.mascota.findFirstOrThrow();
    const r = await request(app)
      .post("/api/consultas/adjuntos")
      .set(como("VETERINARIO"))
      .field("mascotaId", String(mascota.id))
      .attach("archivo", Buffer.from("MZ esto es un programa disfrazado"), { filename: "foto.png", contentType: "image/png" });
    expect(r.status).toBe(400);
  });

  it("no deja mover un turno a una fecha que ya pasó", async () => {
    const turno = await prisma.turno.findFirst({ where: { estado: { in: ["PENDIENTE", "CONFIRMADO"] } } });
    if (!turno) return;
    const r = await request(app)
      .patch(`/api/turnos/${turno.id}/mover`)
      .set(como("RECEPCION"))
      .send({ fecha: "2020-01-06", hora: "10:00" });
    expect(r.status).toBe(400);
  });

  it("no deja mover un turno que ya se atendió", async () => {
    const turno = await prisma.turno.findFirst({ where: { estado: "ATENDIDO" } });
    expect(turno).not.toBeNull();
    const r = await request(app)
      .patch(`/api/turnos/${turno!.id}/mover`)
      .set(como("RECEPCION"))
      .send({ fecha: "2030-01-07", hora: "10:00" });
    expect(r.status).toBe(409);
  });
});
