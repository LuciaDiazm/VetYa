import cors from "cors";
import express from "express";
import { CARPETA_SUBIDAS } from "./lib/subidas";
import { adopcionesPublicoRouter, adopcionesRouter, erroresDeSubida } from "./routes/adopciones";
import { authRouter } from "./routes/auth";
import { clientesRouter, mascotasRouter } from "./routes/clientes";
import { consultasRouter } from "./routes/consultas";
import { publicoRouter } from "./routes/publico";
import { recordatoriosRouter } from "./routes/recordatorios";
import { turnosPublicoRouter, turnosRouter } from "./routes/turnos";
import { usuariosRouter } from "./routes/usuarios";

export const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL ?? "http://localhost:5173" }));
app.use(express.json());

// Fotos que sube la clínica (por ejemplo, de los animales en adopción).
app.use("/uploads", express.static(CARPETA_SUBIDAS, { maxAge: "7d" }));

// Para verificar que el servidor está funcionando.
app.get("/api/salud", (_req, res) => {
  res.json({ estado: "ok" });
});

app.use("/api/publico/adopciones", adopcionesPublicoRouter);
app.use("/api/publico/turnos", turnosPublicoRouter);
app.use("/api/publico", publicoRouter);
app.use("/api/auth", authRouter);
app.use("/api/usuarios", usuariosRouter);
app.use("/api/adopciones", adopcionesRouter);
app.use("/api/clientes", clientesRouter);
app.use("/api/mascotas", mascotasRouter);
app.use("/api/turnos", turnosRouter);
app.use("/api/consultas", consultasRouter);
app.use("/api/recordatorios", recordatoriosRouter);

app.use(erroresDeSubida);

// Cualquier error no controlado termina acá en lugar de tirar abajo el servidor.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});
