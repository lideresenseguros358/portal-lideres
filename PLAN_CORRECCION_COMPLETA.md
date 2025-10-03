# 🔧 PLAN DE CORRECCIÓN COMPLETA

## ⚠️ PRIORIDAD 1: FUNCIONALIDAD CRÍTICA (HACER PRIMERO)

### A. CHEQUES - ERRORES BLOQUEANTES

1. **ERROR CRÍTICO: No puede importar historial banco**
   - Revisar action `actionImportBankHistoryXLSX`
   - Verificar parser XLSX
   - Probar con archivo real
   - DEBE FUNCIONAR

2. **Wizard NO registra pago pendiente**
   - Revisar `actionCreatePendingPayment`
   - Verificar que inserta en `pending_payments`
   - Verificar que inserta en `payment_references`
   - Confirmar con toast + refresh

3. **Tab "Pagados" eliminar**
   - Quitar filtro "paid" de PendingPaymentsTab
   - Solo mostrar "pending"
   - Los pagados se ven en historial banco

4. **Marcar como pagado NO actualiza**
   - `actionMarkPaymentsAsPaidNew` debe:
     - Actualizar `bank_transfers.used_amount`
     - Actualizar `bank_transfers.status` (auto)
     - Crear `payment_details`
     - Marcar `pending_payments.status = 'paid'`
   - Refresh automático historial

### B. COMISIONES - ERRORES BLOQUEANTES

1. **Nueva quincena NO actualiza automático**
   - Usar `revalidatePath`
   - Usar `router.refresh()`
   - NO cambiar de página manualmente

2. **Eliminar reporte NO funciona**
   - Verificar `actionDeleteHistoryItem`
   - Debe eliminar `fortnight_imported_reports`
   - Cascade debe eliminar `fortnight_imported_items`
   - Verificar FK en SQL

3. **Parseo: mostrar cliente + aseguradora**
   - En tabla principal mostrar: `nombre_cliente | aseguradora`
   - En dropdown: solo items individuales con montos
   - Suma total arriba

4. **Comisión en negativo**
   - Debe ser POSITIVA
   - Revisar cálculo en parser
   - Si viene con signo negativo, invertir

5. **Dropdown asignar corredor sin fondo**
   - Agregar `bg-white` o `bg-gray-50`
   - Border y padding

6. **Adelantos NO actualizan**
   - Revisar connections
   - Verificar refresh después de crear

7. **Descartar borrador NO borra todo**
   - Debe borrar `fortnight_imported_reports`
   - Debe borrar `fortnight_imported_items` (cascade)
   - Confirm modal antes

---

## ⚙️ PRIORIDAD 2: FUNCIONALIDAD SECUNDARIA

### A. CHEQUES - Wizard mejorado

1. **Wizard se corta en pantalla**
   - `max-h-[90vh]` en modal
   - `overflow-y-auto` en content

2. **Activar división de transferencia (Paso 3)**
   - Implementar funcionalidad completa
   - Permitir dividir 1 transferencia → N pagos

3. **Devolución: corredor o cliente**
   - Si purpose = "devolucion":
     - Radio: Corredor / Cliente
     - Si Cliente:
       - Pedir: cuenta_banco
       - Usar: client_name (ya ingresado)

### B. COMISIONES - Flujo completo

1. **Toggle correos automáticos**
   - En settings o en página
   - Activar/desactivar envío

2. **Generar reportes brokers**
   - PDF individual por broker
   - Desglose de comisiones

3. **Enviar correos automáticos**
   - Al cerrar quincena
   - Adjuntar PDF

4. **Gráficas con datos correctos**
   - Verificar queries
   - Acumulado anual
   - Comisiones por quincena

---

## 🎨 PRIORIDAD 3: DISEÑO (HACER AL FINAL)

### A. BRANDING UNIFICADO (guardar en memoria)

**Estándar de Base de Datos (después de correcciones):**
- Botones: tamaño conservador (px-4 py-2, no px-6 py-3)
- Cards: esquinas redondeadas (rounded-2xl) + sombra (shadow-lg)
- Fondo página: card blanco con rounded-2xl y shadow
- Título: con icono emoji, text-4xl font-bold
- Animaciones: transform hover:scale-105 transition-all duration-300
- Responsive: siempre

**Aplicar en:**
- Base de Datos ✓ (ya tiene, ajustar botones)
- Cheques (ajustar botones + card fondo)
- Comisiones (ajustar todo)
- Aseguradoras (ajustar todo)

### B. BASE DE DATOS - Ajustes diseño

1. **Título igual que Cheques**
   - Icono emoji
   - text-4xl font-bold

2. **Filtros mejorados**
   - Agregar título "Filtrar por"
   - Alinear iconos correctamente
   - Más estético

3. **Botones más pequeños**
   - De px-6 py-3 → px-4 py-2
   - Iconos proporcionales

4. **Card de fondo**
   - Envolver todo en card blanco
   - rounded-2xl shadow-lg

### C. CHEQUES - Ajustes diseño

1. **Botones más pequeños**
   - Conservadores

2. **Card de fondo**
   - rounded-2xl shadow-lg

### D. COMISIONES - Rediseño completo

1. **Título con icono**
   - Igual que Base de Datos/Cheques

2. **Botones conservadores**
   - px-4 py-2

3. **Card de fondo**
   - rounded-2xl shadow-lg

4. **Animaciones**
   - Como Base de Datos

### E. ASEGURADORAS - Rediseño completo

1. **Título con icono**
2. **Botones conservadores**
3. **Card de fondo**
4. **Animaciones**

---

## 🔍 PRIORIDAD 4: VERIFICACIÓN FINAL

1. **TypeCheck**
   ```bash
   npm run typecheck
   ```

2. **Build**
   ```bash
   npm run build
   ```

3. **Probar flujos completos:**
   - Comisiones: crear → importar → asignar → cerrar → pagar
   - Cheques: importar → crear pago → marcar pagado

4. **Verificar conexiones database**
   - Todas las FKs funcionando
   - Cascades correctos
   - Triggers activos

---

## 📝 ORDEN DE EJECUCIÓN

1. **PASO 1:** Arreglar importar historial Cheques (crítico)
2. **PASO 2:** Arreglar wizard registro pago Cheques
3. **PASO 3:** Arreglar eliminar reporte Comisiones
4. **PASO 4:** Arreglar actualización automática Comisiones
5. **PASO 5:** Arreglar parseo mostrar cliente+aseguradora
6. **PASO 6:** Arreglar comisión negativa
7. **PASO 7:** Arreglar dropdown sin fondo
8. **PASO 8:** Arreglar adelantos no actualizan
9. **PASO 9:** Arreglar descartar borrador
10. **PASO 10:** Implementar devolución corredor/cliente
11. **PASO 11:** Implementar división transferencia
12. **PASO 12:** Ajustar wizard pantalla
13. **PASO 13:** Diseño Base de Datos
14. **PASO 14:** Diseño Cheques
15. **PASO 15:** Diseño Comisiones
16. **PASO 16:** Diseño Aseguradoras
17. **PASO 17:** Verificación final

---

**INICIO EJECUCIÓN: AHORA**
