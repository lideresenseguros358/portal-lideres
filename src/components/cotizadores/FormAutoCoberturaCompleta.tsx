/**
 * Formulario de Cotización - Auto Cobertura Completa
 * Con sliders interactivos para coberturas
 */

'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaCar, FaShieldAlt, FaUser } from 'react-icons/fa';
import Image from 'next/image';
import Link from 'next/link';
import { toast } from 'sonner';
import { useISCatalogs } from '@/hooks/useISCatalogs';
import Autocomplete, { AutocompleteOption } from '@/components/ui/Autocomplete';
import AutoCloseTooltip, { AutoCloseTooltipRef } from '@/components/ui/AutoCloseTooltip';
import Breadcrumb from '@/components/ui/Breadcrumb';

// Marcas comunes con logos
const COMMON_BRANDS = [
  { name: 'TOYOTA', logo: '/logos auto/TOYOTA.png', width: 80 },
  { name: 'KIA', logo: '/logos auto/KIA.png', width: 150 },
  { name: 'HYUNDAI', logo: '/logos auto/HYUNDAI.png', width: 80 },
  { name: 'SUZUKI', logo: '/logos auto/SUZUKI.png', width: 150 },
  { name: 'NISSAN', logo: '/logos auto/NISSAN.png', width: 80 },
  { name: 'GEELY', logo: '/logos auto/GEELY.png', width: 150 },
];

