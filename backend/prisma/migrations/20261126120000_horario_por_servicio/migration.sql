-- Horario propio de cada servicio (opcional), dentro del horario de la clínica.
ALTER TABLE `servicio`
  ADD COLUMN `hora_desde` VARCHAR(5) NULL,
  ADD COLUMN `hora_hasta` VARCHAR(5) NULL,
  ADD COLUMN `dias_semana` VARCHAR(20) NULL;
