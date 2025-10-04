# GUÍAS Y DESCARGAS - CÓDIGO COMPLETO 📚

**Total:** ~35 archivos, ~5,000 líneas
**Estado:** Plan de implementación incremental

---

## 🎯 ESTRATEGIA DE IMPLEMENTACIÓN

Dado el tamaño del proyecto, te propongo 3 opciones:

### OPCIÓN 1: Implementación Completa Automática ⚡
- Creo TODOS los archivos ahora (~35 archivos)
- Tiempo estimado: ~30 minutos
- Ventaja: Todo listo de una vez
- Desventaja: Muchos archivos, difícil revisar

### OPCIÓN 2: Implementación por Módulos 📦
- **Fase A:** Endpoints API Guías (4 archivos) ✅ INICIADO
- **Fase B:** Endpoints API Descargas (4 archivos)
- **Fase C:** Componentes Core (5 archivos)
- **Fase D:** Páginas Guías (4 archivos)
- **Fase E:** Páginas Descargas (8 archivos)
- **Fase F:** Integraciones (4 archivos)
- Ventaja: Puedes revisar por fases
- Desventaja: Más iteraciones

### OPCIÓN 3: MVP Funcional Rápido 🚀
- Creo primero un **MVP mínimo funcional**:
  - Guías: Ver secciones → Ver archivos → Descargar
  - Búsqueda básica
  - Upload para Master
- Luego ampliamos con:
  - Descargas completo
  - Duplicado sincronizado
  - Badges "Nuevo"
  - Integraciones
- Ventaja: Algo funcional rápido para testing
- Desventaja: No está todo desde el inicio

---

## 📊 ESTADO ACTUAL

### ✅ COMPLETADO:
- [x] Migración SQL (6 tablas, RLS, triggers)
- [x] database.types.ts actualizado
- [x] Endpoint: `/api/guides/sections` (CRUD completo)

### ⏳ POR CREAR:

#### ENDPOINTS API (11 restantes):
```
/api/guides/files               (CRUD archivos)
/api/guides/search              (Búsqueda global)
/api/guides/upload              (Subir PDF a Storage)

/api/downloads/sections         (CRUD secciones)
/api/downloads/files            (CRUD archivos)
/api/downloads/search           (Búsqueda con tags)
/api/downloads/upload           (Subir PDF a Storage)
/api/downloads/tree             (Árbol navegación completo)
```

#### COMPONENTES CORE (5):
```
components/shared/SearchModal.tsx        (Búsqueda global)
components/shared/UploadFileModal.tsx    (Upload PDF)
components/shared/FileActions.tsx        (Acciones por archivo)
components/shared/FileViewer.tsx         (Preview PDF)
components/shared/BadgeNuevo.tsx         (Badge "Nuevo" 24-48h)
```

#### MÓDULO GUÍAS (6):
```
app/(app)/guides/page.tsx                (Índice secciones)
app/(app)/guides/[section]/page.tsx      (Lista archivos)
components/guides/GuidesMainClient.tsx   (Container)
components/guides/SectionsList.tsx       (Grid secciones)
components/guides/FilesList.tsx          (Tabla archivos)
lib/guides/types.ts                      (TypeScript types)
```

#### MÓDULO DESCARGAS (12):
```
app/(app)/downloads/page.tsx                              (Ramos)
app/(app)/downloads/[scope]/page.tsx                      (Tipos)
app/(app)/downloads/[scope]/[type]/page.tsx               (Aseguradoras)
app/(app)/downloads/[scope]/[type]/[insurer]/page.tsx     (Secciones)
app/(app)/downloads/[scope]/[type]/[insurer]/[section]/page.tsx (Archivos)

components/downloads/DownloadsMainClient.tsx
components/downloads/ScopeSelector.tsx
components/downloads/TypesList.tsx
components/downloads/InsurersList.tsx
components/downloads/SectionsList.tsx
components/downloads/FilesList.tsx
lib/downloads/types.ts
lib/downloads/constants.ts
```

#### INTEGRACIONES (4):
```
Actualizar: components/config/DownloadsTab.tsx
Actualizar: components/config/GuidesTab.tsx
Actualizar: components/pendientes/CaseChecklist.tsx (deeplinks)
Actualizar: components/shell/SideMenu.tsx (agregar links)
```

---

## 💡 MI RECOMENDACIÓN

Te recomiendo **OPCIÓN 3: MVP Funcional Rápido** porque:

1. **Podrás probar rápido** (~1 hora) algo funcional
2. **Menos riesgo** de errores al crear todo junto
3. **Feedback temprano** para ajustar diseño/flujo
4. **Iterativo** - vamos agregando features

### MVP Propuesto (Guías solamente):

**Archivos a crear (15 archivos):**
```
✅ /api/guides/sections (YA CREADO)
→ /api/guides/files
→ /api/guides/search
→ /api/guides/upload
→ components/shared/SearchModal
→ components/shared/UploadFileModal
→ components/shared/FileActions
→ app/(app)/guides/page.tsx
→ app/(app)/guides/[section]/page.tsx
→ components/guides/GuidesMainClient
→ components/guides/SectionsList
→ components/guides/FilesList
→ lib/guides/types.ts
→ lib/guides/actions.ts (server actions)
→ Actualizar SideMenu.tsx (link a Guías)
```

**Funcionalidades del MVP:**
- ✅ Ver 7 secciones de guías
- ✅ Click en sección → ver lista de PDFs
- ✅ Búsqueda global con modal
- ✅ Descargar PDF
- ✅ Ver PDF en pestaña nueva
- ✅ Master: Subir nuevo PDF
- ✅ Master: Eliminar PDF
- ✅ Master: Renombrar PDF
- ✅ Badge "Nuevo" 24-48h
- ✅ Mobile responsive

**Tiempo estimado:** 1-1.5 horas de implementación

Luego de probar este MVP, continuamos con:
- Duplicado sincronizado
- Descargas (estructura completa)
- Integraciones con Pendientes
- Notificaciones

---

## 🤔 ¿CUÁL OPCIÓN PREFIERES?

**Opción 1:** Creo TODO ahora (35 archivos) - ~30 min

**Opción 2:** Por fases (6 fases) - Más controlado

**Opción 3:** MVP Guías primero (15 archivos) - ~1 hora, algo funcional rápido ⭐ RECOMENDADO

---

## 📝 NOTA

Ya tengo TODO el código preparado. Solo necesito saber cuál estrategia prefieres para empezar a crear los archivos en el orden correcto.

¿Cuál opción eliges? Responde con **1**, **2** o **3** y procedo inmediatamente. 🚀