export default function FormAutoCoberturaCompleta() {
  const router = useRouter();
  const { marcas, modelos, selectedMarca, setSelectedMarca, loading: catalogsLoading } = useISCatalogs();
  const [showSearch, setShowSearch] = useState(false); // Toggle para mostrar búsqueda
  const [valorInputTemp, setValorInputTemp] = useState(''); // Estado temporal para input de valor
  
  // Refs para tooltips
  const lesionesTooltipRef = useRef<AutoCloseTooltipRef>(null);
  const danosPropiedadTooltipRef = useRef<AutoCloseTooltipRef>(null);
  const gastosMedicosTooltipRef = useRef<AutoCloseTooltipRef>(null);

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
  
  const [formData, setFormData] = useState({
    // Datos del cliente (para cotizar)
    nombreCompleto: '',
    fechaNacimiento: '',
    estadoCivil: 'soltero', // soltero, casado, divorciado, viudo
    
    // Datos del vehículo (para cotizar)
    marca: '', // Nombre de la marca (para mostrar)
    marcaCodigo: 0, // Código numérico de la marca (para API)
    modelo: '', // Nombre del modelo (para mostrar)
    modeloCodigo: 0, // Código numérico del modelo (para API)
    anno: new Date().getFullYear(),
    
    // Valor del vehículo
    valorVehiculo: 15000,
    
    // Coberturas con sliders
    lesionCorporalPersona: 10000, // Por persona
    lesionCorporalAccidente: 20000, // Por accidente
    danoPropiedad: 10000,
    gastosMedicosPersona: 2000, // Por persona
    gastosMedicosAccidente: 10000, // Por accidente
    
    // Deducible
    deducible: 'medio', // bajo, medio, alto
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Cargar datos guardados desde sessionStorage al montar (editMode o regreso de comparador)
  useEffect(() => {
    const savedData = sessionStorage.getItem('quoteInput');
    const isEditMode = sessionStorage.getItem('editMode') === 'true';
    
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        // Solo cargar si es del tipo correcto (auto cobertura completa)
        if (parsed.cobertura === 'COMPLETA') {
          setFormData({
            nombreCompleto: parsed.nombreCompleto || '',
            fechaNacimiento: parsed.fechaNacimiento || '',
            estadoCivil: parsed.estadoCivil || 'soltero',
            marca: parsed.marca || '',
            marcaCodigo: parsed.marcaCodigo || 0,
            modelo: parsed.modelo || '',
            modeloCodigo: parsed.modeloCodigo || 0,
            anno: parsed.anio || new Date().getFullYear(),
            valorVehiculo: parsed.valorVehiculo || 15000,
            lesionCorporalPersona: parsed.lesionCorporalPersona || 10000,
            lesionCorporalAccidente: parsed.lesionCorporalAccidente || 20000,
            danoPropiedad: parsed.danoPropiedad || 10000,
            gastosMedicosPersona: parsed.gastosMedicosPersona || 2000,
            gastosMedicosAccidente: parsed.gastosMedicosAccidente || 10000,
            deducible: parsed.deducible || 'medio',
          });
          
          // Si tiene marca seleccionada, restaurar la selección para cargar modelos
          if (parsed.marcaCodigo) {
            setSelectedMarca(parsed.marcaCodigo);
          }
          
          // Mensaje apropiado según contexto
          if (isEditMode) {
            toast.success('📝 Datos cargados para edición. Modifica lo que necesites y recotiza.');
            // Limpiar flag de editMode después de usarlo
            sessionStorage.removeItem('editMode');
          } else {
            toast.info('Datos cargados. Puedes editarlos y recotizar.');
          }
        }
      } catch (error) {
        console.error('Error al cargar datos guardados:', error);
      }
    }
  }, [setSelectedMarca]);

  // Opciones de coberturas según especificaciones
  const lesionCorporalOptions = [
    { persona: 5000, accidente: 10000 },
    { persona: 10000, accidente: 20000 },
    { persona: 25000, accidente: 50000 },
    { persona: 50000, accidente: 100000 },
    { persona: 100000, accidente: 300000 },
  ];
  
  const danoPropiedadOptions = [5000, 10000, 15000, 25000, 50000, 100000];
  
  const gastosMedicosOptions = [
    { persona: 500, accidente: 2500 },
    { persona: 2000, accidente: 10000 },
    { persona: 5000, accidente: 25000 },
    { persona: 10000, accidente: 50000 },
  ];
  
  // Generar opciones para valor del vehículo (50, 500, 1000)
  const generateVehiculoOptions = () => {
    const options: number[] = [];
    // De 5,000 a 10,000: incrementos de 500
    for (let i = 5000; i <= 10000; i += 500) options.push(i);
    // De 10,500 a 20,000: incrementos de 500
    for (let i = 10500; i <= 20000; i += 500) options.push(i);
    // De 21,000 a 50,000: incrementos de 1000
    for (let i = 21000; i <= 50000; i += 1000) options.push(i);
    // De 52,000 a 100,000: incrementos de 2000
    for (let i = 52000; i <= 100000; i += 2000) options.push(i);
    return options;
  };
  
  const vehiculoOptions = generateVehiculoOptions();
  const deducibleOptions = [
    { value: 'bajo', label: 'Bajo', description: 'Menor costo en reclamos' },
    { value: 'medio', label: 'Medio', description: 'Balance ideal' },
    { value: 'alto', label: 'Alto', description: 'Prima más económica' },
  ];

  // Generar años (2027 a 2016 para cobertura completa)
  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let year = currentYear + 1; year >= currentYear - 10; year--) {
    yearOptions.push(year);
  }

  // Función para seleccionar marca común
  const handleCommonBrandSelect = (brandName: string) => {
    const marca = marcas.find(m => m.TXT_MARCA.toUpperCase() === brandName.toUpperCase());
    if (marca) {
      setSelectedMarca(marca.COD_MARCA);
      setFormData({
        ...formData,
        marca: marca.TXT_MARCA,
        marcaCodigo: marca.COD_MARCA,
        modelo: '',
        modeloCodigo: 0,
      });
    }
  };

  // Validar si el formulario está completo
  const isFormComplete = useMemo(() => {
    return (
      formData.nombreCompleto.trim() !== '' &&
      formData.fechaNacimiento !== '' &&
      formData.marca !== '' &&
      formData.modelo !== '' &&
      formData.valorVehiculo > 0
    );
  }, [formData]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.nombreCompleto) newErrors.nombreCompleto = 'Requerido';
    if (!formData.fechaNacimiento) newErrors.fechaNacimiento = 'Requerido';
    if (!formData.marca) newErrors.marca = 'Requerido';
    if (!formData.modelo) newErrors.modelo = 'Requerido';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      toast.error('Por favor completa todos los campos requeridos');
      return;
    }
    
    // Guardar en sessionStorage y navegar
    sessionStorage.setItem('quoteInput', JSON.stringify({
      ...formData,
      policyType: 'AUTO',
      cobertura: 'COMPLETA',
      // Asegurar que códigos Y NOMBRES se guarden
      marcaCodigo: formData.marcaCodigo,
      marca: formData.marca, // NOMBRE de la marca
      modeloCodigo: formData.modeloCodigo,
      modelo: formData.modelo, // NOMBRE del modelo
      // Asegurar coberturas
      lesionCorporalPersona: formData.lesionCorporalPersona,
      lesionCorporalAccidente: formData.lesionCorporalAccidente,
      danoPropiedad: formData.danoPropiedad,
      gastosMedicosPersona: formData.gastosMedicosPersona,
      gastosMedicosAccidente: formData.gastosMedicosAccidente,
      deducible: formData.deducible,
    }));
    
    toast.success('Generando cotización...');
    router.push('/cotizadores/comparar');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb */}
        <Breadcrumb 
          items={[
            { label: 'Auto', href: '/cotizadores/auto' },
            { label: 'Cobertura Completa', icon: <FaCar /> },
          ]}
        />

        <div className="text-center mb-6 md:mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] rounded-full mb-3 md:mb-4">
            <FaCar className="text-white text-3xl md:text-4xl" />
          </div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-[#010139] mb-2 px-4">
            Cobertura Completa de Auto
          </h1>
          <p className="text-base md:text-lg text-gray-600 px-4">
            Protección total para tu vehículo
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8">
          {/* Datos del Vehículo */}
          <div className="bg-white rounded-xl md:rounded-2xl shadow-lg border-2 border-gray-100 p-4 md:p-6 lg:p-8">
            <h2 className="text-xl md:text-2xl font-bold text-[#010139] mb-2 flex items-center gap-2 md:gap-3">
              <FaCar className="text-[#8AAA19]" />
              Datos del Vehículo
            </h2>
            <div className="flex items-center text-sm text-gray-600 mb-4 md:mb-6">
              Primero seleccione la marca y luego el modelo del vehículo
              <AutoCloseTooltip 
                content="Si no encuentra su marca dentro de las 6 opciones, presione el botón 'Otras Marcas' para buscarla en el listado completo de marcas disponibles."
              />
            </div>

            {/* Selección rápida de marcas comunes */}
            {!showSearch && (
              <div className="mb-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {COMMON_BRANDS.map((brand) => (
                    <button
                      key={brand.name}
                      type="button"
                      onClick={() => handleCommonBrandSelect(brand.name)}
                      disabled={catalogsLoading}
                      className={`p-4 rounded-xl border-2 transition-all hover:scale-105 cursor-pointer ${
                        formData.marca.toUpperCase() === brand.name
                          ? 'border-[#8AAA19] bg-[#8AAA19] shadow-lg'
                          : 'border-[#010139] bg-[#010139] hover:opacity-90 shadow-md'
                      }`}
                    >
                      <div className="flex items-center justify-center h-12">
                        <Image
                          src={brand.logo}
                          alt={brand.name}
                          width={brand.width || 80}
                          height={40}
                          className="object-contain max-h-full"
                        />
                      </div>
                    </button>
                  ))}
                </div>
                
                {/* Botón Otras Marcas */}
                <button
                  type="button"
                  onClick={() => setShowSearch(true)}
                  className="w-full mt-4 px-6 py-3 bg-[#8AAA19] text-white rounded-lg font-semibold hover:bg-[#6d8814] transition-colors shadow-md cursor-pointer"
                >
                  Otras Marcas
                </button>
              </div>
            )}

            {/* Búsqueda de marca */}
            {showSearch && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Marca <span className="text-red-500">*</span>
                    {catalogsLoading && <span className="text-xs text-gray-500 ml-2">(Cargando...)</span>}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowSearch(false)}
                    className="text-sm text-[#8AAA19] hover:text-[#6d8814] font-semibold"
                  >
                    ← Ver marcas comunes
                  </button>
                </div>
                <Autocomplete
                  options={marcasOptions}
                  value={selectedMarca || ''}
                  onChange={(value, option) => {
                    if (option) {
                      const codMarca = option.value as number;
                      setSelectedMarca(codMarca);
                      setFormData({
                        ...formData,
                        marca: option.label,
                        marcaCodigo: codMarca,
                        modelo: '',
                        modeloCodigo: 0,
                      });
                    } else {
                      setSelectedMarca(null);
                      setFormData({
                        ...formData,
                        marca: '',
                        marcaCodigo: 0,
                        modelo: '',
                        modeloCodigo: 0,
                      });
                    }
                  }}
                  placeholder="Buscar marca..."
                  disabled={catalogsLoading}
                  error={!!errors.marca}
                  loading={catalogsLoading}
                  emptyMessage="No hay marcas disponibles"
                />
                {errors.marca && <p className="text-red-500 text-sm mt-1">{errors.marca}</p>}
              </div>
            )}

            {/* Modelo y Año lado a lado */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div>
                <label className="flex items-center text-sm font-semibold text-gray-700 mb-2">
                  Modelo <span className="text-red-500 ml-1">*</span>
                  {catalogsLoading && selectedMarca && <span className="text-xs text-gray-500 ml-2">(Cargando...)</span>}
                  <AutoCloseTooltip 
                    content="El modelo del vehículo debe coincidir exactamente con el que aparece en su registro vehicular o título de propiedad."
                  />
                </label>
                <Autocomplete
                  options={modelosOptions}
                  value={formData.modeloCodigo || ''}
                  onChange={(value, option) => {
                    if (option) {
                      setFormData({
                        ...formData,
                        modelo: option.label,
                        modeloCodigo: option.value as number,
                      });
                    } else {
                      setFormData({
                        ...formData,
                        modelo: '',
                        modeloCodigo: 0,
                      });
                    }
                  }}
                  placeholder={!selectedMarca ? 'Primero selecciona una marca' : 'Buscar modelo...'}
                  disabled={!selectedMarca || catalogsLoading}
                  error={!!errors.modelo}
                  loading={catalogsLoading && !!selectedMarca}
                  emptyMessage={!selectedMarca ? 'Selecciona una marca primero' : 'No hay modelos disponibles'}
                />
                {errors.modelo && <p className="text-red-500 text-sm mt-1">{errors.modelo}</p>}
              </div>

              <div>
                <label className="flex items-center text-sm font-semibold text-gray-700 mb-2">
                  Año <span className="text-red-500 ml-1">*</span>
                  <AutoCloseTooltip 
                    content="Los vehículos deben tener máximo 10 años de antigüedad para cobertura completa. Si su vehículo es más antiguo, debe optar por la opción de daños a terceros."
                  />
                </label>
                <select
                  value={formData.anno}
                  onChange={(e) => setFormData({ ...formData, anno: parseInt(e.target.value) })}
                  className="w-full px-3 py-3 md:px-4 md:py-3 text-base border-2 border-gray-300 focus:border-[#8AAA19] rounded-lg focus:outline-none bg-white"
                  style={{ minHeight: '50px' }}
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

            </div>

            {/* Valor del Vehículo con Slider */}
            <div className="mt-6 md:mt-8">
              <label className="flex items-center text-sm font-semibold text-gray-700 mb-4">
                Valor del Vehículo <span className="text-red-500 ml-1">*</span>
                <AutoCloseTooltip 
                  content="Ingrese el valor del vehículo usando el número grande (es editable) o moviendo la barra inferior. El valor debe corresponder al precio de mercado actual o al monto indicado por su banco acreedor si el vehículo está financiado."
                />
              </label>
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 md:p-6 border-2 border-[#8AAA19]">
                {/* Input editable - estructura igualada a daños propiedad */}
                <div className="text-center mb-4">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={valorInputTemp || `$${formData.valorVehiculo.toLocaleString('en-US')}`}
                    onChange={(e) => {
                      setValorInputTemp(e.target.value);
                    }}
                    onFocus={(e) => {
                      setValorInputTemp('');
                      setTimeout(() => e.target.select(), 0);
                    }}
                    onBlur={(e) => {
                      const numStr = e.target.value.replace(/[$,]/g, '');
                      const num = parseInt(numStr);
                      if (!isNaN(num) && num >= 5000 && num <= 100000) {
                        setFormData({ ...formData, valorVehiculo: num });
                      }
                      setValorInputTemp('');
                    }}
                    className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#8AAA19] w-full text-center focus:outline-none focus:ring-0 bg-transparent transition-all cursor-pointer block p-0 m-0 leading-tight"
                    placeholder="$15,000"
                  />
                  <p className="text-xs sm:text-sm text-gray-600 font-medium mt-2">
                    👆 Toque para editar
                  </p>
                </div>
                
                {/* Slider con mejor responsive */}
                <div className="relative mt-4 px-1 pt-3">
                  <input
                    type="range"
                    min="0"
                    max={vehiculoOptions.length - 1}
                    value={(() => {
                      // Buscar índice exacto si existe
                      const exactIndex = vehiculoOptions.indexOf(formData.valorVehiculo);
                      if (exactIndex !== -1) return exactIndex;
                      
                      // Si no existe, encontrar el índice más cercado
                      if (vehiculoOptions.length === 0) return 0;
                      
                      let closestIndex = 0;
                      let minDiff = Math.abs((vehiculoOptions[0] ?? 0) - formData.valorVehiculo);
                      
                      for (let i = 1; i < vehiculoOptions.length; i++) {
                        const diff = Math.abs((vehiculoOptions[i] ?? 0) - formData.valorVehiculo);
                        if (diff < minDiff) {
                          minDiff = diff;
                          closestIndex = i;
                        }
                      }
                      
                      return closestIndex;
                    })()}
                    onChange={(e) => {
                      const index = parseInt(e.target.value);
                      setFormData({ ...formData, valorVehiculo: vehiculoOptions[index] || 15000 });
                    }}
                    className="w-full cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #8AAA19 0%, #8AAA19 ${((() => {
                        const exactIndex = vehiculoOptions.indexOf(formData.valorVehiculo);
                        if (exactIndex !== -1) return (exactIndex / (vehiculoOptions.length - 1)) * 100;
                        
                        if (vehiculoOptions.length === 0) return 0;
                        let closestIndex = 0;
                        let minDiff = Math.abs((vehiculoOptions[0] ?? 0) - formData.valorVehiculo);
                        for (let i = 1; i < vehiculoOptions.length; i++) {
                          const diff = Math.abs((vehiculoOptions[i] ?? 0) - formData.valorVehiculo);
                          if (diff < minDiff) {
                            minDiff = diff;
                            closestIndex = i;
                          }
                        }
                        return (closestIndex / (vehiculoOptions.length - 1)) * 100;
                      })())}%, #e5e7eb ${((() => {
                        const exactIndex = vehiculoOptions.indexOf(formData.valorVehiculo);
                        if (exactIndex !== -1) return (exactIndex / (vehiculoOptions.length - 1)) * 100;
                        
                        if (vehiculoOptions.length === 0) return 0;
                        let closestIndex = 0;
                        let minDiff = Math.abs((vehiculoOptions[0] ?? 0) - formData.valorVehiculo);
                        for (let i = 1; i < vehiculoOptions.length; i++) {
                          const diff = Math.abs((vehiculoOptions[i] ?? 0) - formData.valorVehiculo);
                          if (diff < minDiff) {
                            minDiff = diff;
                            closestIndex = i;
                          }
                        }
                        return (closestIndex / (vehiculoOptions.length - 1)) * 100;
                      })())}%, #e5e7eb 100%)`
                    }}
                  />
                  {/* Marcadores de referencia */}
                  <div className="hidden sm:flex justify-between absolute top-1/2 -translate-y-1/2 left-0 right-0 pointer-events-none px-2">
                    {[0, 20, 40, 60, 80, 100].map((percent) => {
                      const index = Math.floor((vehiculoOptions.length - 1) * (percent / 100));
                      const value = vehiculoOptions[index] ?? 0;
                      const isActive = formData.valorVehiculo >= value;
                      return (
                        <div key={percent} className={`w-1.5 h-1.5 rounded-full border transition-all ${
                          isActive ? 'bg-[#8AAA19] border-[#8AAA19]' : 'bg-white border-gray-400'
                        }`}></div>
                      );
                    })}
                  </div>
                </div>
                
                {/* Instrucciones y rango */}
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-xs sm:text-sm text-gray-600 font-semibold">
                    <span>$5,000</span>
                    <span>$100,000</span>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 text-center mt-2">
                    💡 Deslice la barra para ajustar el valor
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Límites de Cobertura */}
          <div className="bg-white rounded-xl md:rounded-2xl shadow-lg border-2 border-gray-100 p-4 md:p-6 lg:p-8">
            <h2 className="text-xl md:text-2xl font-bold text-[#010139] mb-4 md:mb-6 flex items-center gap-2 md:gap-3">
              <FaShieldAlt className="text-[#8AAA19]" />
              Límites de Cobertura
            </h2>

            {/* Lesión Corporal */}
            <div className="mb-6 md:mb-8">
              <label className="flex items-center text-sm md:text-base font-semibold text-gray-700 mb-3 md:mb-4">
                Lesiones corporales
                <AutoCloseTooltip 
                  ref={lesionesTooltipRef}
                  content="Cubren la responsabilidad del conductor asegurado por daños físicos causados a otras personas en un accidente (como atención médica, incapacidad o fallecimiento)."
                  autoOpenOnMount={true}
                />
              </label>
              <div className="bg-gradient-to-br from-[#8AAA19]/5 to-[#8AAA19]/10 rounded-xl p-4 md:p-6 border-2 border-[#8AAA19]/30 transition-all">
                <div className="text-center mb-4">
                  <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#010139] block">
                    {formatCurrency(formData.lesionCorporalPersona)} / {formatCurrency(formData.lesionCorporalAccidente)}
                  </span>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">por persona / por accidente</p>
                </div>
                <div className="relative px-1 pt-3">
                  <input
                    type="range"
                    min="0"
                    max={lesionCorporalOptions.length - 1}
                    value={lesionCorporalOptions.findIndex(opt => 
                      opt.persona === formData.lesionCorporalPersona && 
                      opt.accidente === formData.lesionCorporalAccidente
                    )}
                    onChange={(e) => {
                      const selected = lesionCorporalOptions[parseInt(e.target.value)];
                      if (selected) {
                        setFormData({ 
                          ...formData, 
                          lesionCorporalPersona: selected.persona,
                          lesionCorporalAccidente: selected.accidente
                        });
                      }
                    }}
                    className="w-full cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #8AAA19 0%, #8AAA19 ${(lesionCorporalOptions.findIndex(opt => opt.persona === formData.lesionCorporalPersona) / (lesionCorporalOptions.length - 1)) * 100}%, #e5e7eb ${(lesionCorporalOptions.findIndex(opt => opt.persona === formData.lesionCorporalPersona) / (lesionCorporalOptions.length - 1)) * 100}%, #e5e7eb 100%)`
                    }}
                  />
                  {/* Marcadores de referencia */}
                  <div className="hidden sm:flex justify-between absolute top-1/2 -translate-y-1/2 left-0 right-0 pointer-events-none px-2">
                    {lesionCorporalOptions.map((opt, idx) => {
                      const currentIndex = lesionCorporalOptions.findIndex(o => o.persona === formData.lesionCorporalPersona);
                      const isActive = idx <= currentIndex;
                      return (
                        <div key={idx} className={`w-1.5 h-1.5 rounded-full border transition-all ${
                          isActive ? 'bg-[#8AAA19] border-[#8AAA19]' : 'bg-white border-gray-400'
                        }`}></div>
                      );
                    })}
                  </div>
                </div>
                <div className="flex justify-between text-xs sm:text-sm text-gray-600 mt-3 font-medium">
                  <span className="text-left">{formatCurrency(lesionCorporalOptions[0]?.persona || 5000)}/{formatCurrency(lesionCorporalOptions[0]?.accidente || 10000)}</span>
                  <span className="text-right">{formatCurrency(lesionCorporalOptions[lesionCorporalOptions.length - 1]?.persona || 100000)}/{formatCurrency(lesionCorporalOptions[lesionCorporalOptions.length - 1]?.accidente || 300000)}</span>
                </div>
              </div>
            </div>

            {/* Daño a la Propiedad */}
            <div className="mb-6 md:mb-8">
              <label className="flex items-center text-sm md:text-base font-semibold text-gray-700 mb-3 md:mb-4">
                Daños a la propiedad ajena
                <AutoCloseTooltip 
                  ref={danosPropiedadTooltipRef}
                  content="Amparan los perjuicios materiales ocasionados a bienes de terceros, como otros vehículos, viviendas, cercas o postes."
                />
              </label>
              <div className="bg-gradient-to-br from-[#010139]/5 to-[#010139]/10 rounded-xl p-4 md:p-6 border-2 border-[#010139]/20 transition-all">
                <div className="text-center mb-4">
                  <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#010139]">
                    {formatCurrency(formData.danoPropiedad)}
                  </span>
                </div>
                <div className="relative px-1 pt-3">
                  <input
                    type="range"
                    min="0"
                    max={danoPropiedadOptions.length - 1}
                    value={danoPropiedadOptions.indexOf(formData.danoPropiedad)}
                    onChange={(e) => {
                      const selected = danoPropiedadOptions[parseInt(e.target.value)];
                      if (selected !== undefined) {
                        setFormData({ ...formData, danoPropiedad: selected });
                      }
                    }}
                    className="w-full cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #8AAA19 0%, #8AAA19 ${(danoPropiedadOptions.indexOf(formData.danoPropiedad) / (danoPropiedadOptions.length - 1)) * 100}%, #e5e7eb ${(danoPropiedadOptions.indexOf(formData.danoPropiedad) / (danoPropiedadOptions.length - 1)) * 100}%, #e5e7eb 100%)`
                    }}
                  />
                  {/* Marcadores de referencia */}
                  <div className="hidden sm:flex justify-between absolute top-1/2 -translate-y-1/2 left-0 right-0 pointer-events-none px-2">
                    {danoPropiedadOptions.map((val, idx) => {
                      const currentIndex = danoPropiedadOptions.indexOf(formData.danoPropiedad);
                      const isActive = idx <= currentIndex;
                      return (
                        <div key={idx} className={`w-1.5 h-1.5 rounded-full border transition-all ${
                          isActive ? 'bg-[#8AAA19] border-[#8AAA19]' : 'bg-white border-gray-400'
                        }`}></div>
                      );
                    })}
                  </div>
                </div>
                <div className="flex justify-between text-xs sm:text-sm text-gray-600 mt-3 font-medium">
                  <span>{formatCurrency(danoPropiedadOptions[0] || 5000)}</span>
                  <span>{formatCurrency(danoPropiedadOptions[danoPropiedadOptions.length - 1] || 100000)}</span>
                </div>
              </div>
            </div>

            {/* Gastos Médicos */}
            <div className="mb-6 md:mb-8">
              <label className="flex items-center text-sm md:text-base font-semibold text-gray-700 mb-3 md:mb-4">
                Gastos médicos
                <AutoCloseTooltip 
                  ref={gastosMedicosTooltipRef}
                  content="Cubren los costos de atención médica inmediata para el conductor y los ocupantes del vehículo asegurado, independientemente de quién haya tenido la culpa."
                />
              </label>
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 md:p-6 border-2 border-gray-200 transition-all">
                <div className="text-center mb-4">
                  <span className="text-2xl md:text-3xl font-bold text-[#010139] block">
                    {formatCurrency(formData.gastosMedicosPersona)} / {formatCurrency(formData.gastosMedicosAccidente)}
                  </span>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">por persona / por accidente</p>
                </div>
                <div className="relative px-1 pt-3">
                  <input
                    type="range"
                    min="0"
                    max={gastosMedicosOptions.length - 1}
                    value={gastosMedicosOptions.findIndex(opt => 
                      opt.persona === formData.gastosMedicosPersona &&
                      opt.accidente === formData.gastosMedicosAccidente
                    )}
                    onChange={(e) => {
                      const selected = gastosMedicosOptions[parseInt(e.target.value)];
                      if (selected) {
                        setFormData({ 
                          ...formData, 
                          gastosMedicosPersona: selected.persona,
                          gastosMedicosAccidente: selected.accidente
                        });
                      }
                    }}
                    className="w-full cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #8AAA19 0%, #8AAA19 ${(gastosMedicosOptions.findIndex(opt => opt.persona === formData.gastosMedicosPersona) / (gastosMedicosOptions.length - 1)) * 100}%, #e5e7eb ${(gastosMedicosOptions.findIndex(opt => opt.persona === formData.gastosMedicosPersona) / (gastosMedicosOptions.length - 1)) * 100}%, #e5e7eb 100%)`
                    }}
                  />
                  {/* Marcadores de referencia */}
                  <div className="hidden sm:flex justify-between absolute top-1/2 -translate-y-1/2 left-0 right-0 pointer-events-none px-2">
                    {gastosMedicosOptions.map((opt, idx) => {
                      const currentIndex = gastosMedicosOptions.findIndex(o => o.persona === formData.gastosMedicosPersona);
                      const isActive = idx <= currentIndex;
                      return (
                        <div key={idx} className={`w-1.5 h-1.5 rounded-full border transition-all ${
                          isActive ? 'bg-[#8AAA19] border-[#8AAA19]' : 'bg-white border-gray-400'
                        }`}></div>
                      );
                    })}
                  </div>
                </div>
                <div className="flex justify-between text-xs sm:text-sm text-gray-600 mt-3 font-medium">
                  <span className="text-left">{formatCurrency(gastosMedicosOptions[0]?.persona || 500)}/{formatCurrency(gastosMedicosOptions[0]?.accidente || 2500)}</span>
                  <span className="text-right">{formatCurrency(gastosMedicosOptions[gastosMedicosOptions.length - 1]?.persona || 10000)}/{formatCurrency(gastosMedicosOptions[gastosMedicosOptions.length - 1]?.accidente || 50000)}</span>
                </div>
              </div>
            </div>

            {/* Deducible */}
            <div>
              <label className="flex items-center text-sm md:text-base font-semibold text-gray-700 mb-3 md:mb-4">
                Deducible (tu parte en caso de reclamo)
                <AutoCloseTooltip 
                  content="El deducible en una póliza de auto es la parte del daño que asume el asegurado en un accidente o siniestro; la aseguradora cubre el resto según lo contratado. Mientras más alto sea el deducible, generalmente más baja es la prima del seguro."
                />
              </label>
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 md:p-6 border-2 border-gray-300">
                <p className="text-sm text-gray-600 text-center mb-4">
                  A menor deducible, mayor prima
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {deducibleOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, deducible: option.value })}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        formData.deducible === option.value
                          ? 'border-[#8AAA19] bg-[#8AAA19] text-white shadow-lg'
                          : 'border-gray-300 hover:border-[#8AAA19] bg-white'
                      }`}
                    >
                      <div className="text-xl font-bold">{option.label}</div>
                      <div className={`text-xs mt-2 ${
                        formData.deducible === option.value ? 'text-white/90' : 'text-gray-600'
                      }`}>
                        {option.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Datos del Cliente */}
          <div className="bg-white rounded-xl md:rounded-2xl shadow-lg border-2 border-gray-100 p-4 md:p-6 lg:p-8">
            <h2 className="text-xl md:text-2xl font-bold text-[#010139] mb-4 md:mb-6 flex items-center gap-2 md:gap-3">
              <FaUser className="text-[#8AAA19]" />
              Datos del Cliente
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nombre y Apellido <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.nombreCompleto}
                  onChange={(e) => setFormData({ ...formData, nombreCompleto: e.target.value })}
                  className={`w-full px-3 py-3 md:px-4 md:py-3 text-base border-2 rounded-lg focus:outline-none transition-colors ${
                    errors.nombreCompleto ? 'border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
                  }`}
                  placeholder="Ej: Juan Pérez"
                />
              </div>

              <div className="w-full max-w-full overflow-hidden">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Fecha de Nacimiento <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.fechaNacimiento}
                  onChange={(e) => setFormData({ ...formData, fechaNacimiento: e.target.value })}
                  className={`w-full max-w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border-2 rounded-lg focus:outline-none transition-colors ${
                    errors.fechaNacimiento ? 'border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
                  }`}
                  style={{ WebkitAppearance: 'none' }}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Estado Civil <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.estadoCivil}
                  onChange={(e) => setFormData({ ...formData, estadoCivil: e.target.value })}
                  className="w-full px-3 py-3 md:px-4 md:py-3 text-base border-2 border-gray-300 focus:border-[#8AAA19] rounded-lg focus:outline-none bg-white"
                >
                  <option value="soltero">Soltero(a)</option>
                  <option value="casado">Casado(a)</option>
                  <option value="divorciado">Divorciado(a)</option>
                  <option value="viudo">Viudo(a)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Sticky Bottom Bar con Botones - Solo visible cuando formulario está completo */}
          {isFormComplete && (
            <div 
              className="fixed inset-x-0 bottom-0 bg-white border-t-2 border-gray-200 shadow-2xl z-50 m-0 p-0 transition-all duration-500 ease-out"
              style={{
                animation: 'slideUpFadeIn 0.6s ease-out',
              }}
            >
              <div className="w-full px-4 py-4 sm:py-5">
                <div className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="w-full sm:flex-1 px-6 py-3 bg-gray-200 text-gray-700 hover:bg-gray-300 cursor-pointer rounded-lg font-bold text-base transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="w-full sm:flex-1 px-6 py-3 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white hover:shadow-xl cursor-pointer active:scale-95 rounded-lg font-bold text-base transition-all"
                  >
                    Ver Cotizaciones
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Espaciador para sticky bar - Solo cuando está visible */}
          {isFormComplete && <div className="h-20 sm:h-24"></div>}
        </form>
      </div>

      <style jsx>{`
        /* Animación suave del sticky bar */
        @keyframes slideUpFadeIn {
          0% {
            opacity: 0;
            transform: translateY(100%);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Sliders - thumb verde corporativo */
        input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          height: 20px;
          border-radius: 4px;
          outline: none;
        }
        
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 20px;
          height: 20px;
          background: #8AAA19;
          border: 3px solid white;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
          margin-top: -7px;
        }
        
        input[type="range"]::-moz-range-thumb {
          width: 20px;
          height: 20px;
          background: #8AAA19;
          border: 3px solid white;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        }
        
        input[type="range"]::-webkit-slider-runnable-track {
          height: 6px;
          border-radius: 4px;
        }
        
        input[type="range"]::-moz-range-track {
          height: 6px;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}
