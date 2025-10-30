'use client';

import { useState, useEffect } from 'react';
import { FaCheck, FaTimes, FaInfoCircle } from 'react-icons/fa';
import { AUTO_THIRD_PARTY_INSURERS, COVERAGE_LABELS, AutoThirdPartyPlan, AutoInsurer } from '@/lib/constants/auto-quotes';
import InsurerLogo from '@/components/shared/InsurerLogo';

interface ThirdPartyComparisonProps {
  onSelectPlan: (insurerId: string, planType: 'basic' | 'premium', plan: AutoThirdPartyPlan) => void;
}

export default function ThirdPartyComparison({ onSelectPlan }: ThirdPartyComparisonProps) {
  const [selectedPlan, setSelectedPlan] = useState<{insurer: AutoInsurer, plan: AutoThirdPartyPlan, type: 'basic' | 'premium'} | null>(null);
  const [showInstallmentsModal, setShowInstallmentsModal] = useState(false);
  const [insurerLogos, setInsurerLogos] = useState<Record<string, string | null>>({});

  useEffect(() => {
    // Cargar logos de aseguradoras
    fetch('/api/insurers')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const logos: Record<string, string | null> = {};
          data.insurers.forEach((ins: any) => {
            logos[ins.name.toUpperCase()] = ins.logo_url;
          });
          setInsurerLogos(logos);
        }
      })
      .catch(err => console.error('Error loading insurer logos:', err));
  }, []);

  const handlePlanClick = (insurer: AutoInsurer, plan: AutoThirdPartyPlan, type: 'basic' | 'premium') => {
    if (plan.installments.available) {
      setSelectedPlan({ insurer, plan, type });
      setShowInstallmentsModal(true);
    } else {
      onSelectPlan(insurer.id, type, plan);
    }
  };

  const handleConfirmInstallments = (useInstallments: boolean) => {
    if (selectedPlan) {
      setShowInstallmentsModal(false);
      onSelectPlan(selectedPlan.insurer.id, selectedPlan.type, selectedPlan.plan);
    }
  };

  const renderCoverageIcon = (value: string) => {
    if (value === 'no') {
      return <FaTimes className="text-red-500" size={16} />;
    } else if (value === 'sí') {
      return <FaCheck className="text-green-500" size={18} />;
    } else {
      return <FaCheck className="text-green-500" size={18} />;
    }
  };

  return (
    <>
      {/* Desktop View */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="p-4 text-left bg-gray-50 border-b-2 border-gray-200 sticky left-0 z-10">
                <span className="font-bold text-[#010139]">Cobertura</span>
              </th>
              {AUTO_THIRD_PARTY_INSURERS.map((insurer) => (
                <th key={insurer.id} className="p-4 text-center bg-gray-50 border-b-2 border-gray-200 min-w-[180px]">
                  <div className="flex flex-col items-center gap-2">
                    <InsurerLogo 
                      logoUrl={insurerLogos[insurer.name.toUpperCase()]}
                      insurerName={insurer.name}
                      size="md"
                    />
                    <span className="font-bold text-sm text-[#010139]">{insurer.name}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Basic Plans Row */}
            <tr className="bg-blue-50">
              <td className="p-4 font-semibold text-[#010139] sticky left-0 z-10 bg-blue-50">
                Plan Básico
              </td>
              {AUTO_THIRD_PARTY_INSURERS.map((insurer) => (
                <td key={`${insurer.id}-basic`} className="p-4 text-center border-x border-gray-200">
                  <div className="font-bold text-2xl text-[#010139] mb-2">
                    B/.{insurer.basicPlan.annualPremium.toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-600 mb-3">/año</div>
                  <button
                    onClick={() => handlePlanClick(insurer, insurer.basicPlan, 'basic')}
                    className="w-full px-4 py-2 bg-[#010139] hover:bg-[#020270] text-white rounded-lg transition-all font-semibold text-sm"
                  >
                    Seleccionar
                  </button>
                </td>
              ))}
            </tr>

            {/* Coverage Rows */}
            {Object.entries(COVERAGE_LABELS).map(([key, label]) => (
              <tr key={key} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="p-3 text-sm text-gray-700 sticky left-0 z-10 bg-white">
                  {label}
                </td>
                {AUTO_THIRD_PARTY_INSURERS.map((insurer) => {
                  const value = insurer.basicPlan.coverages[key as keyof typeof insurer.basicPlan.coverages];
                  return (
                    <td key={`${insurer.id}-${key}`} className="p-3 text-center text-sm border-x border-gray-100">
                      <div className="flex items-center justify-center gap-2">
                        {renderCoverageIcon(value)}
                        {value !== 'no' && value !== 'sí' && (
                          <span className="text-xs text-gray-600">{value}</span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* Premium Plans Row */}
            <tr className="bg-green-50">
              <td className="p-4 font-semibold text-[#010139] sticky left-0 z-10 bg-green-50">
                Plan Premium
              </td>
              {AUTO_THIRD_PARTY_INSURERS.map((insurer) => (
                <td key={`${insurer.id}-premium`} className="p-4 text-center border-x border-gray-200">
                  <div className="font-bold text-2xl text-[#8AAA19] mb-2">
                    B/.{insurer.premiumPlan.annualPremium.toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-600 mb-3">/año</div>
                  {insurer.premiumPlan.notes && (
                    <div className="text-xs text-gray-600 mb-2">{insurer.premiumPlan.notes}</div>
                  )}
                  <button
                    onClick={() => handlePlanClick(insurer, insurer.premiumPlan, 'premium')}
                    className="w-full px-4 py-2 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] hover:shadow-lg text-white rounded-lg transition-all font-semibold text-sm"
                  >
                    Seleccionar
                  </button>
                </td>
              ))}
            </tr>

            {/* Premium Coverage Rows */}
            {Object.entries(COVERAGE_LABELS).map(([key, label]) => (
              <tr key={`premium-${key}`} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="p-3 text-sm text-gray-700 sticky left-0 z-10 bg-white">
                  {label}
                </td>
                {AUTO_THIRD_PARTY_INSURERS.map((insurer) => {
                  const value = insurer.premiumPlan.coverages[key as keyof typeof insurer.premiumPlan.coverages];
                  return (
                    <td key={`${insurer.id}-premium-${key}`} className="p-3 text-center text-sm border-x border-gray-100">
                      <div className="flex items-center justify-center gap-2">
                        {renderCoverageIcon(value)}
                        {value !== 'no' && value !== 'sí' && (
                          <span className="text-xs text-gray-600">{value}</span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile View */}
      <div className="lg:hidden space-y-6">
        {AUTO_THIRD_PARTY_INSURERS.map((insurer) => (
          <div key={insurer.id} className="bg-white rounded-xl shadow-lg border-2 border-gray-100">
            {/* Insurer Header */}
            <div className={`${insurer.color} bg-opacity-10 p-4 border-b-2 border-gray-200`}>
              <div className="flex items-center gap-3">
                <InsurerLogo 
                  logoUrl={insurerLogos[insurer.name.toUpperCase()]}
                  insurerName={insurer.name}
                  size="lg"
                />
                <h3 className="font-bold text-lg text-[#010139]">{insurer.name}</h3>
              </div>
            </div>
            {/* Basic Plan */}
            <div className="p-4 border-b-2 border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-[#010139]">Plan Básico</span>
                <div className="text-right">
                  <div className="text-2xl font-bold text-[#010139]">
                    B/.{insurer.basicPlan.annualPremium.toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-600">/año</div>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {Object.entries(insurer.basicPlan.coverages).map(([key, value]) => (
                  <div key={key} className="flex items-start justify-between gap-2 text-sm">
                    <span className="text-gray-700">{COVERAGE_LABELS[key as keyof typeof COVERAGE_LABELS]}</span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {renderCoverageIcon(value)}
                      {value !== 'no' && value !== 'sí' && (
                        <span className="text-xs text-gray-600 max-w-[100px] text-right">{value}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => handlePlanClick(insurer, insurer.basicPlan, 'basic')}
                className="w-full px-4 py-3 bg-[#010139] hover:bg-[#020270] text-white rounded-lg transition-all font-semibold"
              >
                Seleccionar Plan Básico
              </button>
            </div>

            {/* Premium Plan */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-[#010139]">Plan Premium</span>
                <div className="text-right">
                  <div className="text-2xl font-bold text-[#8AAA19]">
                    B/.{insurer.premiumPlan.annualPremium.toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-600">/año</div>
                </div>
              </div>

              {insurer.premiumPlan.notes && (
                <div className="text-xs text-gray-600 mb-3 bg-yellow-50 border border-yellow-200 rounded p-2">
                  {insurer.premiumPlan.notes}
                </div>
              )}

              <div className="space-y-2 mb-4">
                {Object.entries(insurer.premiumPlan.coverages).map(([key, value]) => (
                  <div key={key} className="flex items-start justify-between gap-2 text-sm">
                    <span className="text-gray-700">{COVERAGE_LABELS[key as keyof typeof COVERAGE_LABELS]}</span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {renderCoverageIcon(value)}
                      {value !== 'no' && value !== 'sí' && (
                        <span className="text-xs text-gray-600 max-w-[100px] text-right">{value}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => handlePlanClick(insurer, insurer.premiumPlan, 'premium')}
                className="w-full px-4 py-3 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] hover:shadow-lg text-white rounded-lg transition-all font-semibold"
              >
                Seleccionar Plan Premium
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Installments Modal */}
      {showInstallmentsModal && selectedPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start gap-3 mb-6">
                <FaInfoCircle className="text-blue-500 flex-shrink-0 mt-1" size={24} />
                <div>
                  <h3 className="text-xl font-bold text-[#010139] mb-2">
                    Opciones de Pago
                  </h3>
                  <p className="text-gray-600 text-sm">
                    {selectedPlan.insurer.name} - {selectedPlan.plan.name}
                  </p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                {/* Annual Payment */}
                <div className="border-2 border-gray-200 rounded-lg p-4 hover:border-[#8AAA19] transition-all cursor-pointer"
                  onClick={() => handleConfirmInstallments(false)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-[#010139]">Pago Anual</span>
                    <span className="text-2xl font-bold text-[#8AAA19]">
                      B/.{selectedPlan.plan.annualPremium.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">Pago único al año</p>
                </div>

                {/* Installments Payment */}
                {selectedPlan.plan.installments.amount && selectedPlan.plan.installments.payments && (
                  <div className="border-2 border-[#8AAA19] bg-green-50 rounded-lg p-4 hover:border-[#6d8814] transition-all cursor-pointer"
                    onClick={() => handleConfirmInstallments(true)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-[#010139]">Pago en Cuotas</span>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-[#010139]">
                          B/.{selectedPlan.plan.installments.amount.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-600">
                          × {selectedPlan.plan.installments.payments} pagos
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{selectedPlan.plan.installments.description}</p>
                    <p className="text-xs text-[#8AAA19] font-semibold">
                      Total: B/.{(selectedPlan.plan.installments.amount * selectedPlan.plan.installments.payments).toFixed(2)}
                    </p>
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowInstallmentsModal(false)}
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
