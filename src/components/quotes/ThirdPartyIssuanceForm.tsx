'use client';

import { useState, useEffect, useMemo } from 'react';
import { FaUser, FaCar, FaIdCard, FaCheck, FaCreditCard } from 'react-icons/fa';
import { toast } from 'sonner';
import CreditCardInput from '@/components/is/CreditCardInput';
import { useISCatalogs } from '@/hooks/useISCatalogs';
import Autocomplete, { AutocompleteOption } from '@/components/ui/Autocomplete';

interface FormData {
  // Datos Personales
  firstName: string;
  lastName: string;
  nationalId: string;
  address: string;
  email: string;
  occupation: string;
  maritalStatus: string;
  birthDate: string;
  
  // Datos del Vehículo
  plateNumber: string;
  brand: string;
  model: string;
  year: number | '';
  vin: string;
  motorNumber: string;
  color: string;
  transmission: string;
  occupants: number | '';
  plateRenewalMonth: number | '';
  
  // Datos del Conductor
  sameAsContractor: boolean;
  driverFirstName: string;
  driverLastName: string;
  driverNationalId: string;
  driverBirthDate: string;
}

interface ThirdPartyIssuanceFormProps {
  insurerId: string;
  insurerName: string;
  planType: 'basic' | 'premium';
  annualPremium: number;
  onSubmit: (data: FormData) => Promise<void>;
}

const MARITAL_STATUS = ['Soltero/a', 'Casado/a', 'Divorciado/a', 'Viudo/a', 'Unión Libre'];

const TRANSMISSION_TYPES = ['Manual', 'Automático'];

const MONTHS = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
];

