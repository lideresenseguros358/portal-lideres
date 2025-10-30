'use client';

import { FaCheckCircle, FaShieldAlt } from 'react-icons/fa';
import Image from 'next/image';

interface QuoteResultsProps {
  idCotizacion: string;
  formData: any;
  coberturas?: any; // Mock data de coberturas
  onProceedToPayment: () => void;
}

export default function QuoteResults({ idCotizacion, formData, coberturas, onProceedToPayment }: QuoteResultsProps) {
  // MOCK: Prima calculada (en producción viene de /api/is/auto/coberturas)
  const primaCalculada = {
    primaNeta: 450.00,
    iva: 31.50,
    total: 481.50,
  };

  const coberturasIncluidas = [
    'Daños a terceros hasta $100,000',
    'Responsabilidad civil',
    'Asistencia vial 24/7',
    'Gastos médicos ocupantes',
    'Defensa jurídica',
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header con logo IS */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-8 rounded-lg shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">¡Cotización Generada!</h1>
            <p className="text-blue-100">ID: {idCotizacion}</p>
          </div>
          <div className="bg-white p-4 rounded-lg">
            <div className="text-blue-800 font-bold text-2xl">Internacional</div>
            <div className="text-blue-600 text-sm">de Seguros</div>
          </div>
        </div>
      </div>

      {/* Resumen del vehículo */}
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-bold text-[#010139] mb-4">Vehículo Asegurado</h2>
        <div className="flex items-center space-x-4">
          <FaShieldAlt className="text-[#8AAA19] text-4xl" />
          <div>
            <p className="text-lg font-semibold">{formData.vmarca_label} {formData.vmodelo_label}</p>
            <p className="text-gray-600">Año {formData.vanioauto}</p>
            <p className="text-sm text-gray-500">Suma asegurada: ${formData.vsumaaseg.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Prima */}
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-bold text-[#010139] mb-4">Prima de Seguro</h2>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-gray-200">
            <span className="text-gray-600">Prima Neta</span>
            <span className="font-mono font-semibold">${primaCalculada.primaNeta.toFixed(2)}</span>
          </div>
          
          <div className="flex justify-between items-center py-2 border-b border-gray-200">
            <span className="text-gray-600">IVA (7%)</span>
            <span className="font-mono">${primaCalculada.iva.toFixed(2)}</span>
          </div>
          
          <div className="flex justify-between items-center py-3 bg-[#8AAA19]/10 rounded-lg px-4">
            <span className="text-lg font-bold text-[#010139]">TOTAL A PAGAR</span>
            <span className="text-2xl font-bold text-[#8AAA19] font-mono">${primaCalculada.total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Coberturas incluidas */}
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-bold text-[#010139] mb-4">Coberturas Incluidas</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {coberturasIncluidas.map((cobertura, index) => (
            <div key={index} className="flex items-start space-x-2">
              <FaCheckCircle className="text-[#8AAA19] mt-1 flex-shrink-0" />
              <span className="text-gray-700">{cobertura}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Botón de proceder al pago */}
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-bold text-[#010139] mb-4">Siguiente Paso</h2>
        <p className="text-gray-600 mb-4">
          Para emitir su póliza, proceda con el pago usando su tarjeta de crédito o débito.
        </p>
        <button
          onClick={onProceedToPayment}
          className="w-full bg-[#8AAA19] text-white py-4 rounded-lg font-semibold text-lg hover:bg-[#8AAA19]/90 transition-colors shadow-md"
        >
          Proceder al Pago →
        </button>
      </div>
    </div>
  );
}
