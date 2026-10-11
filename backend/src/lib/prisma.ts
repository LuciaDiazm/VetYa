import { PrismaClient } from "@prisma/client";

// Una única conexión a la base de datos para toda la aplicación.
export const prisma = new PrismaClient();