export default function ThirdPartyIssuanceForm({
  insurerId,
  insurerName,
  planType,
  annualPremium,
  onSubmit,
}: ThirdPartyIssuanceFormProps) {
  const { marcas, modelos, selectedMarca, setSelectedMarca, loading: catalogsLoading } = useISCatalogs();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Credit card data
  const [cardData, setCardData] = useState({
    cardNumber: '',
    expiry: '',
    cvv: '',
    cardholderName: '',
  });
  const [paymentValid, setPaymentValid] = useState(false);

  // Convertir marcas a opciones de autocomplete
  const marcasOptions = useMemo<AutocompleteOption[]>(() => 
    marcas.map(m => ({
      value: m.COD_MARCA,
      label: m.TXT_MARCA
    })),
    [marcas]
  );

  // Convertir modelos a opciones de autocomplete
  const modelosOptions = useMemo<AutocompleteOption[]>(() => 
    modelos.map(m => ({
      value: m.COD_MODELO,
      label: m.TXT_MODELO
    })),
    [modelos]
  );

  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    nationalId: '',
    address: '',
    email: '',
    occupation: '',
    maritalStatus: '',
    birthDate: '',
    plateNumber: '',
    brand: '',
    model: '',
    year: '',
    vin: '',
    motorNumber: '',
    color: '',
    transmission: '',
    occupants: '',
    plateRenewalMonth: '',
    sameAsContractor: true,
    driverFirstName: '',
    driverLastName: '',
    driverNationalId: '',
    driverBirthDate: '',
  });

  // Auto-fill driver data when "same as contractor" is checked
  useEffect(() => {
    if (formData.sameAsContractor) {
      setFormData(prev => ({
        ...prev,
        driverFirstName: prev.firstName,
        driverLastName: prev.lastName,
        driverNationalId: prev.nationalId,
        driverBirthDate: prev.birthDate,
      }));
    }
  }, [formData.sameAsContractor, formData.firstName, formData.lastName, formData.nationalId, formData.birthDate]);

  const handleChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1: // Datos Personales
        if (!formData.firstName || !formData.lastName || !formData.nationalId ||
            !formData.email || !formData.birthDate || !formData.maritalStatus) {
          toast.error('Por favor completa todos los campos obligatorios');
          return false;
        }
        // Validar email
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
          toast.error('Por favor ingresa un email válido');
          return false;
        }
        return true;

      case 2: // Datos del Vehículo
        if (!formData.plateNumber || !formData.brand || !formData.model ||
            !formData.year || !formData.color || !formData.transmission ||
            !formData.occupants || !formData.plateRenewalMonth) {
          toast.error('Por favor completa todos los campos obligatorios del vehículo');
          return false;
        }
        const currentYear = new Date().getFullYear();
        if (formData.year && (formData.year < 1900 || formData.year > currentYear + 1)) {
          toast.error('Por favor ingresa un año válido');
          return false;
        }
        return true;

      case 3: // Datos del Conductor
        if (!formData.sameAsContractor) {
          if (!formData.driverFirstName || !formData.driverLastName ||
              !formData.driverNationalId || !formData.driverBirthDate) {
            toast.error('Por favor completa todos los datos del conductor');
            return false;
          }
        }
        return true;

      case 4: // Pago con tarjeta
        if (!paymentValid) {
          toast.error('Por favor completa todos los datos de la tarjeta de crédito');
          return false;
        }
        return true;

      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => prev - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateStep(4)) return;

    setLoading(true);
    try {
      // Include card data in submission (cast to any for now, API will handle it)
      await onSubmit({ ...formData, paymentData: cardData } as any);
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error('Error al procesar el pago');
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-8">
      {[1, 2, 3, 4].map((step) => (
        <div key={step} className="flex items-center">
          <div className={`
            flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm
            ${currentStep === step ? 'bg-[#8AAA19] text-white' : 
              currentStep > step ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'}
          `}>
            {currentStep > step ? <FaCheck /> : step}
          </div>
          {step < 4 && (
            <div className={`w-8 md:w-16 h-1 ${currentStep > step ? 'bg-green-500' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );

  const renderPersonalDataStep = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-[#010139] p-3 rounded-full">
          <FaUser className="text-white" size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-[#010139]">Datos Personales del Contratante</h2>
          <p className="text-sm text-gray-600">Información del titular de la póliza</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Nombre <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.firstName}
            onChange={(e) => handleChange('firstName', e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition"
            placeholder="Juan"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Apellido <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.lastName}
            onChange={(e) => handleChange('lastName', e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition"
            placeholder="Pérez"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Cédula / Pasaporte <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.nationalId}
            onChange={(e) => handleChange('nationalId', e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition"
            placeholder="8-123-456"
          />
        </div>

        <div className="w-full max-w-full overflow-hidden">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Fecha de Nacimiento <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={formData.birthDate}
            onChange={(e) => handleChange('birthDate', e.target.value)}
            className="w-full max-w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition"
            max={new Date().toISOString().split('T')[0]}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Correo Electrónico <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition"
            placeholder="juan.perez@ejemplo.com"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Estado Civil <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.maritalStatus}
            onChange={(e) => handleChange('maritalStatus', e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition"
          >
            <option value="">Seleccionar...</option>
            {MARITAL_STATUS.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Dirección de Residencia <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.address}
            onChange={(e) => handleChange('address', e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition"
            placeholder="Calle, ciudad, provincia"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Ocupación
          </label>
          <input
            type="text"
            value={formData.occupation}
            onChange={(e) => handleChange('occupation', e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition"
            placeholder="Profesión u oficio"
          />
        </div>
      </div>
    </div>
  );

  const renderVehicleDataStep = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-[#8AAA19] p-3 rounded-full">
          <FaCar className="text-white" size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-[#010139]">Datos del Vehículo</h2>
          <p className="text-sm text-gray-600">Información del vehículo a asegurar</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Número de Placa <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.plateNumber}
            onChange={(e) => handleChange('plateNumber', e.target.value.toUpperCase())}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition uppercase font-mono"
            placeholder="ABC-1234"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Marca <span className="text-red-500">*</span>
            {catalogsLoading && <span className="text-xs text-gray-500 ml-2">(Cargando...)</span>}
          </label>
          <Autocomplete
            options={marcasOptions}
            value={selectedMarca || ''}
            onChange={(value, option) => {
              if (option) {
                const codMarca = option.value as number;
                setSelectedMarca(codMarca);
                handleChange('brand', option.label);
              } else {
                setSelectedMarca(null);
                handleChange('brand', '');
                handleChange('model', '');
              }
            }}
            placeholder="Buscar marca..."
            disabled={catalogsLoading}
            loading={catalogsLoading}
            emptyMessage="No hay marcas disponibles"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Modelo <span className="text-red-500">*</span>
            {catalogsLoading && selectedMarca && <span className="text-xs text-gray-500 ml-2">(Cargando...)</span>}
          </label>
          <Autocomplete
            options={modelosOptions}
            value={formData.model}
            onChange={(value, option) => {
              if (option) {
                handleChange('model', option.label);
              } else {
                handleChange('model', '');
              }
            }}
            placeholder={!selectedMarca ? 'Primero selecciona una marca' : 'Buscar modelo...'}
            disabled={!selectedMarca || catalogsLoading}
            loading={catalogsLoading && !!selectedMarca}
            emptyMessage={!selectedMarca ? 'Selecciona una marca primero' : 'No hay modelos disponibles'}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Año <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={formData.year}
            onChange={(e) => handleChange('year', parseInt(e.target.value) || '')}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition"
            placeholder="2020"
            min="1900"
            max={new Date().getFullYear() + 1}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Color <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.color}
            onChange={(e) => handleChange('color', e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition"
            placeholder="Blanco, Negro, Rojo, etc."
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Tipo de Transmisión <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.transmission}
            onChange={(e) => handleChange('transmission', e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition"
          >
            <option value="">Seleccionar...</option>
            {TRANSMISSION_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Cantidad de Ocupantes <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={formData.occupants}
            onChange={(e) => handleChange('occupants', parseInt(e.target.value) || '')}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition"
            placeholder="5"
            min="1"
            max="99"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Mes de Renovación de Placa <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.plateRenewalMonth}
            onChange={(e) => handleChange('plateRenewalMonth', parseInt(e.target.value) || '')}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition"
          >
            <option value="">Seleccionar...</option>
            {MONTHS.map((month) => (
              <option key={month.value} value={month.value}>{month.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Número VIN
          </label>
          <input
            type="text"
            value={formData.vin}
            onChange={(e) => handleChange('vin', e.target.value.toUpperCase())}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition uppercase font-mono"
            placeholder="17 caracteres"
            maxLength={17}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Número de Motor
          </label>
          <input
            type="text"
            value={formData.motorNumber}
            onChange={(e) => handleChange('motorNumber', e.target.value.toUpperCase())}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition uppercase font-mono"
            placeholder="Número de motor"
          />
        </div>
      </div>
    </div>
  );

  const renderDriverDataStep = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-[#010139] p-3 rounded-full">
          <FaIdCard className="text-white" size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-[#010139]">Datos del Conductor Principal</h2>
          <p className="text-sm text-gray-600">Información del conductor habitual del vehículo</p>
        </div>
      </div>

      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-6">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.sameAsContractor}
            onChange={(e) => handleChange('sameAsContractor', e.target.checked)}
            className="w-5 h-5 text-[#8AAA19] rounded focus:ring-[#8AAA19]"
          />
          <span className="font-semibold text-[#010139]">
            El conductor es el mismo que el contratante
          </span>
        </label>
      </div>

      {!formData.sameAsContractor && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Nombre del Conductor <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.driverFirstName}
              onChange={(e) => handleChange('driverFirstName', e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition"
              placeholder="Nombre"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Apellido del Conductor <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.driverLastName}
              onChange={(e) => handleChange('driverLastName', e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition"
              placeholder="Apellido"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Cédula del Conductor <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.driverNationalId}
              onChange={(e) => handleChange('driverNationalId', e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition"
              placeholder="8-123-456"
            />
          </div>

          <div className="w-full max-w-full overflow-hidden">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Fecha de Nacimiento <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.driverBirthDate}
              onChange={(e) => handleChange('driverBirthDate', e.target.value)}
              className="w-full max-w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition"
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>
      )}

      {formData.sameAsContractor && (
        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6 text-center">
          <FaCheck className="text-green-600 mx-auto mb-3" size={32} />
          <p className="text-green-800 font-semibold">
            Se utilizará la información del contratante para el conductor
          </p>
        </div>
      )}
    </div>
  );

  const renderPaymentStep = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-[#8AAA19] p-3 rounded-full">
          <FaCreditCard className="text-white" size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-[#010139]">Pago con Tarjeta de Crédito</h2>
          <p className="text-sm text-gray-600">Información de pago para emisión inmediata</p>
        </div>
      </div>

      <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="text-2xl">💳</div>
          <div>
            <p className="font-semibold text-[#010139] mb-1">Pago seguro</p>
            <p className="text-sm text-gray-700">
              Tu póliza será emitida inmediatamente una vez procesemos el pago con tu tarjeta de crédito. 
              Toda la información es encriptada y segura.
            </p>
          </div>
        </div>
      </div>

      <CreditCardInput
        onTokenReceived={(token, last4, brand) => {
          setCardData({ 
            ...cardData, 
            cardNumber: last4,
            cardholderName: `**** **** **** ${last4}` 
          });
          setPaymentValid(true);
          toast.success('Tarjeta validada correctamente');
        }}
        onError={(message) => {
          setPaymentValid(false);
          toast.error(message);
        }}
        environment="development"
      />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
      {/* Plan Summary */}
      <div className="bg-gradient-to-r from-[#010139] to-[#020270] text-white rounded-xl shadow-lg p-6 mb-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-2xl font-bold mb-1">{insurerName}</h3>
            <p className="text-white/80">Plan {planType === 'basic' ? 'Básico' : 'Premium'} - Daños a Terceros</p>
          </div>
          <div className="text-center md:text-right">
            <div className="text-4xl font-bold">B/.{annualPremium.toFixed(2)}</div>
            <div className="text-white/80 text-sm">/año</div>
          </div>
        </div>
      </div>

      {/* Step Indicator */}
      {renderStepIndicator()}

      {/* Form Content */}
      <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-6 md:p-8 mb-8">
        {currentStep === 1 && renderPersonalDataStep()}
        {currentStep === 2 && renderVehicleDataStep()}
        {currentStep === 3 && renderDriverDataStep()}
        {currentStep === 4 && renderPaymentStep()}
      </div>

      {/* Navigation Buttons */}
      <div className="flex flex-col-reverse md:flex-row gap-4 justify-between">
        {currentStep > 1 && (
          <button
            type="button"
            onClick={handlePrevious}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-semibold"
          >
            ← Anterior
          </button>
        )}

        <div className="flex-1" />

        {currentStep < 4 ? (
          <button
            type="button"
            onClick={handleNext}
            className="px-8 py-3 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-lg hover:shadow-lg transition-all font-semibold"
          >
            Siguiente →
          </button>
        ) : (
          <button
            type="submit"
            disabled={loading}
            className="px-8 py-3 bg-gradient-to-r from-[#010139] to-[#020270] text-white rounded-lg hover:shadow-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Procesando...
              </>
            ) : (
              <>
                <FaCreditCard />
                Emitir
              </>
            )}
          </button>
        )}
      </div>

      {/* Help Text */}
      <div className="mt-6 text-center text-sm text-gray-600">
        <p>Al emitir esta póliza, aceptas nuestros términos y condiciones.</p>
        <p className="mt-1">La póliza será emitida inmediatamente una vez procesemos el pago.</p>
      </div>
    </form>
  );
}
