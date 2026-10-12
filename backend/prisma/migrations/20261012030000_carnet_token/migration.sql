-- Enlace privado para ver el carnet de vacunación sin cuenta.
-- Todas las mascotas existentes quedan con NULL, así que la restricción de unicidad no tiene conflictos.
ALTER TABLE `mascota` ADD COLUMN `token_carnet` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `mascota_token_carnet_key` ON `mascota`(`token_carnet`);
