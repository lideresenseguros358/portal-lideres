# CORRECCIONES PENDIENTES - Portal Líderes
**Fecha:** 2025-10-03
**Estado:** EN PROGRESO

## COMISIONES (Prioridad Alta)

### ✅ Eliminación y Gestión de Reportes
- [ ] Fix: Eliminar reporte individual y sus items automáticamente
- [ ] Fix: Botón eliminar borrador de quincena
- [ ] Implementar: Revalidación automática tras eliminación

### 📊 Agrupación y Cálculos
- [ ] Agrupar por NOMBRE de cliente (no solo póliza)
- [ ] Sumar duplicados como items adicionales
- [ ] Excluir rows con comisión 0.00 (excepto ASSA)
- [ ] Calcular comisión bruta: reporte × % default/override por corredor

### 🏦 Tabla Preliminar
- [ ] Crear tabla `temp_clients` para pendientes sin cédula
- [ ] Migrar lógica "pendientes sin identificar" a temp_clients
- [ ] Trigger: temp_clients → clients/policies al completar cédula

### 💰 Adelantos
- [ ] Filtrar adelantos por corredor (vista master y broker)
- [ ] Validación: no permitir descontar más que comisión bruta
- [ ] Sumar totales en gráfica de adelantos
- [ ] Fix: Mostrar solo adelantos del corredor seleccionado

### 📈 Visualización NETO
- [ ] Mostrar columna NETO en tabla Nueva Quincena
- [ ] Preview: mostrar NETO (no bruto) como principal
- [ ] Gráficas: mostrar total corredores (no solo oficina 100%)

### 📄 CSV Banco General
- [ ] Fix: Botón generar CSV no funciona
- [ ] Excluir corredores con neto 0.00
- [ ] Formato correcto Banco General

### 🔒 Botón Pagado
- [ ] Fix: Cerrar quincena y cambiar status a CLOSED
- [ ] Mover datos a Preview

### 🏢 ASSA - Caso Especial
- [ ] Config: 3 columnas para comisión (monto, vida 1er año, vida renov)
- [ ] Parser: sumar las 3 columnas = comisión total
- [ ] UI: formulario mapeo 3 columnas en config ASSA

---

## CHEQUES (Prioridad Alta)

### 📥 Importación Historial Banco
- [ ] Fix: No muestra preview (detecta 10 rows pero no renderiza)
- [ ] Revisar mapeo de columnas
- [ ] Soporte .xl además de .xlsx

### ✏️ Wizard Pagos Pendientes
- [ ] Fix: No registra pagos
- [ ] Fix: Wizard se corta con header (z-index)
- [ ] Validación de campos

---

## BASE DE DATOS (Prioridad Media)

### 👥 Vista Master
- [ ] Fix: Dropdown de corredores no aparece
- [ ] Asignación de corredor a clientes/pólizas

### 🔄 Vista Broker - Triggers
- [ ] Fix: Trigger temp → clients/policies no se activa
- [ ] Borrado automático de temp_clients tras migración
- [ ] Validar extracción correcta de datos

---

## DASHBOARD BROKER (Prioridad Baja)

### 📊 Gráficas
- [ ] Alinear tamaño gráficas ASSA/Convivio con calendario
- [ ] Hacer responsive grid

### 📅 Mini Calendario
- [ ] Título centrado
- [ ] Navegación entre meses (< >)
- [ ] Mensaje: "Sin eventos programados" si vacío
- [ ] Listar próximo evento

---

## ORDEN DE EJECUCIÓN

1. **INMEDIATO:** Fix eliminación reportes + adelantos filtrados
2. **HOY:** Tabla preliminar + cálculo NETO + CSV Banco
3. **MAÑANA:** ASSA 3 columnas + Cheques import
4. **SIGUIENTE:** Dashboard + triggers temp

---

## NOTAS TÉCNICAS

- Toda eliminación debe usar `revalidatePath('/(app)/commissions')`
- Adelantos: filtrar por `broker_id` en queries
- NETO = BRUTO - ADELANTOS
- CSV excluye neto <= 0.00
- Agrupación: `GROUP BY insured_name, policy_number`
