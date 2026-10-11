-- CreateTable
CREATE TABLE `clinica` (
    `id_clinica` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `direccion` VARCHAR(191) NOT NULL,
    `telefono` VARCHAR(191) NOT NULL,
    `whatsapp` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `instagram` VARCHAR(191) NULL,
    `latitud` DECIMAL(9, 6) NOT NULL,
    `longitud` DECIMAL(9, 6) NOT NULL,
    `horas_cancelacion` INTEGER NOT NULL DEFAULT 24,

    PRIMARY KEY (`id_clinica`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usuario` (
    `id_usuario` INTEGER NOT NULL AUTO_INCREMENT,
    `id_clinica` INTEGER NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `apellido` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `telefono` VARCHAR(191) NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `rol` ENUM('DUENIO', 'VETERINARIO', 'ADMIN') NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `usuario_email_key`(`email`),
    PRIMARY KEY (`id_usuario`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cliente` (
    `id_cliente` INTEGER NOT NULL AUTO_INCREMENT,
    `id_clinica` INTEGER NOT NULL,
    `id_usuario` INTEGER NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `apellido` VARCHAR(191) NOT NULL,
    `dni` VARCHAR(191) NULL,
    `telefono` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `direccion` VARCHAR(191) NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `cliente_id_usuario_key`(`id_usuario`),
    INDEX `cliente_id_clinica_telefono_idx`(`id_clinica`, `telefono`),
    PRIMARY KEY (`id_cliente`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mascota` (
    `id_mascota` INTEGER NOT NULL AUTO_INCREMENT,
    `id_cliente` INTEGER NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `especie` ENUM('PERRO', 'GATO', 'OTRO') NOT NULL,
    `raza` VARCHAR(191) NULL,
    `sexo` ENUM('MACHO', 'HEMBRA') NOT NULL,
    `fecha_nacimiento` DATE NULL,
    `color` VARCHAR(191) NULL,
    `castrado` BOOLEAN NOT NULL DEFAULT false,
    `observaciones` TEXT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id_mascota`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `servicio` (
    `id_servicio` INTEGER NOT NULL AUTO_INCREMENT,
    `id_clinica` INTEGER NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `categoria` ENUM('CLINICA', 'DIAGNOSTICO', 'CIRUGIA', 'ESTETICA') NOT NULL,
    `descripcion` TEXT NULL,
    `duracion_min` INTEGER NOT NULL,
    `precio_referencia` DECIMAL(10, 2) NULL,
    `reservable_online` BOOLEAN NOT NULL DEFAULT true,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id_servicio`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `horario_atencion` (
    `id_horario` INTEGER NOT NULL AUTO_INCREMENT,
    `id_clinica` INTEGER NOT NULL,
    `dia_semana` INTEGER NOT NULL,
    `hora_inicio` VARCHAR(5) NOT NULL,
    `hora_fin` VARCHAR(5) NOT NULL,

    PRIMARY KEY (`id_horario`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dia_bloqueado` (
    `id_dia_bloqueado` INTEGER NOT NULL AUTO_INCREMENT,
    `id_clinica` INTEGER NOT NULL,
    `fecha` DATE NOT NULL,
    `motivo` VARCHAR(191) NULL,

    UNIQUE INDEX `dia_bloqueado_id_clinica_fecha_key`(`id_clinica`, `fecha`),
    PRIMARY KEY (`id_dia_bloqueado`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `turno` (
    `id_turno` INTEGER NOT NULL AUTO_INCREMENT,
    `id_clinica` INTEGER NOT NULL,
    `id_mascota` INTEGER NOT NULL,
    `id_servicio` INTEGER NOT NULL,
    `id_veterinario` INTEGER NULL,
    `fecha_hora_inicio` DATETIME(3) NOT NULL,
    `fecha_hora_fin` DATETIME(3) NOT NULL,
    `estado` ENUM('PENDIENTE', 'CONFIRMADO', 'ATENDIDO', 'AUSENTE', 'CANCELADO') NOT NULL DEFAULT 'PENDIENTE',
    `origen` ENUM('ONLINE', 'TELEFONO', 'MOSTRADOR') NOT NULL,
    `observaciones` TEXT NULL,
    `recordatorio_enviado_en` DATETIME(3) NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `turno_id_clinica_fecha_hora_inicio_idx`(`id_clinica`, `fecha_hora_inicio`),
    PRIMARY KEY (`id_turno`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `consulta` (
    `id_consulta` INTEGER NOT NULL AUTO_INCREMENT,
    `id_mascota` INTEGER NOT NULL,
    `id_veterinario` INTEGER NOT NULL,
    `id_turno` INTEGER NULL,
    `fecha` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `motivo` VARCHAR(191) NOT NULL,
    `peso_kg` DECIMAL(5, 2) NULL,
    `temperatura` DECIMAL(4, 1) NULL,
    `diagnostico` TEXT NULL,
    `tratamiento` TEXT NULL,
    `observaciones` TEXT NULL,

    UNIQUE INDEX `consulta_id_turno_key`(`id_turno`),
    PRIMARY KEY (`id_consulta`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `aplicacion_sanitaria` (
    `id_aplicacion` INTEGER NOT NULL AUTO_INCREMENT,
    `id_mascota` INTEGER NOT NULL,
    `id_consulta` INTEGER NULL,
    `tipo` ENUM('VACUNA', 'DESPARASITACION') NOT NULL,
    `producto` VARCHAR(191) NOT NULL,
    `lote` VARCHAR(191) NULL,
    `fecha_aplicacion` DATE NOT NULL,
    `fecha_proxima_dosis` DATE NULL,

    INDEX `aplicacion_sanitaria_fecha_proxima_dosis_idx`(`fecha_proxima_dosis`),
    PRIMARY KEY (`id_aplicacion`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recordatorio` (
    `id_recordatorio` INTEGER NOT NULL AUTO_INCREMENT,
    `id_cliente` INTEGER NOT NULL,
    `id_usuario` INTEGER NOT NULL,
    `tipo` ENUM('TURNO', 'VACUNA', 'DESPARASITACION', 'RECUPERO', 'CARNET') NOT NULL,
    `id_turno` INTEGER NULL,
    `id_aplicacion` INTEGER NULL,
    `mensaje` TEXT NOT NULL,
    `enviado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id_recordatorio`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pregunta_frecuente` (
    `id_pregunta` INTEGER NOT NULL AUTO_INCREMENT,
    `id_clinica` INTEGER NOT NULL,
    `pregunta` VARCHAR(191) NOT NULL,
    `respuesta` TEXT NOT NULL,
    `orden` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id_pregunta`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `promocion` (
    `id_promocion` INTEGER NOT NULL AUTO_INCREMENT,
    `id_clinica` INTEGER NOT NULL,
    `id_servicio` INTEGER NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `descripcion` TEXT NOT NULL,
    `porcentaje_descuento` INTEGER NULL,
    `solo_primera_atencion` BOOLEAN NOT NULL DEFAULT false,
    `requiere_vacunas_al_dia` BOOLEAN NOT NULL DEFAULT false,
    `vigente_desde` DATE NOT NULL,
    `vigente_hasta` DATE NOT NULL,

    PRIMARY KEY (`id_promocion`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `usuario` ADD CONSTRAINT `usuario_id_clinica_fkey` FOREIGN KEY (`id_clinica`) REFERENCES `clinica`(`id_clinica`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cliente` ADD CONSTRAINT `cliente_id_clinica_fkey` FOREIGN KEY (`id_clinica`) REFERENCES `clinica`(`id_clinica`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cliente` ADD CONSTRAINT `cliente_id_usuario_fkey` FOREIGN KEY (`id_usuario`) REFERENCES `usuario`(`id_usuario`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mascota` ADD CONSTRAINT `mascota_id_cliente_fkey` FOREIGN KEY (`id_cliente`) REFERENCES `cliente`(`id_cliente`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `servicio` ADD CONSTRAINT `servicio_id_clinica_fkey` FOREIGN KEY (`id_clinica`) REFERENCES `clinica`(`id_clinica`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `horario_atencion` ADD CONSTRAINT `horario_atencion_id_clinica_fkey` FOREIGN KEY (`id_clinica`) REFERENCES `clinica`(`id_clinica`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dia_bloqueado` ADD CONSTRAINT `dia_bloqueado_id_clinica_fkey` FOREIGN KEY (`id_clinica`) REFERENCES `clinica`(`id_clinica`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `turno` ADD CONSTRAINT `turno_id_clinica_fkey` FOREIGN KEY (`id_clinica`) REFERENCES `clinica`(`id_clinica`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `turno` ADD CONSTRAINT `turno_id_mascota_fkey` FOREIGN KEY (`id_mascota`) REFERENCES `mascota`(`id_mascota`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `turno` ADD CONSTRAINT `turno_id_servicio_fkey` FOREIGN KEY (`id_servicio`) REFERENCES `servicio`(`id_servicio`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `turno` ADD CONSTRAINT `turno_id_veterinario_fkey` FOREIGN KEY (`id_veterinario`) REFERENCES `usuario`(`id_usuario`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `consulta` ADD CONSTRAINT `consulta_id_mascota_fkey` FOREIGN KEY (`id_mascota`) REFERENCES `mascota`(`id_mascota`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `consulta` ADD CONSTRAINT `consulta_id_veterinario_fkey` FOREIGN KEY (`id_veterinario`) REFERENCES `usuario`(`id_usuario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `consulta` ADD CONSTRAINT `consulta_id_turno_fkey` FOREIGN KEY (`id_turno`) REFERENCES `turno`(`id_turno`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `aplicacion_sanitaria` ADD CONSTRAINT `aplicacion_sanitaria_id_mascota_fkey` FOREIGN KEY (`id_mascota`) REFERENCES `mascota`(`id_mascota`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `aplicacion_sanitaria` ADD CONSTRAINT `aplicacion_sanitaria_id_consulta_fkey` FOREIGN KEY (`id_consulta`) REFERENCES `consulta`(`id_consulta`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recordatorio` ADD CONSTRAINT `recordatorio_id_cliente_fkey` FOREIGN KEY (`id_cliente`) REFERENCES `cliente`(`id_cliente`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recordatorio` ADD CONSTRAINT `recordatorio_id_usuario_fkey` FOREIGN KEY (`id_usuario`) REFERENCES `usuario`(`id_usuario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recordatorio` ADD CONSTRAINT `recordatorio_id_turno_fkey` FOREIGN KEY (`id_turno`) REFERENCES `turno`(`id_turno`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recordatorio` ADD CONSTRAINT `recordatorio_id_aplicacion_fkey` FOREIGN KEY (`id_aplicacion`) REFERENCES `aplicacion_sanitaria`(`id_aplicacion`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pregunta_frecuente` ADD CONSTRAINT `pregunta_frecuente_id_clinica_fkey` FOREIGN KEY (`id_clinica`) REFERENCES `clinica`(`id_clinica`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `promocion` ADD CONSTRAINT `promocion_id_clinica_fkey` FOREIGN KEY (`id_clinica`) REFERENCES `clinica`(`id_clinica`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `promocion` ADD CONSTRAINT `promocion_id_servicio_fkey` FOREIGN KEY (`id_servicio`) REFERENCES `servicio`(`id_servicio`) ON DELETE SET NULL ON UPDATE CASCADE;
