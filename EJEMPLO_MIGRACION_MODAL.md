# 📘 Ejemplo Práctico de Migración: AddAdvanceModal

## 🎯 Objetivo
Migrar `AddAdvanceModal.tsx` para usar el sistema estandarizado

---

## 📝 OPCIÓN 1: Migración Mínima (Solo CSS)

### Cambios Requeridos:

```diff
// src/components/commissions/AddAdvanceModal.tsx

export function AddAdvanceModal({ isOpen, onClose, onSuccess, brokers }: Props) {
  // ... estado y lógica sin cambios ...

  return (
-   <Dialog open={isOpen} onOpenChange={onClose}>
-     <DialogContent className="sm:max-w-[500px] max-h-[90vh] p-0 gap-0 flex flex-col">
+   <div 
+     className="standard-modal-backdrop"
+     onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
+     style={{ display: isOpen ? 'flex' : 'none' }}
+   >
+     <div 
+       className="standard-modal-container max-w-[500px]"
+       onClick={(e) => e.stopPropagation()}
+     >
        {/* Header */}
-       <DialogHeader className="bg-gradient-to-r from-[#010139] to-[#020270] text-white p-6 pb-8 flex-shrink-0">
-         <div className="flex items-center gap-3 mb-2">
-           <div className="p-3 bg-white/10 rounded-lg">
-             <FaMoneyBillWave className="text-2xl" />
-           </div>
-           <div>
-             <DialogTitle className="text-2xl font-bold text-white">Nuevo Adelanto</DialogTitle>
-             <DialogDescription className="text-gray-200 mt-1">
-               Registra un adelanto de comisión para un corredor
-             </DialogDescription>
-           </div>
+       <div className="standard-modal-header">
+         <div>
+           <h2 className="standard-modal-title">
+             <FaMoneyBillWave className="inline mr-2" />
+             Nuevo Adelanto
+           </h2>
+           <p className="standard-modal-subtitle">
+             Registra un adelanto de comisión para un corredor
+           </p>
          </div>
-       </DialogHeader>
+         <button onClick={onClose} className="standard-modal-close">
+           <FaTimes size={24} />
+         </button>
+       </div>

-       <Form {...form}>
-         <form onSubmit={form.handleSubmit(onSubmit)} className="overflow-y-auto flex-1">
-           <div className="p-6 space-y-6">
+       {/* Content */}
+       <div className="standard-modal-content">
+         <form id="advance-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Campos del formulario sin cambios */}
            {/* ... */}
-           </div>
+         </form>
+       </div>

-           {/* Footer con botones */}
-           <DialogFooter className="gap-3 sm:gap-2 pt-4 border-t border-gray-200 flex-shrink-0 px-6 pb-6">
-             <Button 
-               type="button" 
-               variant="outline" 
-               onClick={onClose} 
-               disabled={form.formState.isSubmitting}
-               className="border-2 border-gray-300 hover:bg-gray-100 transition-colors"
-             >
+       {/* Footer */}
+       <div className="standard-modal-footer">
+         <div></div>
+         
+         <div className="flex gap-3">
+           <button 
+             type="button"
+             onClick={onClose}
+             disabled={form.formState.isSubmitting}
+             className="standard-modal-button-secondary"
+           >
              Cancelar
-             </Button>
-             <Button 
-               type="submit" 
+           </button>
+           <button 
+             type="submit"
+             form="advance-form"
              disabled={form.formState.isSubmitting}
-             className="bg-gradient-to-r from-[#8AAA19] to-[#6d8814] hover:from-[#6d8814] hover:to-[#8AAA19] text-white shadow-lg transition-all duration-200"
+             className="standard-modal-button-primary"
            >
              {form.formState.isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {isRecurrent ? 'Creando recurrencia...' : 'Agregando...'}
                </>
              ) : (
                <>
                  {isRecurrent ? <FaCalendarAlt className="mr-2" /> : <FaMoneyBillWave className="mr-2" />}
                  {isRecurrent ? 'Crear Recurrencia' : 'Agregar Adelanto'}
                </>
              )}
-             </Button>
-           </DialogFooter>
-         </form>
-       </Form>
-     </DialogContent>
+           </button>
+         </div>
+       </div>
+     </div>
+   </div>

    {/* Modal de gestión de recurrencias */}
    <RecurrencesManagerModal
      isOpen={showRecurrencesManager}
      onClose={() => setShowRecurrencesManager(false)}
      onSuccess={onSuccess}
    />
-   </Dialog>
  );
}
```

---

## 🚀 OPCIÓN 2: Migración Completa (Componente StandardModal)

