-- Fix chat_messages provider CHECK constraint to allow 'whatsapp_cloud' (replacing 'twilio')
-- The old constraint only allowed: 'twilio', 'portal', 'system'

ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_provider_check;

ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_provider_check
  CHECK (provider IN ('whatsapp_cloud', 'portal', 'system', 'twilio'));

-- Also update any existing 'twilio' records to 'whatsapp_cloud'
UPDATE chat_messages SET provider = 'whatsapp_cloud' WHERE provider = 'twilio';
