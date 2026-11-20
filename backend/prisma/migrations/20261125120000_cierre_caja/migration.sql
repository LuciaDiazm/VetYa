-- Cierre de caja del día
CREATE TABLE `cierre_caja` (
    `id_cierre` INTEGER NOT NULL AUTO_INCREMENT,
    `id_clinica` INTEGER NOT NULL,
    `dia` DATE NOT NULL,
    `cambio_inicial` DECIMAL(10, 2) NOT NULL,
    `efectivo_cobrado` DECIMAL(10, 2) NOT NULL,
    `transferencia` DECIMAL(10, 2) NOT NULL,
    `debito` DECIMAL(10, 2) NOT NULL,
    `credito` DECIMAL(10, 2) NOT NULL,
    `total_cobrado` DECIMAL(10, 2) NOT NULL,
    `cantidad_cobros` INTEGER NOT NULL,
    `efectivo_contado` DECIMAL(10, 2) NOT NULL,
    `diferencia` DECIMAL(10, 2) NOT NULL,
    `nota` VARCHAR(300) NULL,
    `cerrado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `id_cerrado_por` INTEGER NOT NULL,
    `reabierto_en` DATETIME(3) NULL,
    `id_reabierto_por` INTEGER NULL,
    `motivo_reapertura` VARCHAR(191) NULL,

    INDEX `cierre_caja_id_clinica_dia_idx`(`id_clinica`, `dia`),
    PRIMARY KEY (`id_cierre`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `cierre_caja` ADD CONSTRAINT `cierre_caja_id_clinica_fkey` FOREIGN KEY (`id_clinica`) REFERENCES `clinica`(`id_clinica`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `cierre_caja` ADD CONSTRAINT `cierre_caja_id_cerrado_por_fkey` FOREIGN KEY (`id_cerrado_por`) REFERENCES `usuario`(`id_usuario`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `cierre_caja` ADD CONSTRAINT `cierre_caja_id_reabierto_por_fkey` FOREIGN KEY (`id_reabierto_por`) REFERENCES `usuario`(`id_usuario`) ON DELETE SET NULL ON UPDATE CASCADE;
