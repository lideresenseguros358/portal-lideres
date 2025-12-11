# 🚀 Configurar iLovePDF en Vercel

## ✅ PASO A PASO COMPLETO

### **1. Acceder a Configuración de Variables de Entorno**

Ve a esta URL directamente:
```
https://vercel.com/lideresenseguros358/portal-lideres/settings/environment-variables
```

O navega manualmente:
1. Ve a: https://vercel.com
2. Click en tu proyecto: **portal-lideres**
3. Click en pestaña **Settings**
4. Click en **Environment Variables** (menú izquierdo)

---

### **2. Agregar Primera Variable (Public Key)**

Click en **"Add New"** o **"Add Environment Variable"**

**Configuración:**
- **Key:** `ILOVEPDF_PUBLIC_KEY`
- **Value:** 
  ```
  project_public_1d9f7d5460971c7e15117df44c04f5d4_2ArA3b3d751b46f07bb511504f68a04147a03
  ```
- **Environments:** 
  - ✅ **Production** (marcar checkbox)
  - ✅ **Preview** (marcar checkbox)
  - ✅ **Development** (marcar checkbox)

Click en **"Save"**

---

### **3. Agregar Segunda Variable (Secret Key)**

Click nuevamente en **"Add New"**

**Configuración:**
- **Key:** `ILOVEPDF_SECRET_KEY`
- **Value:** 
  ```
  secret_key_f5a32b90f9cc02354a3885e5b471468a_zSdIh0bc0ac4cf06b058d77c510bedf09594e
  ```
- **Environments:** 
  - ✅ **Production** (marcar checkbox)
  - ✅ **Preview** (marcar checkbox)
  - ✅ **Development** (marcar checkbox)

Click en **"Save"**

---

### **4. Verificar que las Variables están Configuradas**

Deberías ver en la lista:

| **Name** | **Value** | **Environments** |
|----------|-----------|------------------|
| `ILOVEPDF_PUBLIC_KEY` | `project_public_1d9f7d54...` | Production, Preview, Development |
| `ILOVEPDF_SECRET_KEY` | `secret_key_f5a32b90f9...` | Production, Preview, Development |

---

### **5. IMPORTANTE: Redeploy la Aplicación**

Las variables de entorno **NO se aplican automáticamente** a deployments existentes.
**Debes hacer un redeploy:**

#### **Opción A: Redeploy Manual (RECOMENDADO)**

1. Ve a: https://vercel.com/lideresenseguros358/portal-lideres/deployments
2. Click en el **deployment más reciente** (el primero de la lista)
3. Click en el botón **"⋮"** (3 puntos verticales) en la esquina superior derecha
4. Click en **"Redeploy"**
5. **IMPORTANTE:** **DESMARCA** el checkbox **"Use existing Build Cache"**
6. Click en **"Redeploy"** nuevamente para confirmar

#### **Opción B: Push al Repositorio (automático)**

Si prefieres, simplemente haz push de cualquier cambio al repo:
```bash
git add .
git commit -m "docs: agregar configuración de iLovePDF"
git push
```

Vercel deployará automáticamente con las nuevas variables.

---

### **6. Esperar que el Deployment Termine**

- El deployment tomará **2-3 minutos**
- Verás el progreso: **Building** → **Checks** → **✅ Ready**
- Cuando diga **"Ready"** con check verde, está listo

---

### **7. Verificar que Funciona**

1. Ve a: https://portal.lideresenseguros.com
2. Navega a: **Comisiones** → **Nueva Quincena** → **Importar**
3. Sube tu **PDF de ANCON**
4. Deberías ver el proceso de conversión automática

**Logs esperados en Vercel:**
```
[iLovePDF] ✅ Credenciales encontradas
[iLovePDF] Public Key: project_public_1d9f7d5460...
[iLovePDF] Obteniendo token de autenticación...
[iLovePDF] ✅ Token obtenido
[iLovePDF] Iniciando tarea pdftoxls...
[iLovePDF] ✅ Tarea iniciada: xxxxxxx
[iLovePDF] Subiendo archivo PDF...
[iLovePDF] ✅ Archivo subido: document.pdf
[iLovePDF] Procesando conversión...
[iLovePDF] ✅ Conversión completada
[iLovePDF] Archivo de salida: converted.xlsx
[iLovePDF] Tamaño de salida: XXXXX bytes
[iLovePDF] Descargando archivo Excel...
[iLovePDF] ✅ Excel descargado exitosamente
[iLovePDF] Tamaño final: XXXXX bytes
[PDF→EXCEL] ✅ Excel generado: XXXXX bytes
[PDF→EXCEL] ✅ Datos extraídos: XX filas
[PDF→EXCEL] ✅ Texto generado: XXXX caracteres
```

---

## 🔍 Ver Logs en Tiempo Real

Para ver los logs del deployment:

1. Ve a: https://vercel.com/lideresenseguros358/portal-lideres/deployments
2. Click en el deployment activo (el más reciente)
3. Click en la pestaña **"Functions"**
4. Click en cualquier función (ej: `/api/commissions/...`)
5. Verás los logs en tiempo real

---

## ⚠️ Solución de Problemas

### **Error: "iLovePDF API no está configurada"**

**Causa:** Las variables no están en Vercel o no se aplicaron

**Solución:**
1. Verifica que ambas variables estén en Settings → Environment Variables
2. Verifica que tengan los 3 checkboxes marcados (Production, Preview, Development)
3. Haz un nuevo redeploy (sin cache)

---

### **Error: "Credenciales de iLovePDF inválidas"**

**Causa:** Las claves están mal copiadas

**Solución:**
1. Edita las variables en Vercel
2. Verifica que no haya espacios al inicio/final
3. Copia nuevamente las claves:
   - Public: `project_public_1d9f7d5460971c7e15117df44c04f5d4_2ArA3b3d751b46f07bb511504f68a04147a03`
   - Secret: `secret_key_f5a32b90f9cc02354a3885e5b471468a_zSdIh0bc0ac4cf06b058d77c510bedf09594e`
4. Redeploy

---

### **Error: "Límite de conversiones alcanzado"**

**Causa:** Alcanzaste el límite de 250 conversiones/mes

**Solución:**
- **Opción 1:** Esperar hasta el próximo mes (se resetea automáticamente)
- **Opción 2:** Actualizar plan en: https://www.ilovepdf.com/pricing
  - **Starter:** $6/mes - 1,000 archivos
  - **Business:** $24/mes - 5,000 archivos

Monitorea tu uso en: https://developer.ilovepdf.com/user/projects

---

## 📊 Límites del Plan Gratuito

- ✅ **250 conversiones/mes**
- ✅ Archivos hasta **15 MB**
- ✅ PDFs hasta **100 páginas**
- ✅ Conversión automática a Excel

---

## ✅ Checklist Final

Antes de probar, asegúrate de que:

- [ ] Ambas variables están en Vercel (ILOVEPDF_PUBLIC_KEY y ILOVEPDF_SECRET_KEY)
- [ ] Ambas tienen los 3 checkboxes marcados (Production, Preview, Development)
- [ ] Hiciste un redeploy **sin cache**
- [ ] El deployment terminó exitosamente (✅ Ready)
- [ ] Probaste subir un PDF en: https://portal.lideresenseguros.com

---

## 🎉 ¡Listo!

Ahora tu portal puede convertir PDFs de ANCON automáticamente a Excel sin intervención manual.

**Flujo automático:**
```
PDF subido → iLovePDF API → Excel → Extracción de datos → Mapeo de comisiones → ✅ Listo
```

Sin necesidad de conversiones manuales ni herramientas externas.
