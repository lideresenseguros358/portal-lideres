# 📋 MÓDULO DE CASOS/PENDIENTES - RESUMEN EJECUTIVO

## 🎯 ¿Qué es?

Sistema completo de gestión de trámites de seguros con:
- Ingesta automática desde correo (Zoho webhook)
- Clasificación inteligente sin IA (keywords)
- Checklist dinámico según tipo de póliza
- SLA con semáforo automático
- Generación de PDF y envío por correo
- Gestión de pagos a corredores
- Creación de registros preliminares en BD

---

## 📚 Documentación Completa

Ubicación: `docs/casos/`

### Archivos:

1. **[00_INDICE_MODULO_CASOS.md](./docs/casos/00_INDICE_MODULO_CASOS.md)**  
   📑 Índice maestro y resumen ejecutivo

2. **[01_REQUISITOS_DOCUMENTOS.md](./docs/casos/01_REQUISITOS_DOCUMENTOS.md)**  
   📋 Documentos requeridos por tipo de trámite  
   - Ramo Personas (Vida, Salud, AP, Colectivos)
   - Ramos Generales (Auto, Incendio, RC, etc.)
   - Diferentes trámites (Rehabilitación, Modificación, etc.)

3. **[02_FLUJO_MODULO_CASOS.md](./docs/casos/02_FLUJO_MODULO_CASOS.md)**  
   🔄 Flujo completo y páginas  
   - Reglas globales (roles, ASSA, preliminar BD)
   - `/cases` - Lista de casos
   - `/cases/new` - Wizard creación
   - `/cases/[id]` - Detalle del caso

4. **[03_INGESTA_CORREO_Y_APIS.md](./docs/casos/03_INGESTA_CORREO_Y_APIS.md)**  
   📧 Webhook de Zoho y endpoints API  
   - Procesamiento de correos (9 pasos)
   - Clasificación determinista
   - APIs completas del módulo

5. **[04_SLA_NOTIFICACIONES_PDF.md](./docs/casos/04_SLA_NOTIFICACIONES_PDF.md)**  
   ⏱️ SLA, notificaciones y PDF  
   - Semáforo (🟢🟡🔴)
   - Notificaciones (campanita + email 7AM)
   - Generación de PDF con branding

6. **[05_ESPECIFICACIONES_TECNICAS_Y_QA.md](./docs/casos/05_ESPECIFICACIONES_TECNICAS_Y_QA.md)**  
   🛠️ Base de datos, RLS y QA  
   - Estructura de tablas
   - Políticas RLS
   - Componentes UI
   - Criterios de aceptación (checklist completo)

---

## 🔑 Conceptos Clave

### 1. NO usar IA
**Clasificación determinista con keywords.**

```typescript
const KEYWORDS = {
  'ASSA': ['assa', 'assa compañía'],
  'COTIZACION': ['cotizar', 'cotización', 'cot.'],
  // ...
};
```

---

### 2. Flujo ASSA

```
1. Correo sin ticket → Crea caso
2. ASSA responde con ticket → Asocia al caso
3. Sugiere estado → Humano confirma ✅
```

⚠️ **Nunca automático**, siempre confirmar.

---

### 3. Emisión → Preliminar BD

```
Al marcar EMITIDO:
1. Validar policy_number ✓
2. Si NO en BD Y NO es VIDA ASSA WEB:
   → Popup a Master
   → ¿Crear preliminar?
3. Si SÍ:
   → Crea client/policy preliminar
   → Notifica broker para completar
```

---

### 4. Checklist Dinámico

Se autogenera según:
- Tipo de póliza
- Gestión (cotizar/emitir/etc.)
- Aseguradora

**Fuente:** `01_REQUISITOS_DOCUMENTOS.md`

**Funciones:**
- Reordenable
- Ad-hoc items
- "OTROS" categoría
- Marcar cumplido sin archivo (Master)

---

