-- Tres perfiles (se suma RECEPCION), mascota con microchip, alergias y foto, llegada a la sala de espera,
-- consultas corregidas con registro, vacunas que se anulan en lugar de borrarse, archivos guardados en la base,
-- adjuntos de la historia clínica y registro de cambios (auditoria).

-- AlterTable
ALTER TABLE `aplicacion_sanitaria` ADD COLUMN `anulada` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `anulada_en` DATETIME(3) NULL,
    ADD COLUMN `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `id_anulada_por` INTEGER NULL,
    ADD COLUMN `id_registrado_por` INTEGER NULL,
    ADD COLUMN `motivo_anulacion` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `consulta` ADD COLUMN `editada_en` DATETIME(3) NULL,
    ADD COLUMN `id_editada_por` INTEGER NULL;

-- AlterTable
ALTER TABLE `mascota` ADD COLUMN `alergias` TEXT NULL,
    ADD COLUMN `id_foto` INTEGER NULL,
    ADD COLUMN `microchip` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `turno` ADD COLUMN `llego_en` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `usuario` MODIFY `rol` ENUM('DUENIO', 'VETERINARIO', 'ADMIN', 'RECEPCION') NOT NULL;

-- CreateTable
CREATE TABLE `archivo` (
    `id_archivo` INTEGER NOT NULL AUTO_INCREMENT,
    `id_clinica` INTEGER NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `tamanio` INTEGER NOT NULL,
    `datos` MEDIUMBLOB NOT NULL,
    `publico` BOOLEAN NOT NULL DEFAULT false,
    `id_subido_por` INTEGER NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id_archivo`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `adjunto` (
    `id_adjunto` INTEGER NOT NULL AUTO_INCREMENT,
    `id_mascota` INTEGER NOT NULL,
    `id_consulta` INTEGER NULL,
    `id_archivo` INTEGER NOT NULL,
    `descripcion` VARCHAR(191) NULL,
    `id_subido_por` INTEGER NOT NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `quitado` BOOLEAN NOT NULL DEFAULT false,
    `quitado_en` DATETIME(3) NULL,
    `id_quitado_por` INTEGER NULL,

    UNIQUE INDEX `adjunto_id_archivo_key`(`id_archivo`),
    INDEX `adjunto_id_mascota_idx`(`id_mascota`),
    PRIMARY KEY (`id_adjunto`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `auditoria` (
    `id_auditoria` INTEGER NOT NULL AUTO_INCREMENT,
    `id_clinica` INTEGER NOT NULL,
    `id_usuario` INTEGER NULL,
    `fecha` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `accion` VARCHAR(191) NOT NULL,
    `entidad` VARCHAR(191) NOT NULL,
    `id_entidad` INTEGER NOT NULL,
    `resumen` TEXT NOT NULL,
    `antes` JSON NULL,
    `despues` JSON NULL,

    INDEX `auditoria_id_clinica_fecha_idx`(`id_clinica`, `fecha`),
    INDEX `auditoria_entidad_id_entidad_idx`(`entidad`, `id_entidad`),
    PRIMARY KEY (`id_auditoria`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `mascota_id_foto_key` ON `mascota`(`id_foto`);

-- CreateIndex
CREATE INDEX `mascota_microchip_idx` ON `mascota`(`microchip`);

-- AddForeignKey
ALTER TABLE `mascota` ADD CONSTRAINT `mascota_id_foto_fkey` FOREIGN KEY (`id_foto`) REFERENCES `archivo`(`id_archivo`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `consulta` ADD CONSTRAINT `consulta_id_editada_por_fkey` FOREIGN KEY (`id_editada_por`) REFERENCES `usuario`(`id_usuario`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `aplicacion_sanitaria` ADD CONSTRAINT `aplicacion_sanitaria_id_registrado_por_fkey` FOREIGN KEY (`id_registrado_por`) REFERENCES `usuario`(`id_usuario`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `aplicacion_sanitaria` ADD CONSTRAINT `aplicacion_sanitaria_id_anulada_por_fkey` FOREIGN KEY (`id_anulada_por`) REFERENCES `usuario`(`id_usuario`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `archivo` ADD CONSTRAINT `archivo_id_clinica_fkey` FOREIGN KEY (`id_clinica`) REFERENCES `clinica`(`id_clinica`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `archivo` ADD CONSTRAINT `archivo_id_subido_por_fkey` FOREIGN KEY (`id_subido_por`) REFERENCES `usuario`(`id_usuario`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `adjunto` ADD CONSTRAINT `adjunto_id_mascota_fkey` FOREIGN KEY (`id_mascota`) REFERENCES `mascota`(`id_mascota`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `adjunto` ADD CONSTRAINT `adjunto_id_consulta_fkey` FOREIGN KEY (`id_consulta`) REFERENCES `consulta`(`id_consulta`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `adjunto` ADD CONSTRAINT `adjunto_id_archivo_fkey` FOREIGN KEY (`id_archivo`) REFERENCES `archivo`(`id_archivo`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `adjunto` ADD CONSTRAINT `adjunto_id_subido_por_fkey` FOREIGN KEY (`id_subido_por`) REFERENCES `usuario`(`id_usuario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `adjunto` ADD CONSTRAINT `adjunto_id_quitado_por_fkey` FOREIGN KEY (`id_quitado_por`) REFERENCES `usuario`(`id_usuario`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auditoria` ADD CONSTRAINT `auditoria_id_clinica_fkey` FOREIGN KEY (`id_clinica`) REFERENCES `clinica`(`id_clinica`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auditoria` ADD CONSTRAINT `auditoria_id_usuario_fkey` FOREIGN KEY (`id_usuario`) REFERENCES `usuario`(`id_usuario`) ON DELETE SET NULL ON UPDATE CASCADE;

