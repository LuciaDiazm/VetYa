-- La clínica no gestiona adopciones (solo ayudaba a difundir y eso también se sacó): se borran las tablas sin uso.
-- DropForeignKey
ALTER TABLE `solicitud_adopcion` DROP FOREIGN KEY `solicitud_adopcion_id_animal_fkey`;

-- DropForeignKey
ALTER TABLE `foto_adopcion` DROP FOREIGN KEY `foto_adopcion_id_animal_fkey`;

-- DropForeignKey
ALTER TABLE `animal_adopcion` DROP FOREIGN KEY `animal_adopcion_id_clinica_fkey`;

-- DropTable
DROP TABLE `solicitud_adopcion`;

-- DropTable
DROP TABLE `foto_adopcion`;

-- DropTable
DROP TABLE `animal_adopcion`;
