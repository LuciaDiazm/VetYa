-- Cliente que ya no viene: deja de aparecer en los avisos, pero no se borra.
ALTER TABLE `cliente` ADD COLUMN `activo` BOOLEAN NOT NULL DEFAULT true;
