# Configuración de Twilio para WhatsApp — Líderes en Seguros

## Requisitos Previos

1. Cuenta de Twilio activa
2. Número de WhatsApp aprobado (o usar Sandbox para pruebas)
3. Dominio del portal desplegado (ej: `portal.lideresenseguros.com`)

---

## Paso 1: Variables de Entorno

Agregar las siguientes variables en Vercel (o `.env.local` para desarrollo):

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_NUMBER=whatsapp:+1415XXXXXXX
```

- `TWILIO_ACCOUNT_SID`: Se encuentra en el Dashboard de Twilio
- `TWILIO_AUTH_TOKEN`: Se encuentra en el Dashboard de Twilio (click "Show")
- `TWILIO_WHATSAPP_NUMBER`: Tu número de WhatsApp Business aprobado (formato: `whatsapp:+XXXXXXXXXXX`)

---

## Paso 2: Configurar Webhook en Twilio

### Para Sandbox (Pruebas)

1. Ir a [Twilio Console](https://console.twilio.com/)
2. Navegar a **Messaging** → **Try it out** → **Send a WhatsApp message**
3. En la sección **Sandbox Settings**:
   - En **WHEN A MESSAGE COMES IN**, pegar:
     ```
     https://portal.lideresenseguros.com/api/whatsapp
     ```
   - Método: **POST**
4. Guardar cambios

### Para Producción (Número Aprobado)

1. Ir a [Twilio Console](https://console.twilio.com/)
2. Navegar a **Messaging** → **Senders** → **WhatsApp senders**
3. Seleccionar tu número
4. En **Webhook URL for incoming messages**:
   ```
   https://portal.lideresenseguros.com/api/whatsapp
   ```
5. Método: **HTTP POST**
6. Guardar

---

## Paso 3: Probar

### Con Sandbox

1. Envía el mensaje de unión al Sandbox (ej: `join <código>`) al número de Sandbox
2. Una vez conectado, envía cualquier mensaje de prueba
3. Deberías recibir respuesta del asistente

### Con Producción

1. Envía un mensaje al número de WhatsApp Business configurado
2. Verifica la respuesta
3. Revisa los logs en Vercel

---

## Paso 4: Verificar Logs

Los logs de interacciones se guardan en la tabla `chat_interactions` de Supabase.

Para revisar:
```sql
SELECT * FROM chat_interactions 
WHERE channel = 'whatsapp' 
ORDER BY created_at DESC 
LIMIT 20;
```

---

## Seguridad

### Validación de Firma Twilio

El endpoint `/api/whatsapp` valida automáticamente la firma de Twilio usando el header `X-Twilio-Signature` y el `TWILIO_AUTH_TOKEN`.

Si `TWILIO_AUTH_TOKEN` no está configurado, la validación se omite (solo para desarrollo).

### Rate Limiting

Se aplica un límite de **20 mensajes por minuto por número de teléfono**.

### Sanitización

- Los mensajes se limpian de caracteres nulos
- Se limitan a 2000 caracteres máximo
- No se expone información sensible sin verificación de identidad

---

## Intenciones Soportadas

| Intención | Descripción | Acción |
|-----------|-------------|--------|
| COTIZAR | Quiere cotizar seguro | Link al cotizador |
| PORTAL | Acceso al portal | Link al portal |
| COBERTURA_GENERAL | Pregunta de coberturas | Respuesta IA general |
| POLIZA_ESPECIFICA | Info de su póliza | Verifica identidad → datos |
| EMERGENCIA | Emergencia/siniestro | Número de emergencias |
| CONTACTO_ASEGURADORA | Datos de aseguradora | Busca en DB |
| QUEJA | Reclamo | Respuesta empática |
| EXTREMO | Amenaza legal/denuncia | Escala + email urgente |
| OTRO | Otro | Respuesta IA general |

---

## Escalamiento Automático

Si se detecta un caso **EXTREMO** (palabras como "demanda", "superintendencia", "abogado", "fraude"):

1. Se marca `escalated = true` en la DB
2. Se envía email urgente a `contacto@lideresenseguros.com`
3. Se responde al cliente que un supervisor lo contactará

---

## Troubleshooting

### No recibo respuestas

1. Verificar que `TWILIO_AUTH_TOKEN` y `TWILIO_ACCOUNT_SID` son correctos
2. Verificar que el webhook URL es accesible públicamente
3. Revisar logs en Vercel (`Functions` tab)

### Error 403 en webhook

La firma de Twilio no es válida. Verificar:
- `TWILIO_AUTH_TOKEN` es el correcto
- El URL del webhook coincide exactamente con el configurado en Twilio

### Vertex AI no responde

Verificar:
- `GOOGLE_APPLICATION_CREDENTIALS_JSON` está configurado
- `GOOGLE_CLOUD_PROJECT_ID` está configurado
- `FEATURE_ENABLE_VERTEX=true` (si aplica)

---

## Arquitectura

```
Twilio → POST /api/whatsapp → chatProcessor → Vertex AI (Gemini)
                                  ↓                    ↓
                              Supabase            Intent Classification
                          (clients, policies,         ↓
                       insurance_companies)     Response Generation
                                  ↓                    ↓
                          chat_interactions      Twilio REST API
                              (logging)           (send reply)
```
