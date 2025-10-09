'use client';

import { useState, useEffect } from 'react';
import { FaArrowLeft, FaEdit, FaSave, FaTimes, FaTrash, FaCheckCircle, FaTimesCircle, FaUser, FaPhone, FaIdCard, FaBirthdayCake, FaUniversity, FaPercentage, FaChartLine, FaCalendar, FaDatabase } from 'react-icons/fa';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { actionGetBroker, actionUpdateBroker, actionToggleBrokerActive, actionDeleteBroker, actionApplyDefaultPercentToAll } from '@/app/(app)/brokers/actions';
import { PERCENT_OPTIONS, OFICINA_EMAIL } from '@/lib/constants/brokers';
import { createUppercaseHandler, uppercaseInputClass, toUppercasePayload } from '@/lib/utils/uppercase';

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
        bank_account_no: result.data.bank_account_no || '',
        beneficiary_name: result.data.beneficiary_name || '',
        beneficiary_id: result.data.beneficiary_id || '',
        carnet_expiry_date: (result.data as any).carnet_expiry_date || '',
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
    const hasOverrides = false; // TODO: Check if there are policies with overrides
    const message = hasOverrides
      ? '¿Aplicar % default a TODAS las pólizas? Esto eliminará los overrides existentes.'
      : '¿Aplicar % default a todas las pólizas de este corredor?';

    if (!confirm(message)) {
      return;
    }

    const result = await actionApplyDefaultPercentToAll(brokerId);

    if (result.ok) {
      toast.success(result.message);
    } else {
      toast.error(result.error);
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
              Datos del corredor
            </h2>

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
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <FaBirthdayCake className="text-[#8AAA19]" />
                  Fecha de nacimiento
                </label>
                <input
                  type="date"
                  value={formData.birth_date}
                  onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                  disabled={!isEditing}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none disabled:bg-gray-50 disabled:text-gray-600"
                />
              </div>

              {/* ASSA Code */}
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

              {/* License */}
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

              {/* Carnet Expiry Date */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <FaCalendar className="text-[#8AAA19]" />
                  Vencimiento Carnet
                </label>
                <input
                  type="date"
                  value={formData.carnet_expiry_date}
                  onChange={(e) => setFormData({ ...formData, carnet_expiry_date: e.target.value })}
                  disabled={!isEditing}
                  className="w-full max-w-full px-3 sm:px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none disabled:bg-gray-50 disabled:text-gray-600"
                  style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }}
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
            </div>
          </div>

          {/* Percent Default */}
          <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-6">
            <h2 className="text-xl font-bold text-[#010139] mb-4 flex items-center gap-2">
              <FaPercentage className="text-[#8AAA19]" />
              % Default de comisión
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Porcentaje default
                </label>
                <select
                  value={formData.percent_default}
                  onChange={(e) => setFormData({ ...formData, percent_default: parseFloat(e.target.value) })}
                  disabled={!isEditing || isOficina}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none disabled:bg-gray-50 disabled:text-gray-600"
                >
                  {PERCENT_OPTIONS.map(p => (
                    <option key={p} value={p}>{(p * 100).toFixed(0)}%</option>
                  ))}
                </select>
                {isOficina && (
                  <p className="text-xs text-gray-500 mt-1">
                    Oficina siempre tiene 100% bloqueado
                  </p>
                )}
              </div>

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

          {/* Bank Data */}
          <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-6">
            <h2 className="text-xl font-bold text-[#010139] mb-4 flex items-center gap-2">
              <FaUniversity className="text-[#8AAA19]" />
              Datos bancarios
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Account Number */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nº de cuenta
                </label>
                <input
                  type="text"
                  value={formData.bank_account_no}
                  onChange={createUppercaseHandler((e) => setFormData({ ...formData, bank_account_no: e.target.value }))}
                  disabled={!isEditing}
                  className={`w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none disabled:bg-gray-50 disabled:text-gray-600 ${!isEditing ? '' : uppercaseInputClass}`}
                />
              </div>

              {/* Beneficiary Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Titular de la cuenta
                </label>
                <input
                  type="text"
                  value={formData.beneficiary_name}
                  onChange={createUppercaseHandler((e) => setFormData({ ...formData, beneficiary_name: e.target.value }))}
                  disabled={!isEditing}
                  className={`w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none disabled:bg-gray-50 disabled:text-gray-600 ${!isEditing ? '' : uppercaseInputClass}`}
                />
              </div>

              {/* Beneficiary ID */}
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Cédula del titular
                </label>
                <input
                  type="text"
                  value={formData.beneficiary_id}
                  onChange={createUppercaseHandler((e) => setFormData({ ...formData, beneficiary_id: e.target.value }))}
                  disabled={!isEditing}
                  className={`w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none disabled:bg-gray-50 disabled:text-gray-600 ${!isEditing ? '' : uppercaseInputClass}`}
                />
              </div>
            </div>
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
                    <button
                      onClick={handleDelete}
                      className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all font-semibold flex items-center justify-center gap-2"
                    >
                      <FaTrash />
                      Eliminar
                    </button>
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
