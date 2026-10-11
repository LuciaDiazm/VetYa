import cors from "cors";
import express from "express";
import { publicoRouter } from "./routes/publico";

export const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL ?? "http://localhost:5173" }));
app.use(express.json());

// Para verificar que el servidor está funcionando.
app.get("/api/salud", (_req, res) => {
  res.json({ estado: "ok" });
});

app.use("/api/publico", publicoRouter);

// Cualquier error no controlado termina acá en lugar de tirar abajo el servidor.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});
