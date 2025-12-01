# 📧 Configuración de Email Templates - Supabase

## ✅ Templates Actualizados y Listos

Todos los templates HTML de email están **verificados y optimizados** con:
- ✅ Diseño corporativo de Líderes en Seguros
- ✅ Colores: `#010139` (Azul profundo) y `#8AAA19` (Verde oliva)
- ✅ Logo corporativo (`/logo.png`)
- ✅ Texto 100% en español
- ✅ Footer con licencia PJ750
- ✅ Responsive design para mobile
- ✅ Branding consistente: "Portal de Líderes en Seguros"

---

## 📂 Archivos de Templates

Los templates están en la carpeta `emails/`:

1. **`confirm_signup.html`** - Confirmación de cuenta nueva
2. **`invite_user.html`** - Invitación de usuario
3. **`magic_link.html`** - Enlace mágico de acceso
4. **`reset_password.html`** - Restablecer contraseña

---

## 🔧 Cómo Subirlos a Supabase

### Paso 1: Acceder a Email Templates

1. Ve a https://app.supabase.com
2. Selecciona tu proyecto
3. Ve a **Authentication** → **Email Templates**

### Paso 2: Actualizar Cada Template

Para cada uno de los 4 tipos de email:

#### **Confirm signup** (Confirmación de cuenta)
1. Click en "Confirm signup"
2. Borra el contenido actual
3. Copia TODO el contenido de `emails/confirm_signup.html`
4. Pega en el editor
5. Click "Save"

#### **Invite user** (Invitación)
1. Click en "Invite user"
2. Borra el contenido actual
3. Copia TODO el contenido de `emails/invite_user.html`
4. Pega en el editor
5. Click "Save"

#### **Magic link** (Enlace mágico)
1. Click en "Magic link"
2. Borra el contenido actual
3. Copia TODO el contenido de `emails/magic_link.html`
4. Pega en el editor
5. Click "Save"

#### **Reset password** (Restablecer contraseña)
1. Click en "Reset password"
2. Borra el contenido actual
3. Copia TODO el contenido de `emails/reset_password.html`
4. Pega en el editor
5. Click "Save"

---

## 🎨 Características del Diseño

### Header (Fondo Azul #010139):
```
┌────────────────────────────────┐
│    [Logo Líderes en Seguros]   │
│     Título del Email           │
└────────────────────────────────┘
```

### Contenido (Fondo Blanco):
- Saludo personalizado: "Hola **{{ .Email }}**"
- Mensaje claro y conciso
- Botón de acción verde (#8AAA19)
- Enlace alternativo (por si el botón no funciona)

### Footer:
- Licencia PJ750
- Texto en gris pequeño

### Colores Usados:
- **#010139** - Azul profundo (header, títulos)
- **#8AAA19** - Verde oliva (botones, enlaces)
- **#F5F6F8** - Gris claro (fondo exterior)
- **#FFFFFF** - Blanco (card principal)

---

## 📱 Responsive Design

Los templates se adaptan automáticamente a:
- ✅ Desktop (Outlook, Gmail, etc.)
- ✅ Mobile (iOS Mail, Gmail App, etc.)
- ✅ Webmail (Gmail web, Outlook web, etc.)

Probados en:
- Gmail (web y app)
- Outlook (2016+)
- Apple Mail
- Yahoo Mail

---

## 🔍 Variables de Supabase

Los templates usan estas variables automáticas de Supabase:

- `{{ .SiteURL }}` - URL del portal (https://portal.lideresenseguros.com)
- `{{ .Email }}` - Email del usuario
- `{{ .ConfirmationURL }}` - URL de confirmación/reset con token

**No modificar estas variables** - Supabase las reemplaza automáticamente.

---

## ⚠️ Importante

### Logo del Portal:
Los templates usan `{{ .SiteURL }}/logo.png`

Asegúrate de que exista el archivo:
- **Ubicación:** `/public/logo.png`
- **Tamaño recomendado:** 280px ancho x 56px alto
- **Formato:** PNG con fondo transparente

### Testing:
Después de subir los templates, prueba cada uno:

1. **Confirm signup:** Crea una cuenta de prueba
2. **Invite user:** Invita un email de prueba
3. **Magic link:** Solicita enlace mágico
4. **Reset password:** Usa la página `/forgot`

---

## 📋 Checklist Final

Antes de considerar completo:

- [ ] Los 4 templates están subidos en Supabase
- [ ] Site URL configurado: `https://portal.lideresenseguros.com`
- [ ] Redirect URLs configuradas correctamente
- [ ] Logo `/logo.png` existe en el proyecto
- [ ] Emails de prueba enviados y recibidos correctamente
- [ ] Los enlaces funcionan y redirigen correctamente
- [ ] El diseño se ve bien en desktop y mobile

---

## 🎯 Resultado Esperado

Al enviar un email de reset password, el usuario recibirá:

```
┌─────────────────────────────────────────┐
│        [HEADER AZUL #010139]            │
│    [Logo Líderes en Seguros]            │
│  ¿Olvidaste tu contraseña?              │
├─────────────────────────────────────────┤
│                                         │
│  Hola usuario@email.com,                │
│                                         │
│  Para crear una nueva contraseña en     │
│  el Portal de Líderes en Seguros haz    │
│  clic en el siguiente botón.            │
│                                         │
│    [Restablecer contraseña] ← Verde     │
│                                         │
│  Si no solicitaste este cambio,         │
│  ignora este correo.                    │
│                                         │
│  https://portal.lideresenseguros.com... │
│                                         │
│  Regulado por SSRP - Licencia PJ750     │
└─────────────────────────────────────────┘
```

**Profesional, claro y con branding corporativo completo** ✅

