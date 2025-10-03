# Paso 4 · Autenticación con Supabase + SMTP Zoho

## Variables locales

- `NEXT_PUBLIC_SITE_URL=http://localhost:3000` (debe existir en `.env.local`).
- `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` ya definidos.
- `SUPABASE_SERVICE_ROLE_KEY=` (placeholder solo para pruebas locales; no exponer en cliente).

## Ajustes en Supabase (configurar manualmente)

1. **Auth → URL de redirección**
   - Añadir `http://localhost:3000/auth/callback`.
   - Añadir `https://<mi-dominio>/auth/callback` para producción.
2. **Confirmación de email**
   - Mantener activado si se requiere verificación explícita.
   - Si se desea magic-link inmediato, desactivar “Confirm email”. 
   - Documentar la elección final antes de despliegue.

## SMTP Zoho (Custom SMTP)

- **Host**: `smtp.zoho.com`
- **Puerto**: `587` (STARTTLS) o `465` (SSL)
- **Username**: correo remitente completo (ej. `notificaciones@midominio.com`).
- **Password**: contraseña de aplicación creada en Zoho Mail.
- **From email/name**: usar el mismo correo remitente y "LISSA Portal" como nombre.
- **TLS**: habilitar "Enforce TLS".

### SPF / DKIM

1. Configurar registros SPF con el valor sugerido por Zoho (`v=spf1 include:zoho.com ~all`).
2. Añadir registros DKIM proporcionados por Zoho (3 CNAME).
3. Verificar en Zoho Mail que ambos estén activos antes de habilitar envío.

## Plantillas (GoTrue v2 placeholders)

Los cuerpos HTML deben utilizar las variables:
- `{{ .SiteURL }}`
- `{{ .Email }}`
- `{{ .Token }}`
- `{{ .ConfirmationURL }}`
- `{{ .EmailChangeURL }}`

## Invitaciones (API Admin)

Endpoint (una vez habilitado): `POST /api/auth/invite`

```bash
curl -X POST http://localhost:3000/api/auth/invite \
  -H "Content-Type: application/json" \
  -H "x-master-token: <token>" \
  -d '{ "email": "usuario@ejemplo.com" }'
```

En producción usar dominio HTTPS y key segura.

## Notas

- El envío de prueba se realiza desde Supabase Dashboard → Auth → SMTP → “Send test email”.
- Configurar el portal para que `/auth/callback` procese magic links y recovery.
