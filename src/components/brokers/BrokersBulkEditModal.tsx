'use client';

import { useState, useEffect } from 'react';
import { FaTimes, FaSave, FaTable } from 'react-icons/fa';
import { toast } from 'sonner';
import { BankSelect, AccountTypeSelect } from '@/components/ui/BankSelect';
import { cleanAccountNumber, toUpperNoAccents } from '@/lib/commissions/ach-normalization';
import { PERCENT_OPTIONS } from '@/lib/constants/brokers';

interface BrokersBulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  brokers: any[];
  onSave: (updates: any[]) => Promise<void>;
}

interface BrokerEdit {
  id: string;
  name: string;
  email: string;
  phone: string;
  national_id: string;
  birth_date: string;
  assa_code: string;
  license_no: string;
  percent_default: number;
  bank_route: string;
  tipo_cuenta: string;
  bank_account_no: string;
  nombre_completo: string;
  broker_type: 'corredor' | 'agente';
  carnet_expiry_date: string;
  active: boolean;
}

export default function BrokersBulkEditModal({ isOpen, onClose, brokers, onSave }: BrokersBulkEditModalProps) {
  const [editedBrokers, setEditedBrokers] = useState<BrokerEdit[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && brokers.length > 0) {
      // Initialize edited brokers
      const initialData: BrokerEdit[] = brokers.map((broker) => ({
        id: broker.id,
        name: broker.name || '',
        email: (broker.profiles as any)?.email || broker.email || '',
        phone: broker.phone || '',
        national_id: broker.national_id || '',
        birth_date: broker.birth_date || '',
        assa_code: broker.assa_code || '',
        license_no: broker.license_no || '',
        percent_default: broker.percent_default || 0.82,
        bank_route: broker.bank_route || '',
        tipo_cuenta: broker.tipo_cuenta || '04',
        bank_account_no: broker.bank_account_no || '',
        nombre_completo: broker.nombre_completo || '',
        broker_type: (broker as any).broker_type || 'corredor',
        carnet_expiry_date: (broker as any).carnet_expiry_date || '',
        active: broker.active !== false,
      }));
      setEditedBrokers(initialData);
    }
  }, [isOpen, brokers]);

  const updateBroker = (index: number, field: keyof BrokerEdit, value: any) => {
    setEditedBrokers((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value } as BrokerEdit;
      return updated;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Create updates array with only changed fields
      const updates = editedBrokers.map((edited, index) => {
        const original = brokers[index];
        const changes: any = { id: edited.id };
        
        // Compare and add only changed fields
        if (edited.name !== (original.name || '')) changes.name = edited.name;
        if (edited.phone !== (original.phone || '')) changes.phone = edited.phone;
        if (edited.national_id !== (original.national_id || '')) changes.national_id = edited.national_id;
        if (edited.birth_date !== (original.birth_date || '')) changes.birth_date = edited.birth_date;
        if (edited.assa_code !== (original.assa_code || '')) changes.assa_code = edited.assa_code;
        if (edited.license_no !== (original.license_no || '')) changes.license_no = edited.license_no;
        if (edited.percent_default !== (original.percent_default || 0.82)) changes.percent_default = edited.percent_default;
        if (edited.bank_route !== (original.bank_route || '')) changes.bank_route = edited.bank_route;
        if (edited.tipo_cuenta !== (original.tipo_cuenta || '04')) changes.tipo_cuenta = edited.tipo_cuenta;
        if (edited.bank_account_no !== (original.bank_account_no || '')) changes.bank_account_no = edited.bank_account_no;
        if (edited.nombre_completo !== (original.nombre_completo || '')) changes.nombre_completo = edited.nombre_completo;
        if (edited.broker_type !== ((original as any).broker_type || 'corredor')) changes.broker_type = edited.broker_type;
        if (edited.carnet_expiry_date !== ((original as any).carnet_expiry_date || '')) changes.carnet_expiry_date = edited.carnet_expiry_date;
        if (edited.active !== (original.active !== false)) changes.active = edited.active;
        
        return changes;
      });

      await onSave(updates);
      toast.success('Cambios guardados correctamente');
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar cambios');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-[95vw] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FaTable className="text-[#8AAA19] text-2xl" />
            <div>
              <h2 className="text-2xl font-bold text-[#010139]">Edición Masiva</h2>
              <p className="text-sm text-gray-600 mt-1">
                Editando {editedBrokers.length} corredor{editedBrokers.length !== 1 ? 'es' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-all"
          >
            <FaTimes className="text-gray-600" />
          </button>
        </div>

        {/* Table Container */}
        <div className="flex-1 overflow-auto p-6">
          <div className="min-w-max">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-[#010139] to-[#020270] text-white sticky top-0 z-10">
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase border-r border-white/20">Nombre</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase border-r border-white/20">Teléfono</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase border-r border-white/20">Cédula</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase border-r border-white/20">F. Nacimiento</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase border-r border-white/20">Tipo</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase border-r border-white/20">Código ASSA</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase border-r border-white/20">Licencia</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase border-r border-white/20">Venc. Carnet</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase border-r border-white/20">% Default</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase border-r border-white/20">Banco</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase border-r border-white/20">Tipo Cta</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase border-r border-white/20">Nº Cuenta</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase border-r border-white/20">Titular</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold uppercase">Activo</th>
                </tr>
              </thead>
              <tbody>
                {editedBrokers.map((broker, index) => (
                  <tr key={broker.id} className="border-b border-gray-200 hover:bg-gray-50">
                    {/* Name */}
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={broker.name}
                        onChange={(e) => updateBroker(index, 'name', e.target.value.toUpperCase())}
                        className="w-40 px-2 py-1 text-sm border border-gray-300 rounded focus:border-[#8AAA19] focus:outline-none uppercase"
                      />
                    </td>
                    
                    {/* Phone */}
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={broker.phone}
                        onChange={(e) => updateBroker(index, 'phone', e.target.value)}
                        className="w-32 px-2 py-1 text-sm border border-gray-300 rounded focus:border-[#8AAA19] focus:outline-none"
                      />
                    </td>
                    
                    {/* National ID */}
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={broker.national_id}
                        onChange={(e) => updateBroker(index, 'national_id', e.target.value.toUpperCase())}
                        className="w-32 px-2 py-1 text-sm border border-gray-300 rounded focus:border-[#8AAA19] focus:outline-none uppercase"
                      />
                    </td>
                    
                    {/* Birth Date */}
                    <td className="px-2 py-2">
                      <input
                        type="date"
                        value={broker.birth_date}
                        onChange={(e) => updateBroker(index, 'birth_date', e.target.value)}
                        className="w-36 px-2 py-1 text-sm border border-gray-300 rounded focus:border-[#8AAA19] focus:outline-none"
                      />
                    </td>
                    
                    {/* Broker Type */}
                    <td className="px-2 py-2">
                      <select
                        value={broker.broker_type}
                        onChange={(e) => updateBroker(index, 'broker_type', e.target.value)}
                        className="w-28 px-2 py-1 text-sm border border-gray-300 rounded focus:border-[#8AAA19] focus:outline-none"
                      >
                        <option value="corredor">Corredor</option>
                        <option value="agente">Agente</option>
                      </select>
                    </td>
                    
                    {/* ASSA Code */}
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={broker.assa_code}
                        onChange={(e) => updateBroker(index, 'assa_code', e.target.value.toUpperCase())}
                        className="w-28 px-2 py-1 text-sm border border-gray-300 rounded focus:border-[#8AAA19] focus:outline-none uppercase"
                        disabled={broker.broker_type === 'corredor'}
                      />
                    </td>
                    
                    {/* License */}
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={broker.license_no}
                        onChange={(e) => updateBroker(index, 'license_no', e.target.value.toUpperCase())}
                        className="w-28 px-2 py-1 text-sm border border-gray-300 rounded focus:border-[#8AAA19] focus:outline-none uppercase"
                        disabled={broker.broker_type === 'agente'}
                      />
                    </td>
                    
                    {/* Carnet Expiry */}
                    <td className="px-2 py-2">
                      <input
                        type="date"
                        value={broker.carnet_expiry_date}
                        onChange={(e) => updateBroker(index, 'carnet_expiry_date', e.target.value)}
                        className="w-36 px-2 py-1 text-sm border border-gray-300 rounded focus:border-[#8AAA19] focus:outline-none"
                        disabled={broker.broker_type === 'corredor'}
                      />
                    </td>
                    
                    {/* Percent Default */}
                    <td className="px-2 py-2">
                      <select
                        value={broker.percent_default}
                        onChange={(e) => updateBroker(index, 'percent_default', parseFloat(e.target.value))}
                        className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:border-[#8AAA19] focus:outline-none"
                      >
                        {PERCENT_OPTIONS.map((percent) => (
                          <option key={percent} value={percent}>
                            {(percent * 100).toFixed(0)}%
                          </option>
                        ))}
                      </select>
                    </td>
                    
                    {/* Bank Route */}
                    <td className="px-2 py-2">
                      <div className="w-40">
                        <BankSelect
                          value={broker.bank_route}
                          onChange={(route) => updateBroker(index, 'bank_route', route)}
                          className="text-sm"
                        />
                      </div>
                    </td>
                    
                    {/* Account Type */}
                    <td className="px-2 py-2">
                      <div className="w-32">
                        <AccountTypeSelect
                          value={broker.tipo_cuenta}
                          onChange={(type) => updateBroker(index, 'tipo_cuenta', type)}
                          className="text-sm"
                        />
                      </div>
                    </td>
                    
                    {/* Bank Account No */}
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={broker.bank_account_no}
                        onChange={(e) => updateBroker(index, 'bank_account_no', cleanAccountNumber(e.target.value))}
                        maxLength={17}
                        className="w-40 px-2 py-1 text-sm border border-gray-300 rounded focus:border-[#8AAA19] focus:outline-none font-mono"
                      />
                    </td>
                    
                    {/* Titular */}
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={broker.nombre_completo}
                        onChange={(e) => updateBroker(index, 'nombre_completo', toUpperNoAccents(e.target.value).substring(0, 22))}
                        maxLength={22}
                        className="w-48 px-2 py-1 text-sm border border-gray-300 rounded focus:border-[#8AAA19] focus:outline-none uppercase"
                      />
                    </td>
                    
                    {/* Active */}
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={broker.active}
                        onChange={(e) => updateBroker(index, 'active', e.target.checked)}
                        className="w-5 h-5 text-[#8AAA19] rounded focus:ring-[#8AAA19]"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex items-center justify-between bg-gray-50">
          <p className="text-sm text-gray-600">
            💡 Tip: Usa Tab para moverte entre campos. Los cambios se guardan al hacer clic en "Guardar cambios"
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-all font-semibold disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-3 bg-[#8AAA19] hover:bg-[#7a9916] text-white rounded-lg transition-all font-semibold flex items-center gap-2 disabled:opacity-50"
            >
              <FaSave />
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
