-- Registro de pagos en la clínica
ALTER TABLE `clinica` ADD COLUMN `pagos_desde` DATETIME(3) NULL;
UPDATE `clinica` SET `pagos_desde` = CURRENT_TIMESTAMP(3);

CREATE TABLE `pago` (
    `id_pago` INTEGER NOT NULL AUTO_INCREMENT,
    `id_clinica` INTEGER NOT NULL,
    `id_cliente` INTEGER NULL,
    `id_turno` INTEGER NULL,
    `monto` DECIMAL(10, 2) NOT NULL,
    `medio` ENUM('EFECTIVO', 'TRANSFERENCIA', 'DEBITO', 'CREDITO', 'SIN_CARGO') NOT NULL,
    `concepto` VARCHAR(191) NOT NULL,
    `nota` VARCHAR(191) NULL,
    `fecha` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `id_registrado_por` INTEGER NOT NULL,
    `anulado` BOOLEAN NOT NULL DEFAULT false,
    `anulado_en` DATETIME(3) NULL,
    `id_anulado_por` INTEGER NULL,
    `motivo_anulacion` VARCHAR(191) NULL,

    INDEX `pago_id_clinica_fecha_idx`(`id_clinica`, `fecha`),
    INDEX `pago_id_cliente_idx`(`id_cliente`),
    INDEX `pago_id_turno_idx`(`id_turno`),
    PRIMARY KEY (`id_pago`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `pago` ADD CONSTRAINT `pago_id_clinica_fkey` FOREIGN KEY (`id_clinica`) REFERENCES `clinica`(`id_clinica`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `pago` ADD CONSTRAINT `pago_id_cliente_fkey` FOREIGN KEY (`id_cliente`) REFERENCES `cliente`(`id_cliente`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `pago` ADD CONSTRAINT `pago_id_turno_fkey` FOREIGN KEY (`id_turno`) REFERENCES `turno`(`id_turno`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `pago` ADD CONSTRAINT `pago_id_registrado_por_fkey` FOREIGN KEY (`id_registrado_por`) REFERENCES `usuario`(`id_usuario`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `pago` ADD CONSTRAINT `pago_id_anulado_por_fkey` FOREIGN KEY (`id_anulado_por`) REFERENCES `usuario`(`id_usuario`) ON DELETE SET NULL ON UPDATE CASCADE;
