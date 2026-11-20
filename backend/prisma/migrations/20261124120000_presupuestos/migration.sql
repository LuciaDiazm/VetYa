-- Presupuestos con seña: el pago puede quedar a cuenta de un presupuesto
CREATE TABLE `presupuesto` (
    `id_presupuesto` INTEGER NOT NULL AUTO_INCREMENT,
    `id_clinica` INTEGER NOT NULL,
    `id_cliente` INTEGER NOT NULL,
    `id_mascota` INTEGER NULL,
    `id_servicio` INTEGER NULL,
    `titulo` VARCHAR(120) NOT NULL,
    `total` DECIMAL(10, 2) NOT NULL,
    `valido_hasta` DATE NOT NULL,
    `nota` VARCHAR(500) NULL,
    `estado` ENUM('VIGENTE', 'ANULADO') NOT NULL DEFAULT 'VIGENTE',
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `id_creado_por` INTEGER NOT NULL,
    `anulado_en` DATETIME(3) NULL,
    `id_anulado_por` INTEGER NULL,
    `motivo_anulacion` VARCHAR(191) NULL,

    INDEX `presupuesto_id_clinica_creado_en_idx`(`id_clinica`, `creado_en`),
    INDEX `presupuesto_id_cliente_idx`(`id_cliente`),
    INDEX `presupuesto_id_mascota_idx`(`id_mascota`),
    PRIMARY KEY (`id_presupuesto`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `presupuesto_item` (
    `id_item` INTEGER NOT NULL AUTO_INCREMENT,
    `id_presupuesto` INTEGER NOT NULL,
    `descripcion` VARCHAR(160) NOT NULL,
    `monto` DECIMAL(10, 2) NOT NULL,
    `orden` INTEGER NOT NULL,

    INDEX `presupuesto_item_id_presupuesto_idx`(`id_presupuesto`),
    PRIMARY KEY (`id_item`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `pago` ADD COLUMN `id_presupuesto` INTEGER NULL;
CREATE INDEX `pago_id_presupuesto_idx` ON `pago`(`id_presupuesto`);

ALTER TABLE `presupuesto` ADD CONSTRAINT `presupuesto_id_clinica_fkey` FOREIGN KEY (`id_clinica`) REFERENCES `clinica`(`id_clinica`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `presupuesto` ADD CONSTRAINT `presupuesto_id_cliente_fkey` FOREIGN KEY (`id_cliente`) REFERENCES `cliente`(`id_cliente`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `presupuesto` ADD CONSTRAINT `presupuesto_id_mascota_fkey` FOREIGN KEY (`id_mascota`) REFERENCES `mascota`(`id_mascota`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `presupuesto` ADD CONSTRAINT `presupuesto_id_servicio_fkey` FOREIGN KEY (`id_servicio`) REFERENCES `servicio`(`id_servicio`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `presupuesto` ADD CONSTRAINT `presupuesto_id_creado_por_fkey` FOREIGN KEY (`id_creado_por`) REFERENCES `usuario`(`id_usuario`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `presupuesto` ADD CONSTRAINT `presupuesto_id_anulado_por_fkey` FOREIGN KEY (`id_anulado_por`) REFERENCES `usuario`(`id_usuario`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `presupuesto_item` ADD CONSTRAINT `presupuesto_item_id_presupuesto_fkey` FOREIGN KEY (`id_presupuesto`) REFERENCES `presupuesto`(`id_presupuesto`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `pago` ADD CONSTRAINT `pago_id_presupuesto_fkey` FOREIGN KEY (`id_presupuesto`) REFERENCES `presupuesto`(`id_presupuesto`) ON DELETE SET NULL ON UPDATE CASCADE;
