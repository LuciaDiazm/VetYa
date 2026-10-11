-- CreateTable
CREATE TABLE `animal_adopcion` (
    `id_animal` INTEGER NOT NULL AUTO_INCREMENT,
    `id_clinica` INTEGER NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `especie` ENUM('PERRO', 'GATO', 'OTRO') NOT NULL,
    `sexo` ENUM('MACHO', 'HEMBRA') NOT NULL,
    `edad` ENUM('CACHORRO', 'JOVEN', 'ADULTO', 'MAYOR') NOT NULL,
    `tamano` ENUM('CHICO', 'MEDIANO', 'GRANDE') NOT NULL,
    `color` VARCHAR(191) NOT NULL,
    `historia` TEXT NULL,
    `tranquilo` BOOLEAN NOT NULL DEFAULT false,
    `jugueton` BOOLEAN NOT NULL DEFAULT false,
    `bueno_con_chicos` BOOLEAN NOT NULL DEFAULT false,
    `convive_con_perros` BOOLEAN NOT NULL DEFAULT false,
    `convive_con_gatos` BOOLEAN NOT NULL DEFAULT false,
    `vacunado` BOOLEAN NOT NULL DEFAULT false,
    `desparasitado` BOOLEAN NOT NULL DEFAULT false,
    `castrado` BOOLEAN NOT NULL DEFAULT false,
    `estado` ENUM('DISPONIBLE', 'RESERVADO', 'ADOPTADO') NOT NULL DEFAULT 'DISPONIBLE',
    `publicado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `adoptado_en` DATETIME(3) NULL,

    INDEX `animal_adopcion_id_clinica_estado_idx`(`id_clinica`, `estado`),
    PRIMARY KEY (`id_animal`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `foto_adopcion` (
    `id_foto` INTEGER NOT NULL AUTO_INCREMENT,
    `id_animal` INTEGER NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `orden` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id_foto`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `solicitud_adopcion` (
    `id_solicitud` INTEGER NOT NULL AUTO_INCREMENT,
    `id_animal` INTEGER NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `telefono` VARCHAR(191) NOT NULL,
    `vivienda` ENUM('CASA_CON_PATIO', 'CASA_SIN_PATIO', 'DEPARTAMENTO') NOT NULL,
    `otros_animales` BOOLEAN NOT NULL,
    `acepta_compromiso` BOOLEAN NOT NULL,
    `mensaje` TEXT NULL,
    `estado` ENUM('NUEVA', 'CONTACTADA', 'APROBADA', 'RECHAZADA') NOT NULL DEFAULT 'NUEVA',
    `creada_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `solicitud_adopcion_estado_idx`(`estado`),
    PRIMARY KEY (`id_solicitud`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `animal_adopcion` ADD CONSTRAINT `animal_adopcion_id_clinica_fkey` FOREIGN KEY (`id_clinica`) REFERENCES `clinica`(`id_clinica`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `foto_adopcion` ADD CONSTRAINT `foto_adopcion_id_animal_fkey` FOREIGN KEY (`id_animal`) REFERENCES `animal_adopcion`(`id_animal`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solicitud_adopcion` ADD CONSTRAINT `solicitud_adopcion_id_animal_fkey` FOREIGN KEY (`id_animal`) REFERENCES `animal_adopcion`(`id_animal`) ON DELETE CASCADE ON UPDATE CASCADE;
