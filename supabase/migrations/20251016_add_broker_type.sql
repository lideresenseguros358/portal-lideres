-- Migration: Add broker_type to brokers table
-- Descripción: Agrega campo para distinguir entre Corredor y Agente

-- Crear enum para tipo de broker
CREATE TYPE broker_type_enum AS ENUM ('corredor', 'agente');

-- Agregar columna broker_type a la tabla brokers
ALTER TABLE brokers 
ADD COLUMN broker_type broker_type_enum DEFAULT 'corredor';

-- Comentario para documentar el campo
COMMENT ON COLUMN brokers.broker_type IS 'Tipo de broker: corredor (muestra licencia) o agente (muestra código ASSA y carnet)';

-- Por defecto, todos los brokers existentes serán 'corredor'
-- Los administradores pueden cambiar esto según corresponda
