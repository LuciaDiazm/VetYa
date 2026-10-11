-- AlterTable
ALTER TABLE `clinica` ADD COLUMN `horario_urgencias` VARCHAR(191) NULL,
    ADD COLUMN `telefono_urgencias` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `servicio` ADD COLUMN `foto_url` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `usuario` ADD COLUMN `especialidad` VARCHAR(191) NULL,
    ADD COLUMN `foto_url` VARCHAR(191) NULL,
    ADD COLUMN `matricula` VARCHAR(191) NULL,
    ADD COLUMN `presentacion` TEXT NULL,
    ADD COLUMN `visible_en_web` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `opinion` (
    `id_opinion` INTEGER NOT NULL AUTO_INCREMENT,
    `id_clinica` INTEGER NOT NULL,
    `autor` VARCHAR(191) NOT NULL,
    `mascota` VARCHAR(191) NULL,
    `texto` TEXT NOT NULL,
    `puntaje` INTEGER NOT NULL,
    `fecha` DATE NOT NULL,
    `visible` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id_opinion`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `forma_pago` (
    `id_forma_pago` INTEGER NOT NULL AUTO_INCREMENT,
    `id_clinica` INTEGER NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `detalle` VARCHAR(191) NULL,
    `orden` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id_forma_pago`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `plan_sanitario` (
    `id_plan` INTEGER NOT NULL AUTO_INCREMENT,
    `id_clinica` INTEGER NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `especie` ENUM('PERRO', 'GATO', 'OTRO') NOT NULL,
    `descripcion` TEXT NOT NULL,
    `foto_url` VARCHAR(191) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id_plan`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `plan_sanitario_dosis` (
    `id_dosis` INTEGER NOT NULL AUTO_INCREMENT,
    `id_plan` INTEGER NOT NULL,
    `tipo` ENUM('VACUNA', 'DESPARASITACION') NOT NULL,
    `producto` VARCHAR(191) NOT NULL,
    `edad_semanas` INTEGER NOT NULL,
    `nota` VARCHAR(191) NULL,

    PRIMARY KEY (`id_dosis`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cuestionario_previo` (
    `id_cuestionario` INTEGER NOT NULL AUTO_INCREMENT,
    `id_turno` INTEGER NOT NULL,
    `sintomas` TEXT NULL,
    `desde_cuando` VARCHAR(191) NULL,
    `come_y_bebe_normal` BOOLEAN NULL,
    `vomitos_o_diarrea` BOOLEAN NULL,
    `alimentacion` TEXT NULL,
    `medicacion_actual` TEXT NULL,
    `observaciones` TEXT NULL,
    `completado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `cuestionario_previo_id_turno_key`(`id_turno`),
    PRIMARY KEY (`id_cuestionario`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `opinion` ADD CONSTRAINT `opinion_id_clinica_fkey` FOREIGN KEY (`id_clinica`) REFERENCES `clinica`(`id_clinica`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `forma_pago` ADD CONSTRAINT `forma_pago_id_clinica_fkey` FOREIGN KEY (`id_clinica`) REFERENCES `clinica`(`id_clinica`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `plan_sanitario` ADD CONSTRAINT `plan_sanitario_id_clinica_fkey` FOREIGN KEY (`id_clinica`) REFERENCES `clinica`(`id_clinica`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `plan_sanitario_dosis` ADD CONSTRAINT `plan_sanitario_dosis_id_plan_fkey` FOREIGN KEY (`id_plan`) REFERENCES `plan_sanitario`(`id_plan`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cuestionario_previo` ADD CONSTRAINT `cuestionario_previo_id_turno_fkey` FOREIGN KEY (`id_turno`) REFERENCES `turno`(`id_turno`) ON DELETE CASCADE ON UPDATE CASCADE;
