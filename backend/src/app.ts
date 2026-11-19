import fs from "node:fs";
import path from "node:path";
import cors from "cors";
import express from "express";
import { mismoOrigen } from "./lib/auth";
import { CARPETA_SUBIDAS, erroresDeSubida } from "./lib/subidas";
import { archivosRouter } from "./routes/archivos";
import { auditoriaRouter } from "./routes/auditoria";
import { authRouter } from "./routes/auth";
import { configuracionRouter } from "./routes/configuracion";
import { estadisticasRouter } from "./routes/estadisticas";
import { clientesRouter, mascotasRouter } from "./routes/clientes";
import { consultasRouter } from "./routes/consultas";
import { miCuentaRouter } from "./routes/miCuenta";
import { pagosRouter } from "./routes/pagos";
import { publicoRouter } from "./routes/publico";
import { recordatoriosRouter } from "./routes/recordatorios";
import { turnosPublicoRouter, turnosRouter } from "./routes/turnos";
import { usuariosRouter } from "./routes/usuarios";

export const app = express();

// No contar qué programa usa el servidor (es un dato que ayuda a quien busca fallas).
app.disable("x-powered-by");
// En internet (Render) el pedido pasa por un intermediario: así se sabe la conexión real de cada
// persona, que es lo que usa el límite de intentos.
app.set("trust proxy", 1);

// Encabezados de seguridad: el navegador no deja meter la página dentro de otra (contra engaños),
// no adivina tipos de archivo y no le cuenta a otras páginas desde dónde se vino.
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (req.secure) res.setHeader("Strict-Transport-Security", "max-age=31536000");
  // Política de contenido: la página solo carga programas propios, letras de Google Fonts y el mapa de
  // OpenStreetMap. Si alguien lograra meter un script de otro sitio, el navegador no lo ejecuta.
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.tile.openstreetmap.org",
      "media-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  );
  next();
});

app.use(cors({ origin: process.env.FRONTEND_URL ?? "http://localhost:5173", credentials: true }));
// Lo que cambia datos tiene que venir de la propia web (segunda barrera contra pedidos de otras páginas).
app.use("/api", mismoOrigen);
// 2 MB alcanzan para mandar un informe de turnos largo y armar su PDF.
app.use(express.json({ limit: "2mb" }));

// Fotos que sube la clínica (por ejemplo, las del personal).
app.use("/uploads", express.static(CARPETA_SUBIDAS, { maxAge: "7d" }));

// Para verificar que el servidor está funcionando.
app.get("/api/salud", (_req, res) => {
  res.json({ estado: "ok" });
});

app.use("/api/publico/turnos", turnosPublicoRouter);
app.use("/api/publico", publicoRouter);
app.use("/api/auth", authRouter);
app.use("/api/usuarios", usuariosRouter);
app.use("/api/clientes", clientesRouter);
app.use("/api/mascotas", mascotasRouter);
app.use("/api/turnos", turnosRouter);
app.use("/api/consultas", consultasRouter);
app.use("/api/recordatorios", recordatoriosRouter);
app.use("/api/mi-cuenta", miCuentaRouter);
app.use("/api/configuracion", configuracionRouter);
app.use("/api/estadisticas", estadisticasRouter);
app.use("/api/pagos", pagosRouter);
app.use("/api/archivos", archivosRouter);
app.use("/api/auditoria", auditoriaRouter);

// En internet, el mismo servidor entrega la página (la carpeta frontend/dist que arma "npm run build").
const CARPETA_WEB = path.resolve(__dirname, "../../frontend/dist");
if (process.env.NODE_ENV === "production" && fs.existsSync(CARPETA_WEB)) {
  app.use(express.static(CARPETA_WEB, { maxAge: "1h", index: false }));
  app.get(/^(?!\/api\/|\/uploads\/).*/, (_req, res) => res.sendFile(path.join(CARPETA_WEB, "index.html")));
}

app.use(erroresDeSubida);

// Cualquier error no controlado termina acá en lugar de tirar abajo el servidor.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});
