-- Límite propio de turnos web a la vez para un cliente (por ejemplo, alguien conocido con muchos animales).
-- NULL = usa el de la clínica.
ALTER TABLE `cliente` ADD COLUMN `max_turnos_online` INTEGER NULL;
