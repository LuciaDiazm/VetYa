-- Quién canceló cada turno y cuándo (para el historial y la regla de abuso).
ALTER TABLE `turno` ADD COLUMN `cancelado_en` DATETIME(3) NULL,
    ADD COLUMN `cancelado_por` ENUM('DUENIO', 'CLINICA') NULL;

-- Suspensión para sacar turnos por la web (la clínica la revisa y decide).
ALTER TABLE `cliente` ADD COLUMN `suspendido_hasta` DATETIME(3) NULL,
    ADD COLUMN `suspension_motivo` VARCHAR(191) NULL,
    ADD COLUMN `suspension_revisada` BOOLEAN NOT NULL DEFAULT true;

-- Reglas que la clínica puede cambiar en Configuración.
ALTER TABLE `clinica` ADD COLUMN `limite_cancelaciones` INTEGER NOT NULL DEFAULT 3,
    ADD COLUMN `dias_cancelaciones` INTEGER NOT NULL DEFAULT 7,
    ADD COLUMN `dias_suspension` INTEGER NOT NULL DEFAULT 30,
    ADD COLUMN `max_turnos_online` INTEGER NOT NULL DEFAULT 3;
