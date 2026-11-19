-- Turno de urgencia (lo carga el personal, va primero en Hoy) y "En consulta" (la pizarra del día).
ALTER TABLE `turno`
  ADD COLUMN `urgente` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `en_consulta_en` DATETIME(3) NULL;