### 5. SLA Semáforo

| Estado | Días | Color | Acción |
|--------|------|-------|--------|
| En tiempo | > 5 | 🟢 | - |
| Por vencer | 0-5 | 🟡 | Notifica diario |
| Vencido | < 0 | 🔴 | Notifica urgente |
| Auto-limpieza | < 0 + 7d sin update | 🗑️ | A Papelera |

---

### 6. Permisos (RLS)

| Acción | MASTER | BROKER |
|--------|:------:|:------:|
| Ver todos | ✅ | ❌ |
| Crear manual | ✅ | ❌ |
| Cambiar estado | ✅ | ❌ |
| Reclasificar | ✅ | ❌ |
| Fusionar | ✅ | ❌ |
| Eliminar archivos | ✅ | ❌ |
| Adjuntar | ✅ | ✅* |
| Comentar | ✅ | ✅* |
| Marcar checklist | ✅ | ✅* |

*Solo sus casos

---

## 🛠️ Stack Técnico

- **Frontend:** Next.js 15, React, TypeScript, Tailwind
- **Backend:** Next.js API Routes, Supabase (PostgreSQL + Storage)
- **Integraciones:** Zoho Mail webhook
- **PDF:** jsPDF + jspdf-autotable
- **Seguridad:** RLS (Row Level Security)

---

## 📦 Entregables Principales

### Base de Datos
- 6 tablas nuevas
- Políticas RLS
- Índices y triggers

### Páginas
- `/cases` - Lista (tabs, filtros, kanban)
- `/cases/new` - Wizard 5 pasos
- `/cases/[id]` - Detalle (6 paneles)

### APIs
- 15 endpoints
- Webhook Zoho
- PDF generator

### Utilidades
- Clasificador keywords
- Detector ticket ASSA
- Sistema notificaciones
- Cron jobs (limpieza, email diario)

---

## ✅ Checklist Mínimo para Go-Live

- [ ] Migraciones SQL ejecutadas
- [ ] Webhook Zoho configurado
- [ ] API `/api/zoho/webhook` funcionando
- [ ] Lista de casos funcional
- [ ] Detalle de caso completo
- [ ] Wizard de creación
- [ ] RLS aplicado correctamente
- [ ] Flujo ASSA (sin ticket → con ticket)
- [ ] Preliminar BD al emitir
- [ ] SLA semáforo
- [ ] Notificaciones básicas
- [ ] PDF individual
- [ ] Mobile-responsive
- [ ] Testing en staging

---

## 🚀 Inicio Rápido

1. **Leer documentación** en orden:
   - 00 → 01 → 02 → 03 → 04 → 05

2. **Revisar requisitos** en `01_REQUISITOS_DOCUMENTOS.md`

3. **Entender flujo** en `02_FLUJO_MODULO_CASOS.md`

4. **Implementar** según `05_ESPECIFICACIONES_TECNICAS_Y_QA.md`

5. **QA** con checklist de `05`

---

## 📞 Soporte

**Preguntas técnicas:**
- Revisar archivo correspondiente
- Buscar en índice (`00_INDICE_MODULO_CASOS.md`)
- Validar contra requisitos originales

**Estructura:**
```
docs/casos/
├── 00_INDICE_MODULO_CASOS.md       ← START HERE
├── 01_REQUISITOS_DOCUMENTOS.md     ← Qué documentos
├── 02_FLUJO_MODULO_CASOS.md        ← Cómo funciona
├── 03_INGESTA_CORREO_Y_APIS.md     ← APIs y webhook
├── 04_SLA_NOTIFICACIONES_PDF.md    ← Alertas y reportes
└── 05_ESPECIFICACIONES_TECNICAS_Y_QA.md  ← Implementación
```

---

**Fecha:** 2025-10-17  
**Versión:** 1.0  
**Estado:** ✅ Documentación completa  
**Próximo paso:** Implementación
