# Twilio WhatsApp — ADM COT Chats Setup

## Resumen

El sistema ADM COT Chats integra WhatsApp vía Twilio para recibir y enviar mensajes.
Los mensajes entrantes pasan por un pipeline:

```
WhatsApp → Twilio → POST /api/whatsapp → Chat Engine → Vertex AI (classify + reply) → Twilio → WhatsApp
```

---

## 1. Variables de Entorno Requeridas

```env
# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_NUMBER=whatsapp:+15075551234

# Webhook
WHATSAPP_WEBHOOK_URL=https://portal.lideresenseguros.com/api/whatsapp
SKIP_TWILIO_SIGNATURE=false

# Vertex AI (Gemini)
GOOGLE_APPLICATION_CREDENTIALS_JSON={"type":"service_account",...}
GOOGLE_CLOUD_PROJECT_ID=thinking-device-471822-e6
GOOGLE_CLOUD_LOCATION=us-central1
VERTEX_MODEL_CHAT=gemini-2.0-flash

# ZeptoMail (Escalation Emails)
ZEPTO_API_KEY=Zoho-encrtoken-xxxxxxx
ZEPTO_SENDER=portal@lideresenseguros.com
ZEPTO_SENDER_NAME=Líderes en Seguros

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx

# App
NEXT_PUBLIC_APP_URL=https://portal.lideresenseguros.com
```

---

## 2. Configuración en Twilio Console

1. Ir a **Twilio Console** → **Messaging** → **WhatsApp senders**
2. Configurar el número WhatsApp Business
3. En **Webhook URL** para mensajes entrantes:
   ```
   https://portal.lideresenseguros.com/api/whatsapp
   ```
   - Método: **POST**
   - Content-Type: `application/x-www-form-urlencoded`
4. Dejar el Status Callback URL vacío (no necesario)

---

## 3. Validación de Firma Twilio

El endpoint valida la firma HMAC-SHA1 de Twilio usando `TWILIO_AUTH_TOKEN`.

**Si las firmas fallan:**
- Verificar que `TWILIO_AUTH_TOKEN` sea el token correcto (no el API Key SID)
- Verificar que `WHATSAPP_WEBHOOK_URL` coincida exactamente con la URL configurada en Twilio
- Temporalmente: `SKIP_TWILIO_SIGNATURE=true` (solo para debugging)

---

## 4. Base de Datos

Ejecutar el migration SQL antes de activar:

```bash
# En Supabase SQL Editor, ejecutar:
MIGRATION_CHAT_THREADS.sql
```

Esto crea las tablas:
- `chat_threads` — Hilos de conversación
- `chat_messages` — Mensajes individuales
- `chat_events` — Auditoría
- `portal_notifications` — Notificaciones para masters

---

## 5. Flujo de Mensajes

### Mensaje Entrante (WhatsApp → Portal)

1. Twilio envía POST a `/api/whatsapp`
2. Se valida firma y rate limit (20 msg/min por teléfono)
3. `processInboundMessage()`:
   - Upsert thread (busca thread abierto o crea nuevo)
   - Guarda mensaje inbound en `chat_messages`
   - Clasifica con Vertex AI → category, severity, tags, summary
   - Actualiza thread con clasificación
   - Si **urgent**: escalamiento automático (email + notificación)
   - Si **ai_enabled=true**: genera respuesta con Vertex AI → guarda en chat_messages
4. Si hay AI reply → envía vía Twilio REST API
5. Retorna TwiML vacío a Twilio

### Mensaje Manual (Portal → WhatsApp)

1. Master escribe en el chat view → POST `/api/chats/send`
2. Guarda mensaje outbound en `chat_messages`
3. Envía vía Twilio REST API
4. Actualiza thread

### Asignación

- **Asignar a Master**: POST `/api/chats/assign` → desactiva AI → notifica master
- **Reasignar a LISSA AI**: POST `/api/chats/assign` con `assign_to: 'ai'` → reactiva AI

---

## 6. Escalamiento Urgente

Cuando Vertex AI clasifica un mensaje como `category: 'urgent'`:

1. Thread status → `urgent`
2. Email enviado a `contacto@lideresenseguros.com` vía ZeptoMail API (3 reintentos)
3. Portal notification creada para todos los masters
4. Si email falla → notificación adicional de alerta
5. Evento `escalated` registrado en `chat_events`

---

## 7. Pruebas

### Test Básico
```
WhatsApp → "Hola, ¿cuánto cuesta un seguro de auto?"
Esperado: LISSA AI responde con info de cotizador, category=lead
```

### Test Urgente
```
WhatsApp → "Voy a denunciarlos ante la Superintendencia, esto es un fraude"
Esperado: category=urgent, severity=high, email enviado, notificación creada
```

### Test Asignación
```
1. Abrir chat en portal → Config → "Asignarme"
2. Enviar mensaje desde WhatsApp
Esperado: NO hay respuesta automática (AI desactivada)
3. Escribir respuesta manual en portal
Esperado: Mensaje llega al WhatsApp del cliente
4. Config → "Reasignar a LISSA AI"
5. Enviar mensaje desde WhatsApp
Esperado: LISSA AI responde automáticamente
```

---

## 8. Troubleshooting

| Problema | Solución |
|----------|----------|
| Firma inválida | Verificar `TWILIO_AUTH_TOKEN` y `WHATSAPP_WEBHOOK_URL` |
| No responde AI | Verificar `GOOGLE_APPLICATION_CREDENTIALS_JSON` y que el modelo esté habilitado |
| Email no llega | Verificar `ZEPTO_API_KEY` y logs en `chat_events` (event_type=email_failed) |
| Mensajes duplicados | Deduplicación por `MessageSid` — verificar que Twilio envíe `MessageSid` |
| Rate limited | Máximo 20 mensajes por minuto por teléfono |
