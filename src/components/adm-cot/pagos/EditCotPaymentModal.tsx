'use client';

import { useState } from 'react';
import { FaTimes, FaSave, FaSpinner, FaExchangeAlt, FaExclamationTriangle } from 'react-icons/fa';
import { toast } from 'sonner';

interface EditCotPaymentModalProps {
  payment: any;
  onClose: () => void;
  onSuccess: () => void;
}

const apiPost = async (action: string, data: Record<string, any>) => {
  const r = await fetch('/api/adm-cot/payments', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, data }),
  });
  return r.json();
};

export default function EditCotPaymentModal({ payment, onClose, onSuccess }: EditCotPaymentModalProps) {
  const [loading, setLoading] = useState(false);
  const isEmisionFallida = payment.status === 'EMISION_FALLIDA';

  // Purpose: 'aseguradora' (pay to insurer) or 'devolucion' (refund to client)
  const [purpose, setPurpose] = useState<'aseguradora' | 'devolucion'>(
    payment.is_refund ? 'devolucion' : 'aseguradora'
  );

  const [formData, setFormData] = useState({
    client_name: payment.client_name || '',
    cedula: payment.cedula || '',
    nro_poliza: payment.nro_poliza || '',
    amount: String(Number(payment.amount || 0)),
    insurer: payment.insurer || '',
    ramo: payment.ramo || 'AUTO',
    // Refund fields
    refund_bank: payment.refund_bank || '',
    refund_account: payment.refund_account || '',
    refund_account_type: payment.refund_account_type || 'Ahorro',
    refund_reason: payment.refund_reason || '',
  });

  const handleSave = async () => {
    // Validations
    if (!formData.client_name.trim()) { toast.error('El nombre del cliente es requerido'); return; }
    if (!formData.amount || parseFloat(formData.amount) <= 0) { toast.error('El monto debe ser mayor a 0'); return; }

    if (purpose === 'aseguradora') {
      if (!formData.nro_poliza.trim()) { toast.error('El número de póliza es requerido'); return; }
      if (!formData.insurer.trim()) { toast.error('La aseguradora es requerida'); return; }
    } else {
      // Refund validations
      if (!formData.refund_bank.trim()) { toast.error('El banco es requerido'); return; }
      if (!formData.refund_account.trim()) { toast.error('El número de cuenta es requerido'); return; }
      if (!formData.refund_account_type) { toast.error('El tipo de cuenta es requerido'); return; }
    }

    setLoading(true);
    try {
      const res = await apiPost('update_payment', {
        payment_id: payment.id,
        client_name: formData.client_name.trim(),
        cedula: formData.cedula.trim(),
        nro_poliza: formData.nro_poliza.trim(),
        amount: parseFloat(formData.amount),
        insurer: purpose === 'devolucion' ? (formData.insurer || payment.insurer || 'DEVOLUCION') : formData.insurer.trim(),
        ramo: formData.ramo,
        is_refund: purpose === 'devolucion',
        ...(purpose === 'devolucion' ? {
          refund_bank: formData.refund_bank.trim(),
          refund_account: formData.refund_account.trim(),
          refund_account_type: formData.refund_account_type,
          refund_reason: formData.refund_reason.trim(),
        } : {}),
        // If EMISION_FALLIDA and nro_poliza is now a real policy, resolve it
        resolve_emission_fallida: isEmisionFallida && purpose === 'aseguradora' && formData.nro_poliza.trim() && !formData.nro_poliza.startsWith('PENDIENTE'),
      });

      if (res.success) {
        toast.success('Pago actualizado exitosamente');
        onSuccess();
      } else {
        toast.error(res.error || 'Error al actualizar');
      }
    } catch (err: any) {
      toast.error('Error inesperado: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full my-4 sm:my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-200">
          <div>
            <h2 className="text-base font-bold text-[#010139]">✏️ Editar Pago</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {isEmisionFallida ? 'Emisión fallida — completar datos o marcar devolución' : 'Actualiza la información del pago'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer p-1" type="button">
            <FaTimes size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-4 max-h-[70vh] overflow-y-auto">

          {/* EMISION_FALLIDA warning */}
          {isEmisionFallida && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-start gap-2">
              <FaExclamationTriangle className="text-purple-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-purple-800">Emisión Fallida</p>
                <p className="text-[11px] text-purple-600 mt-0.5">
                  {payment.emission_error || 'El cobro se realizó pero la emisión falló.'}
                  {' '}Complete el número de póliza si se emitió manualmente, o cambie a devolución.
                </p>
                {payment.pf_cod_oper && (
                  <p className="text-[10px] text-purple-500 mt-1 font-mono">CodOper PF: {payment.pf_cod_oper}</p>
                )}
              </div>
            </div>
          )}

          {/* Purpose Toggle */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">Tipo de Pago</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPurpose('aseguradora')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium border-2 transition-all cursor-pointer ${
                  purpose === 'aseguradora'
                    ? 'border-[#010139] bg-[#010139]/5 text-[#010139]'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                }`}
              >
                💼 Pago a Aseguradora
              </button>
              <button
                type="button"
                onClick={() => setPurpose('devolucion')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium border-2 transition-all cursor-pointer ${
                  purpose === 'devolucion'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                }`}
              >
                🔄 Devolución al Cliente
              </button>
            </div>
          </div>

          {/* Common Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Nombre del Cliente <span className="text-red-500">*</span></label>
              <input type="text" value={formData.client_name}
                onChange={e => setFormData(f => ({ ...f, client_name: e.target.value.toUpperCase() }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none uppercase" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Cédula</label>
              <input type="text" value={formData.cedula}
                onChange={e => setFormData(f => ({ ...f, cedula: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Monto <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                <input type="number" step="0.01" value={formData.amount}
                  onChange={e => setFormData(f => ({ ...f, amount: e.target.value }))}
                  className="w-full pl-7 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none" />
              </div>
            </div>
          </div>

          {/* Insurer Payment Fields */}
          {purpose === 'aseguradora' && (
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Número de Póliza <span className="text-red-500">*</span></label>
                <input type="text" value={formData.nro_poliza}
                  onChange={e => setFormData(f => ({ ...f, nro_poliza: e.target.value.toUpperCase() }))}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none uppercase ${
                    isEmisionFallida && formData.nro_poliza.startsWith('PENDIENTE')
                      ? 'border-purple-300 bg-purple-50 focus:border-purple-500'
                      : 'border-gray-300 focus:border-[#8AAA19]'
                  }`}
                  placeholder={isEmisionFallida ? 'Ingrese el número de póliza emitida manualmente' : ''} />
                {isEmisionFallida && formData.nro_poliza.startsWith('PENDIENTE') && (
                  <p className="text-[10px] text-purple-500 mt-1">⚠️ Reemplace con el número de póliza real para resolver la emisión fallida</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Aseguradora <span className="text-red-500">*</span></label>
                  <select value={formData.insurer}
                    onChange={e => setFormData(f => ({ ...f, insurer: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none">
                    <option value="">Seleccione</option>
                    <option value="FEDPA">FEDPA</option>
                    <option value="INTERNACIONAL">Internacional</option>
                    <option value="REGIONAL">Regional</option>
                    <option value="ANCON">ANCÓN</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Ramo</label>
                  <select value={formData.ramo}
                    onChange={e => setFormData(f => ({ ...f, ramo: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none">
                    <option value="AUTO">AUTO</option>
                    <option value="VIDA">VIDA</option>
                    <option value="SALUD">SALUD</option>
                    <option value="OTRO">OTRO</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Refund Fields */}
          {purpose === 'devolucion' && (
            <div className="space-y-3 pt-2 border-t border-red-100">
              <div className="bg-red-50 border border-red-200 rounded-lg p-2.5">
                <p className="text-[11px] text-red-700 font-medium">
                  Al marcar como devolución, este pago se agrupará con las demás devoluciones pendientes.
                </p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Banco <span className="text-red-500">*</span></label>
                <input type="text" value={formData.refund_bank}
                  onChange={e => setFormData(f => ({ ...f, refund_bank: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-red-400 focus:outline-none"
                  placeholder="Banco Nacional, Banistmo, etc." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Número de Cuenta <span className="text-red-500">*</span></label>
                  <input type="text" value={formData.refund_account}
                    onChange={e => setFormData(f => ({ ...f, refund_account: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-red-400 focus:outline-none"
                    placeholder="0401234567890" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Tipo de Cuenta <span className="text-red-500">*</span></label>
                  <select value={formData.refund_account_type}
                    onChange={e => setFormData(f => ({ ...f, refund_account_type: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-red-400 focus:outline-none">
                    <option>Ahorro</option>
                    <option>Corriente</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Motivo de Devolución</label>
                <input type="text" value={formData.refund_reason}
                  onChange={e => setFormData(f => ({ ...f, refund_reason: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-red-400 focus:outline-none"
                  placeholder="Ej: Emisión fallida, cancelación de póliza" />
              </div>
            </div>
          )}

          {/* PF Metadata (read-only) */}
          {(payment.pf_cod_oper || payment.pf_card_display) && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Datos PagueloFacil (solo lectura)</p>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-500">
                {payment.pf_cod_oper && <div><span className="text-gray-400">CodOper:</span> <span className="font-mono">{payment.pf_cod_oper}</span></div>}
                {payment.pf_card_display && <div><span className="text-gray-400">Tarjeta:</span> {payment.pf_card_type} {payment.pf_card_display}</div>}
                {payment.pf_confirmed_at && <div><span className="text-gray-400">Confirmado:</span> {new Date(payment.pf_confirmed_at).toLocaleString('es-PA')}</div>}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 text-xs text-gray-500 hover:text-gray-700 cursor-pointer" type="button">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={loading}
            className={`px-5 py-2 text-xs font-medium rounded-lg flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
              purpose === 'devolucion'
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-[#010139] text-white hover:bg-[#010139]/90'
            }`} type="button">
            {loading ? <FaSpinner className="animate-spin" /> : <FaSave />}
            <span className="text-white">{loading ? 'Guardando...' : purpose === 'devolucion' ? 'Guardar como Devolución' : 'Guardar Cambios'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
