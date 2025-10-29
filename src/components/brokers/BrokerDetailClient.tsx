'use client';

import { useState, useEffect } from 'react';
import { FaArrowLeft, FaEdit, FaSave, FaTimes, FaTrash, FaCheckCircle, FaTimesCircle, FaUser, FaPhone, FaIdCard, FaBirthdayCake, FaUniversity, FaPercentage, FaChartLine, FaCalendar, FaDatabase } from 'react-icons/fa';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { actionGetBroker, actionUpdateBroker, actionToggleBrokerActive, actionDeleteBroker, actionApplyDefaultPercentToAll } from '@/app/(app)/brokers/actions';
import { PERCENT_OPTIONS, OFICINA_EMAIL } from '@/lib/constants/brokers';
import { createUppercaseHandler, uppercaseInputClass, toUppercasePayload } from '@/lib/utils/uppercase';
import { BankSelect, AccountTypeSelect } from '@/components/ui/BankSelect';
import { cleanAccountNumber, toUpperNoAccents } from '@/lib/commissions/ach-normalization';

interface BrokerDetailClientProps {
  brokerId: string;
}

export default function BrokerDetailClient({ brokerId }: BrokerDetailClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [broker, setBroker] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [useBrokerData, setUseBrokerData] = useState(false);

  useEffect(() => {
    loadBroker();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadBroker = async () => {
    setLoading(true);
    const result = await actionGetBroker(brokerId);

    if (result.ok) {
      setBroker(result.data);
      setFormData({
        name: result.data.name || '',
        phone: result.data.phone || '',
        national_id: result.data.national_id || '',
        birth_date: result.data.birth_date || '',
        assa_code: result.data.assa_code || '',
        license_no: result.data.license_no || '',
        percent_default: result.data.percent_default || 0.82,
        bank_route: result.data.bank_route || '',
        bank_account_no: result.data.bank_account_no || '',
        tipo_cuenta: result.data.tipo_cuenta || '04',
        nombre_completo: result.data.nombre_completo || '',
        titular_cedula: result.data.national_id || '', // Cédula del titular de cuenta
        carnet_expiry_date: (result.data as any).carnet_expiry_date || '',
        broker_type: (result.data as any).broker_type || 'corredor',
        role: (result.data as any).profiles?.role || 'broker', // Rol del usuario
      });
    } else {
      toast.error(result.error);
      router.push('/brokers');
    }
    setLoading(false);
  };

  const handleSave = async () => {
    console.log('[BrokerDetailClient] handleSave called');
    console.log('[BrokerDetailClient] Form data:', formData);
    
    setSaving(true);
    const normalizedData = toUppercasePayload(formData);
    console.log('[BrokerDetailClient] Normalized data:', normalizedData);
    console.log('[BrokerDetailClient] Calling actionUpdateBroker with ID:', brokerId);
    
    const result = await actionUpdateBroker(brokerId, normalizedData);
    console.log('[BrokerDetailClient] Result:', result);

    if (result.ok) {
      toast.success('Corredor actualizado correctamente');
      setIsEditing(false);
      loadBroker();
    } else {
      toast.error(result.error);
    }
    setSaving(false);
  };

  const handleToggleActive = async () => {
    const newStatus = !broker.active;
    const result = await actionToggleBrokerActive(brokerId, newStatus);

    if (result.ok) {
      toast.success(newStatus ? 'Corredor activado' : 'Corredor desactivado');
      loadBroker();
    } else {
      toast.error(result.error);
    }
  };

  const handleDelete = async () => {
    if (!confirm('¿Estás seguro? Esto moverá toda la cartera a Oficina y marcará las pólizas como nuevas.')) {
      return;
    }

    const result = await actionDeleteBroker(brokerId);

    if (result.ok) {
      toast.success(result.message);
      router.push('/brokers');
    } else {
      toast.error(result.error);
    }
  };

  const handleApplyDefaultToAll = async () => {
    if (!confirm('¿Aplicar este % default a TODAS las pólizas de este corredor?')) {
      return;
    }

    const result = await actionApplyDefaultPercentToAll(brokerId);
    if (result.ok) {
      toast.success(result.message || '% aplicado a todas las pólizas');
    } else {
      toast.error(result.error);
    }
  };

  const handleForcePasswordChange = async () => {
    if (!confirm('¿Obligar a este usuario a cambiar su contraseña en el próximo inicio de sesión?')) {
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/brokers/${brokerId}/force-password-change`, {
        method: 'POST',
      });

      const result = await response.json();

      if (result.ok) {
        toast.success('✅ Usuario deberá cambiar contraseña en próximo login');
      } else {
        toast.error(result.error || 'Error al configurar cambio de contraseña');
      }
    } catch (error: any) {
      toast.error('Error: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#010139]"></div>
      </div>
    );
  }

  if (!broker) {
    return null;
  }

  const isOficina = (broker.profiles as any)?.email === OFICINA_EMAIL;
  const brokerName = broker.name || (broker.profiles as any)?.full_name || (broker.profiles as any)?.name || 'Sin nombre';
  const brokerEmail = (broker.profiles as any)?.email || broker.email;

  return (
    <>
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/brokers"
              className="p-2 hover:bg-gray-100 rounded-lg transition-all"
            >
              <FaArrowLeft className="text-gray-600" />
            </Link>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold text-[#010139]">
                  {brokerName}
                </h1>
                {isOficina && (
                  <span className="px-3 py-1 bg-gradient-to-r from-[#010139] to-[#020270] text-white rounded-full text-sm font-semibold">
                    OFICINA
                  </span>
                )}
                {(broker.profiles as any)?.role === 'master' && !isOficina && (
                  <span className="px-3 py-1 bg-purple-100 text-purple-800 border-2 border-purple-300 rounded-full text-sm font-semibold">
                    MASTER
                  </span>
                )}
              </div>
              <p className="text-gray-600 mt-1">{brokerEmail}</p>
            </div>
          </div>

          {/* Active Status Toggle */}
          {!isOficina && (
            <button
              onClick={handleToggleActive}
              className={`
                px-6 py-3 rounded-lg font-semibold transition-all flex items-center gap-2
                ${broker.active
                  ? 'bg-green-100 text-green-800 border-2 border-green-300 hover:bg-green-200'
                  : 'bg-red-100 text-red-800 border-2 border-red-300 hover:bg-red-200'
                }
              `}
            >
              {broker.active ? <FaCheckCircle /> : <FaTimesCircle />}
              <span className="hidden sm:inline">{broker.active ? 'Activo' : 'Inactivo'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Data */}
        <div className="lg:col-span-2 space-y-6">
          {/* Identity & Contact */}
          <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-6">
            <h2 className="text-xl font-bold text-[#010139] mb-4 flex items-center gap-2">
              <FaUser className="text-[#8AAA19]" />
              Datos del {formData.broker_type === 'corredor' ? 'corredor' : 'agente'}
            </h2>

            {/* Tipo de Broker Toggle */}
            {isEditing && (
              <div className="mb-6 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border-2 border-[#8AAA19]">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Tipo de Broker
                </label>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, broker_type: 'corredor' })}
                    className={`
                      flex-1 px-6 py-3 rounded-lg font-semibold transition-all
                      ${formData.broker_type === 'corredor'
                        ? 'bg-[#010139] text-white shadow-lg scale-105'
                        : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-[#8AAA19]'
                      }
                    `}
                  >
                    📋 Corredor
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, broker_type: 'agente' })}
                    className={`
                      flex-1 px-6 py-3 rounded-lg font-semibold transition-all
                      ${formData.broker_type === 'agente'
                        ? 'bg-[#8AAA19] text-white shadow-lg scale-105'
                        : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-[#8AAA19]'
                      }
                    `}
                  >
                    🎫 Agente
                  </button>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  {formData.broker_type === 'corredor' 
                    ? '• Corredor: Muestra licencia, oculta código ASSA y carnet'
                    : '• Agente: Muestra código ASSA y carnet, oculta licencia'
                  }
                </p>
              </div>
            )}

            {/* Tipo actual (solo lectura) */}
            {!isEditing && (
              <div className="mb-4 inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg border-2 border-gray-300">
                <span className="text-sm font-semibold text-gray-600">Tipo:</span>
                <span className="px-3 py-1 bg-white rounded-full text-sm font-bold text-[#010139] border-2 border-[#8AAA19]">
                  {formData.broker_type === 'corredor' ? '📋 CORREDOR' : '🎫 AGENTE'}
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nombre completo
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={createUppercaseHandler((e) => setFormData({ ...formData, name: e.target.value }))}
                  disabled={!isEditing}
                  className={`w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none disabled:bg-gray-50 disabled:text-gray-600 ${!isEditing ? '' : uppercaseInputClass}`}
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <FaPhone className="text-[#8AAA19]" />
                  Teléfono
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={createUppercaseHandler((e) => setFormData({ ...formData, phone: e.target.value }))}
                  disabled={!isEditing}
                  className={`w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none disabled:bg-gray-50 disabled:text-gray-600 ${!isEditing ? '' : uppercaseInputClass}`}
                />
              </div>

              {/* National ID */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <FaIdCard className="text-[#8AAA19]" />
                  Cédula/Pasaporte
                </label>
                <input
                  type="text"
                  value={formData.national_id}
                  onChange={createUppercaseHandler((e) => setFormData({ ...formData, national_id: e.target.value }))}
                  disabled={!isEditing}
                  className={`w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none disabled:bg-gray-50 disabled:text-gray-600 ${!isEditing ? '' : uppercaseInputClass}`}
                />
              </div>

              {/* Birth Date */}
              <div className="min-w-0">
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <FaBirthdayCake className="text-[#8AAA19]" />
                  Fecha de nacimiento
                </label>
                <input
                  type="date"
                  value={formData.birth_date}
                  onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                  disabled={!isEditing}
                  className="w-full min-w-0 px-2 sm:px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none disabled:bg-gray-50 disabled:text-gray-600 appearance-none"
                />
              </div>

              {/* ASSA Code - Solo para AGENTE */}
              {formData.broker_type === 'agente' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Código ASSA
                  </label>
                  <input
                    type="text"
                    value={formData.assa_code}
                    onChange={createUppercaseHandler((e) => setFormData({ ...formData, assa_code: e.target.value }))}
                    disabled={!isEditing}
                    className={`w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none disabled:bg-gray-50 disabled:text-gray-600 ${!isEditing ? '' : uppercaseInputClass}`}
                  />
                </div>
              )}

              {/* License - Solo para CORREDOR */}
              {formData.broker_type === 'corredor' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Licencia
                  </label>
                  <input
                    type="text"
                    value={formData.license_no}
                    onChange={createUppercaseHandler((e) => setFormData({ ...formData, license_no: e.target.value }))}
                    disabled={!isEditing}
                    className={`w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none disabled:bg-gray-50 disabled:text-gray-600 ${!isEditing ? '' : uppercaseInputClass}`}
                  />
                </div>
              )}

              {/* Carnet Expiry Date - Solo para AGENTE */}
              {formData.broker_type === 'agente' && (
                <div className="min-w-0">
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <FaCalendar className="text-[#8AAA19]" />
                    Vencimiento Carnet
                  </label>
                  <input
                    type="date"
                    value={formData.carnet_expiry_date}
                    onChange={(e) => setFormData({ ...formData, carnet_expiry_date: e.target.value })}
                    disabled={!isEditing}
                    className="w-full min-w-0 px-2 sm:px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none disabled:bg-gray-50 disabled:text-gray-600 appearance-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.carnet_expiry_date && (() => {
                    const today = new Date();
                    const expiryDate = new Date(formData.carnet_expiry_date);
                    const diffTime = expiryDate.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    if (diffDays < 0) {
                      return <span className="text-red-600 font-semibold">⚠️ Carnet vencido hace {Math.abs(diffDays)} días</span>;
                    } else if (diffDays <= 60) {
                      return <span className="text-orange-600 font-semibold">⚠️ Vence en {diffDays} días</span>;
                    } else {
                      return <span className="text-green-600">✓ Vence en {diffDays} días</span>;
                    }
                  })()}
                  {!formData.carnet_expiry_date && 'Sin fecha de vencimiento configurada'}
                </p>
                </div>
              )}
            </div>
          </div>

          {/* Percent Default */}
          <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-6">
            <h2 className="text-xl font-bold text-[#010139] mb-4 flex items-center gap-2">
              <FaPercentage className="text-[#8AAA19]" />
              % Default de comisión
            </h2>

            <div className="space-y-4">
              {/* Rol */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Rol del Usuario
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  disabled={!isEditing}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none disabled:bg-gray-50 disabled:text-gray-600"
                >
                  <option value="broker">Broker</option>
                  <option value="master">Master</option>
                </select>
                {isEditing && (
                  <p className="text-xs text-amber-600 mt-2">
                    ⚠️ El cambio de rol se aplicará en el próximo inicio de sesión
                  </p>
                )}
              </div>

              {/* % Comisión Default */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  % Comisión Default
                </label>
                <select
                  value={formData.percent_default}
                  onChange={(e) => setFormData({ ...formData, percent_default: parseFloat(e.target.value) })}
                  disabled={!isEditing}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none disabled:bg-gray-50 disabled:text-gray-600"
                >
                  {PERCENT_OPTIONS.map((percent) => (
                    <option key={percent} value={percent}>
                      {(percent * 100).toFixed(0)}% ({percent.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              {isOficina && (
                <p className="text-xs text-gray-500 mt-1">
                  Oficina siempre tiene 100% bloqueado
                </p>
              )}

              {!isOficina && (
                <button
                  onClick={handleApplyDefaultToAll}
                  className="w-full px-4 py-3 bg-[#8AAA19] hover:bg-[#7a9916] text-white rounded-lg transition-all font-semibold"
                >
                  Aplicar % default a todas las pólizas
                </button>
              )}
            </div>
          </div>

          {/* Bank Data ACH */}
          <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-6">
            <h2 className="text-xl font-bold text-[#010139] mb-4 flex items-center gap-2">
              <FaUniversity className="text-[#8AAA19]" />
              Datos bancarios ACH
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Bank Route - Dropdown */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Banco
                </label>
                {isEditing ? (
                  <BankSelect
                    value={formData.bank_route}
                    onChange={(route) => setFormData({ ...formData, bank_route: route })}
                    required
                  />
                ) : (
                  <div className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg bg-gray-50 text-gray-600">
                    {formData.bank_route || 'No especificado'}
                  </div>
                )}
              </div>

              {/* Account Type - Dropdown */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tipo de cuenta
                </label>
                {isEditing ? (
                  <AccountTypeSelect
                    value={formData.tipo_cuenta}
                    onChange={(type) => setFormData({ ...formData, tipo_cuenta: type })}
                    required
                  />
                ) : (
                  <div className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg bg-gray-50 text-gray-600">
                    {formData.tipo_cuenta === '03' ? 'Corriente' : formData.tipo_cuenta === '04' ? 'Ahorro' : 'No especificado'}
                  </div>
                )}
              </div>

              {/* Account Number */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Número de cuenta
                </label>
                <input
                  type="text"
                  value={formData.bank_account_no}
                  onChange={(e) => {
                    const cleaned = cleanAccountNumber(e.target.value);
                    setFormData({ ...formData, bank_account_no: cleaned });
                  }}
                  disabled={!isEditing}
                  maxLength={17}
                  placeholder="040012345678"
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none disabled:bg-gray-50 disabled:text-gray-600"
                />
                {isEditing && (
                  <p className="text-xs text-gray-500 mt-1">
                    Sin espacios ni guiones. Máx 17 caracteres.
                  </p>
                )}
              </div>

              {/* Nombre Completo (Titular ACH) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Titular de la cuenta
                </label>
                <input
                  type="text"
                  value={formData.nombre_completo}
                  onChange={(e) => {
                    const normalized = toUpperNoAccents(e.target.value);
                    setFormData({ ...formData, nombre_completo: normalized.substring(0, 22) });
                  }}
                  disabled={!isEditing || useBrokerData}
                  maxLength={22}
                  placeholder="JUAN PEREZ"
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none disabled:bg-gray-50 disabled:text-gray-600 uppercase"
                />
                {isEditing && (
                  <p className="text-xs text-gray-500 mt-1">
                    MAYÚSCULAS sin acentos. Máx 22 caracteres.
                  </p>
                )}
              </div>

              {/* Cédula del Titular */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Cédula del titular
                </label>
                <input
                  type="text"
                  value={formData.titular_cedula}
                  onChange={(e) => setFormData({ ...formData, titular_cedula: e.target.value })}
                  disabled={!isEditing || useBrokerData}
                  placeholder="8-123-4567"
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none disabled:bg-gray-50 disabled:text-gray-600"
                />
                {isEditing && (
                  <p className="text-xs text-gray-500 mt-1">
                    Cédula del titular de la cuenta bancaria.
                  </p>
                )}
              </div>
            </div>

            {/* Checkbox: Usar datos del broker */}
            {isEditing && (
              <div className="mt-4 p-4 bg-gray-50 border-2 border-gray-300 rounded-lg">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useBrokerData}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setUseBrokerData(checked);
                      if (checked) {
                        // Auto-llenar con datos del broker
                        const brokerName = toUpperNoAccents(formData.name || '').substring(0, 22);
                        setFormData({
                          ...formData,
                          nombre_completo: brokerName,
                          titular_cedula: formData.national_id
                        });
                      }
                    }}
                    className="w-4 h-4 text-[#8AAA19] border-gray-300 rounded focus:ring-[#8AAA19]"
                  />
                  <span className="text-sm font-semibold text-gray-700">
                    Usar mis datos personales (cuenta propia)
                  </span>
                </label>
                <p className="text-xs text-gray-500 mt-2">
                  Si la cuenta bancaria está a tu nombre, marca esta casilla para auto-llenar el titular y cédula.
                </p>
              </div>
            )}
            
            {!isEditing && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-800">
                  💡 <strong>Info ACH:</strong> Estos datos se usan para generar el archivo TXT de pagos ACH Banco General.
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-6">
            <div className="flex flex-wrap gap-3">
              {!isEditing ? (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-[#010139] to-[#020270] text-white rounded-lg hover:shadow-lg transition-all font-semibold flex items-center justify-center gap-2"
                  >
                    <FaEdit />
                    Editar
                  </button>
                  {!isOficina && (
                    <>
                      <button
                        onClick={handleForcePasswordChange}
                        disabled={saving}
                        className="flex-1 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-all font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        🔑 Forzar Cambio Contraseña
                      </button>
                      <button
                        onClick={handleDelete}
                        className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all font-semibold flex items-center justify-center gap-2"
                      >
                        <FaTrash />
                        Eliminar
                      </button>
                    </>
                  )}
                </>
              ) : (
                <>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 px-6 py-3 bg-[#8AAA19] hover:bg-[#7a9916] text-white rounded-lg transition-all font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <FaSave />
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      loadBroker();
                    }}
                    disabled={saving}
                    className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-all font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <FaTimes />
                    Cancelar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - KPIs & Shortcuts */}
        <div className="space-y-6">
          {/* KPIs */}
          <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-6">
            <h2 className="text-xl font-bold text-[#010139] mb-4 flex items-center gap-2">
              <FaChartLine className="text-[#8AAA19]" />
              KPIs del año
            </h2>

            <div className="space-y-4">
              {/* Paid Commissions */}
              <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border-l-4 border-[#8AAA19]">
                <p className="text-sm text-gray-600 mb-1">Comisiones netas pagadas</p>
                <p className="text-2xl font-bold text-[#8AAA19] font-mono">
                  ${broker.stats.totalPaid.toFixed(2)}
                </p>
              </div>

              {/* Advances Balance */}
              {broker.stats.advancesBalance > 0 && (
                <div className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg border-l-4 border-orange-500">
                  <p className="text-sm text-gray-600 mb-1">Saldo adelantos</p>
                  <p className="text-2xl font-bold text-orange-600 font-mono">
                    ${broker.stats.advancesBalance.toFixed(2)}
                  </p>
                  <Link
                    href="/commissions?tab=advances"
                    className="text-xs text-orange-600 hover:underline mt-1 inline-block"
                  >
                    Ver detalle →
                  </Link>
                </div>
              )}

              {/* Portfolio Count */}
              <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border-l-4 border-blue-500">
                <p className="text-sm text-gray-600 mb-1">Pólizas en cartera</p>
                <p className="text-2xl font-bold text-blue-600">
                  {broker.stats.policiesCount}
                </p>
              </div>
            </div>
          </div>

          {/* Shortcuts */}
          <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-6">
            <h2 className="text-xl font-bold text-[#010139] mb-4">
              Accesos rápidos
            </h2>

            <div className="space-y-2">
              <Link
                href={`/db?broker=${brokerId}`}
                className="block px-4 py-3 bg-gray-100 hover:bg-[#8AAA19] hover:text-white rounded-lg transition-all font-semibold flex items-center gap-2"
              >
                <FaDatabase />
                Ver cartera completa
              </Link>

              <Link
                href={`/commissions?broker=${brokerId}`}
                className="block px-4 py-3 bg-gray-100 hover:bg-[#8AAA19] hover:text-white rounded-lg transition-all font-semibold flex items-center gap-2"
              >
                <FaChartLine />
                Ver comisiones
              </Link>

              <Link
                href={`/agenda?broker=${brokerId}`}
                className="block px-4 py-3 bg-gray-100 hover:bg-[#8AAA19] hover:text-white rounded-lg transition-all font-semibold flex items-center gap-2"
              >
                <FaCalendar />
                Ver agenda
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