```tsx
// src/components/commissions/AddAdvanceModal.tsx

import { StandardModal, StandardModalFooter } from '@/components/ui/StandardModal';

export function AddAdvanceModal({ isOpen, onClose, onSuccess, brokers }: Props) {
  const [isRecurrent, setIsRecurrent] = useState(false);
  const [showRecurrencesManager, setShowRecurrencesManager] = useState(false);
  // ... resto del estado ...
  
  const form = useForm<AddAdvanceForm>({
    resolver: zodResolver(AddAdvanceSchema),
    // ...
  });

  const onSubmit = async (values: AddAdvanceForm) => {
    // ... lógica de submit sin cambios ...
  };

  return (
    <>
      <StandardModal
        isOpen={isOpen}
        onClose={onClose}
        title="💰 Nuevo Adelanto"
        subtitle="Registra un adelanto de comisión para un corredor"
        maxWidth="md"
        footer={
          <StandardModalFooter
            onCancel={onClose}
            onSubmit={form.handleSubmit(onSubmit)}
            loading={form.formState.isSubmitting}
            submitText={
              isRecurrent 
                ? 'Crear Recurrencia' 
                : 'Agregar Adelanto'
            }
            leftContent={
              <button
                type="button"
                onClick={() => setShowRecurrencesManager(true)}
                className="standard-modal-button-secondary"
              >
                <FaCog className="mr-2" />
                Gestionar Recurrencias
              </button>
            }
          />
        }
      >
        <form className="space-y-6">
          {/* Corredor */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <FaUser className="inline text-[#010139] mr-2" />
              Corredor
            </label>
            <select
              {...form.register('broker_id')}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
            >
              <option value="">Seleccione un corredor</option>
              {brokers.map(broker => (
                <option key={broker.id} value={broker.id}>
                  {broker.name}
                </option>
              ))}
            </select>
            {form.formState.errors.broker_id && (
              <p className="text-red-600 text-xs mt-1">
                {form.formState.errors.broker_id.message}
              </p>
            )}
          </div>

          {/* Monto */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <FaDollarSign className="inline text-[#8AAA19] mr-2" />
              Monto
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">
                $
              </span>
              <input 
                type="number"
                step="0.01"
                placeholder="0.00"
                {...form.register('amount', { valueAsNumber: true })}
                className="w-full pl-8 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none font-mono text-lg"
              />
            </div>
            {form.formState.errors.amount && (
              <p className="text-red-600 text-xs mt-1">
                {form.formState.errors.amount.message}
              </p>
            )}
          </div>

          {/* Razón */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <FaFileAlt className="inline text-[#010139] mr-2" />
              Razón o Motivo
            </label>
            <input
              placeholder="Ej: Adelanto de comisiones"
              {...form.register('reason')}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
            />
            {form.formState.errors.reason && (
              <p className="text-red-600 text-xs mt-1">
                {form.formState.errors.reason.message}
              </p>
            )}
          </div>

          {/* Sección de Recurrencia */}
          <div className="standard-modal-section">
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border-2 border-blue-200">
              <div className="flex items-center gap-3">
                <FaCalendarAlt className="text-blue-600 text-xl" />
                <div>
                  <p className="font-semibold text-sm text-gray-900">Adelanto Recurrente</p>
                  <p className="text-xs text-gray-600">Se crea ahora y se repetirá automáticamente cada mes</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={isRecurrent}
                onChange={(e) => setIsRecurrent(e.target.checked)}
                className="w-5 h-5 text-[#8AAA19] rounded focus:ring-[#8AAA19]"
              />
            </div>

            {/* Configuración de Recurrencia (si está activo) */}
            {isRecurrent && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-300 space-y-4">
                {/* Aquí va la configuración de recurrencia */}
                {/* Quincena, Fecha de fin, etc. */}
              </div>
            )}
          </div>
        </form>
      </StandardModal>

      {/* Modal secundario de recurrencias */}
      <RecurrencesManagerModal
        isOpen={showRecurrencesManager}
        onClose={() => setShowRecurrencesManager(false)}
        onSuccess={onSuccess}
      />
    </>
  );
}
```

---

## 📊 Comparación

| Aspecto | OPCIÓN 1 (Solo CSS) | OPCIÓN 2 (StandardModal) |
|---------|---------------------|--------------------------|
| **Esfuerzo** | 🟢 Bajo | 🟡 Medio |
| **Tiempo** | ~15 min | ~30 min |
| **Cambios** | Principalmente clases CSS | Reestructuración completa |
| **Mantenibilidad** | 🟡 Media | 🟢 Alta |
| **Type Safety** | 🟡 Parcial | 🟢 Total |
| **Flexibilidad** | 🟢 Alta | 🟡 Media |

---

## ✅ Resultado Final

Ambas opciones producen el mismo resultado visual:

- ✅ Header sin bordes blancos
- ✅ Footer sin bordes blancos  
- ✅ Content con scroll correcto
- ✅ Header y footer fijos
- ✅ Colores corporativos
- ✅ Responsive perfecto
- ✅ No se corta con el header/footer

---

## 💡 Recomendación

- **Usa OPCIÓN 1** si quieres migrar rápido muchos modales
- **Usa OPCIÓN 2** para modales nuevos o refactorizaciones mayores

**Para migración masiva**: OPCIÓN 1 es la más eficiente ⚡
