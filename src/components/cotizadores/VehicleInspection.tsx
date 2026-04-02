/**
 * Inspección Vehicular con Vista Superior
 * 9 puntos de foto para inspección completa (sin registro vehicular)
 */

'use client';

import { useState, useEffect, lazy, Suspense } from 'react';
import { FaCamera, FaCheck } from 'react-icons/fa';
import { toast } from 'sonner';

const CameraCapture = lazy(() => import('@/components/cotizadores/emision/CameraCapture'));

interface InspectionPhoto {
  id: string;
  name: string;
  instructions: string;
  file?: File;
  preview?: string;
}

interface VehicleInspectionProps {
  onContinue: (photos: InspectionPhoto[]) => void;
  isInternacional?: boolean;
}

export default function VehicleInspection({ onContinue, isInternacional = false }: VehicleInspectionProps) {
  // ORDEN DE CAPTURA: F, LI, LD, T, MA, KM, TB, AS, KEY, CH (IS only)
  const basePhotos: InspectionPhoto[] = [
    { id: 'frontal',      name: 'Vista Frontal',         instructions: 'Colócate frente al vehículo en un lugar abierto con buena iluminación natural. Captura el auto completo de frente — la placa delantera y los faros deben verse claramente.' },
    { id: 'lateral-izq',  name: 'Lateral Izquierdo',     instructions: 'Colócate al lado izquierdo (conductor) dejando suficiente distancia. Captura todo el lateral del vehículo de punta a punta con la carrocería completa.' },
    { id: 'lateral-der',  name: 'Lateral Derecho',       instructions: 'Colócate al lado derecho (pasajero) dejando suficiente distancia. Captura todo el lateral del vehículo de punta a punta con la carrocería completa.' },
    { id: 'trasera',      name: 'Vista Trasera',         instructions: 'Colócate detrás del vehículo en un lugar abierto con buena iluminación. La placa trasera y las luces deben verse con claridad.' },
    { id: 'motor',        name: 'Motor Abierto',         instructions: 'Abre el capó completamente y fotografia el compartimiento del motor desde arriba. El motor debe ocupar la mayor parte de la foto y ser claramente visible.' },
    { id: 'kilometraje',  name: 'Kilometraje',           instructions: 'Siéntate frente al tablero y fotografía el panel de instrumentos mostrando el marcador de kilometraje. El número de kilómetros debe leerse con claridad.' },
    { id: 'tablero',      name: 'Tablero',               instructions: 'Desde el asiento del conductor, captura el tablero completo mostrando todos los controles, pantallas e indicadores del vehículo.' },
    { id: 'asientos',     name: 'Asientos',              instructions: 'Desde la puerta delantera abierta, captura el interior mostrando los asientos delanteros y, de ser posible, los traseros.' },
    { id: 'llave',        name: 'Llave del Vehículo',    instructions: 'Coloca la llave del vehículo sobre una superficie plana con buena luz. Fotografíala de cerca para que se vea claramente el tipo y forma de la llave.' },
    ...(isInternacional ? [{ id: 'chasis-placa', name: 'Placa de Chasis (VIN)', instructions: 'Busca la plaquita metálica o etiqueta adhesiva con el número VIN de 17 dígitos. Primero revisa el marco interior de la puerta del conductor (abre la puerta y mira el borde metálico). Si no la encuentras ahí, búscala en la esquina inferior del parabrisas desde afuera, o en el tablero junto al parabrisas. El número VIN completo de 17 dígitos debe leerse perfectamente en la foto.' }] : []),
  ];
  const [photos, setPhotos] = useState<InspectionPhoto[]>(basePhotos);
  
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
  const [currentHighlight, setCurrentHighlight] = useState<number>(0);

  // IS-specific inspection questions (only for Cobertura Completa)
  const [tieneExtras, setTieneExtras] = useState(false);
  const [extrasSeleccionados, setExtrasSeleccionados] = useState<string[]>([]);
  const [extrasDetalle, setExtrasDetalle] = useState('');
  const [buenEstadoFisico, setBuenEstadoFisico] = useState(true);
  // Per-part damage conditions: key=partId, value='R'|'A'|'RA' (unlisted = 'B' bueno)
  const [partConditions, setPartConditions] = useState<Record<string, 'R' | 'A' | 'RA'>>({});

  // Official IS inspection form parts (matches formulario-inspeccion-auto.pdf)
  const INSPECTION_PARTS_LEFT = [
    { id: 'tapa_motor',        label: 'Tapa de Motor' },
    { id: 'parabrisas',        label: 'V/Parabrisas' },
    { id: 'parrilla_camisa',   label: 'Parrilla/Camisa' },
    { id: 'faroles',           label: 'Faroles' },
    { id: 'defensa_delantera', label: 'Defensa Delantera' },
    { id: 'deflector_del',     label: 'Deflector Del.' },
    { id: 'guard_del_lh',      label: 'Guard. Del. LH' },
    { id: 'guard_tras_lh',     label: 'Guard. Tras. LH' },
    { id: 'puerta_del_lh',     label: 'Puerta Del. LH' },
    { id: 'puerta_tras_lh',    label: 'Puerta Tras. LH' },
    { id: 'luces_direcc_del',  label: 'Luces Direcc. Del' },
    { id: 'lamp_def_tras',     label: 'Lamp. de Def. Tras.' },
  ];
  const INSPECTION_PARTS_RIGHT = [
    { id: 'tapa_baul',         label: 'Tapa del Baúl' },
    { id: 'vidrio_trasero',    label: 'Vidrio Trasero' },
    { id: 'luces_traseras',    label: 'Luces Traseras' },
    { id: 'defensas_traseras', label: 'Defensas Traseras' },
    { id: 'deflector_trasero', label: 'Deflector Trasero' },
    { id: 'guard_del_rh',      label: 'Guard. Del RH' },
    { id: 'guard_tras_rh',     label: 'Guard. Tras. RH' },
    { id: 'puerta_del_rh',     label: 'Puerta Del. RH' },
    { id: 'puerta_tras_rh',    label: 'Puerta Tras. RH' },
    { id: 'cond_ventanas',     label: 'Condición de Ventanas' },
    { id: 'cond_llantas',      label: 'Condición de Llantas' },
    { id: 'cond_general',      label: 'Condición General del Auto' },
  ];
  const DAMAGE_OPTIONS = [
    { value: 'R' as const,  label: 'R',  fullLabel: 'Regular' },
    { value: 'A' as const,  label: 'A',  fullLabel: 'Abollado' },
    { value: 'RA' as const, label: 'RA', fullLabel: 'Rayado/Roto' },
  ];

  const togglePartCondition = (partId: string, condition: 'R' | 'A' | 'RA') => {
    setPartConditions(prev => {
      const next = { ...prev };
      if (next[partId] === condition) {
        delete next[partId]; // Deselect → defaults to B (Bueno)
      } else {
        next[partId] = condition;
      }
      return next;
    });
  };

  const EXTRAS_OPTIONS = [
    'Alarma de Fca.', 'Otra Alarma', 'Inmobilizer', 'GPS', 'Copas de Lujo',
    'Rines Magnesio', 'Halógenos', 'Deflector de aire', 'Ventana de Techo',
    'Bola de Trailer', 'Retrovisores', 'Retrovisores c/señal/luz', 'Antena Eléctrica',
    'Mataburro', 'Estribos', 'Spoiler', 'Ext. Guardafango', 'Ventanas Eléctricas',
    'Papel Ahumado', 'Air Bags', 'Aire Acondicionado', 'Cierre de ptas. Elect.',
    'Tapicería de Tela', 'Tapicería de Cuero', 'Timón de posiciones',
    'Timón Hidráulico', 'Viceras con espejos', 'Asiento del. Entero',
    'Cd Player', 'R/Cassette', 'Bocinas', 'Amplificador', 'Ecualizador',
    'Teléfono', 'DVD',
  ];

  // Animación de parpadeo secuencial
  useEffect(() => {
    const nextIncompleteIndex = photos.findIndex(p => !p.file);
    if (nextIncompleteIndex !== -1) {
      setCurrentHighlight(nextIncompleteIndex);
    }
  }, [photos]);

  const handlePhotoCapture = (photoId: string) => {
    setActiveCameraId(photoId);
  };

  const handleCaptureComplete = async (file: File, photoId: string) => {
    setActiveCameraId(null);

    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen debe ser menor a 5MB');
      return;
    }

    const preview = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });

    setPhotos(prev => prev.map(photo =>
      photo.id === photoId ? { ...photo, file, preview } : photo
    ));
    const photoLabel = photos.find(p => p.id === photoId)?.name;
    toast.success(`Foto de ${photoLabel} capturada`);
  };

  const handleSubmit = () => {
    const missingPhotos = photos.filter(p => !p.file);
    
    if (missingPhotos.length > 0) {
      toast.error(`Faltan ${missingPhotos.length} foto(s) por capturar`);
      return;
    }

    // Attach IS inspection metadata to photos array for parent access
    const photosWithMeta = photos as any;
    if (isInternacional) {
      photosWithMeta._isInspectionData = {
        tieneExtras,
        extrasSeleccionados: tieneExtras ? extrasSeleccionados : [],
        extrasDetalle: tieneExtras ? extrasDetalle : '',
        buenEstadoFisico,
        partConditions: buenEstadoFisico ? {} : partConditions,
      };
      // Also store in sessionStorage for later PDF generation
      sessionStorage.setItem('isInspectionData', JSON.stringify({
        tieneExtras,
        extrasSeleccionados: tieneExtras ? extrasSeleccionados : [],
        extrasDetalle: tieneExtras ? extrasDetalle : '',
        buenEstadoFisico,
        partConditions: buenEstadoFisico ? {} : partConditions,
      }));
    }
    
    onContinue(photosWithMeta);
  };

  const completedCount = photos.filter(p => p.file).length;
  const progressPercent = (completedCount / photos.length) * 100;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-[#010139] mb-2">
          Inspección del Vehículo
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Toma fotos de las siguientes partes del vehículo
        </p>
        
        {/* Progress Bar */}
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>Progreso</span>
            <span className="font-bold">{completedCount} / {photos.length}</span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-[#8AAA19] to-[#6d8814] transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Vista Superior del Auto con Botónes Interactivos */}
      <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-bold text-[#010139] mb-4 text-center">
          🚗 Puntos de Inspección del Vehículo
        </h3>
        
        <div className="relative max-w-md mx-auto">
          {/* SVG Vista Superior del Auto */}
          <svg viewBox="0 0 240 400" className="w-full h-auto">
            {/* Definir animación de parpadeo */}
            <defs>
              <style>{`
                @keyframes pulse {
                  0%, 100% { opacity: 1; }
                  50% { opacity: 0.4; }
                }
                .pulse-active {
                  animation: pulse 1.5s ease-in-out infinite;
                }
              `}</style>
            </defs>
            
            {/* Cuerpo del auto */}
            <rect x="60" y="90" width="120" height="200" rx="20" fill="#e5e7eb" stroke="#4b5563" strokeWidth="2"/>
            
            {/* Parabrisas frontal */}
            <rect x="70" y="100" width="100" height="30" rx="5" fill="#93c5fd" stroke="#4b5563" strokeWidth="1"/>
            
            {/* Ventanas laterales */}
            <rect x="65" y="140" width="10" height="40" rx="2" fill="#93c5fd" stroke="#4b5563" strokeWidth="1"/>
            <rect x="165" y="140" width="10" height="40" rx="2" fill="#93c5fd" stroke="#4b5563" strokeWidth="1"/>
            <rect x="65" y="200" width="10" height="40" rx="2" fill="#93c5fd" stroke="#4b5563" strokeWidth="1"/>
            <rect x="165" y="200" width="10" height="40" rx="2" fill="#93c5fd" stroke="#4b5563" strokeWidth="1"/>
            
            {/* Parabrisas trasero */}
            <rect x="70" y="250" width="100" height="30" rx="5" fill="#93c5fd" stroke="#4b5563" strokeWidth="1"/>
            
            {/* Botón F - Frontal */}
            <g className="cursor-pointer">
              <circle 
                cx="120" 
                cy="70" 
                r="18" 
                fill={photos[0]?.file ? '#10b981' : '#3b82f6'} 
                stroke="#fff" 
                strokeWidth="3"
                className={currentHighlight === 0 && !photos[0]?.file ? 'pulse-active' : ''}
                onClick={() => handlePhotoCapture('frontal')}
                style={{ cursor: 'pointer' }}
              />
              <text x="120" y="76" textAnchor="middle" fill="#fff" fontSize="16" fontWeight="bold" style={{ pointerEvents: 'none' }}>F</text>
            </g>
            
            {/* Botón LI - Lateral Izquierdo */}
            <g className="cursor-pointer">
              <circle 
                cx="30" 
                cy="190" 
                r="18" 
                fill={photos[1]?.file ? '#10b981' : '#3b82f6'} 
                stroke="#fff" 
                strokeWidth="3"
                className={currentHighlight === 1 && !photos[1]?.file ? 'pulse-active' : ''}
                onClick={() => handlePhotoCapture('lateral-izq')}
                style={{ cursor: 'pointer' }}
              />
              <text x="30" y="196" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="bold" style={{ pointerEvents: 'none' }}>LI</text>
            </g>
            
            {/* Botón LD - Lateral Derecho */}
            <g className="cursor-pointer">
              <circle 
                cx="210" 
                cy="190" 
                r="18" 
                fill={photos[2]?.file ? '#10b981' : '#3b82f6'} 
                stroke="#fff" 
                strokeWidth="3"
                className={currentHighlight === 2 && !photos[2]?.file ? 'pulse-active' : ''}
                onClick={() => handlePhotoCapture('lateral-der')}
                style={{ cursor: 'pointer' }}
              />
              <text x="210" y="196" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="bold" style={{ pointerEvents: 'none' }}>LD</text>
            </g>
            
            {/* Botón T - Trasera */}
            <g className="cursor-pointer">
              <circle 
                cx="120" 
                cy="310" 
                r="18" 
                fill={photos[3]?.file ? '#10b981' : '#3b82f6'} 
                stroke="#fff" 
                strokeWidth="3"
                className={currentHighlight === 3 && !photos[3]?.file ? 'pulse-active' : ''}
                onClick={() => handlePhotoCapture('trasera')}
                style={{ cursor: 'pointer' }}
              />
              <text x="120" y="316" textAnchor="middle" fill="#fff" fontSize="16" fontWeight="bold" style={{ pointerEvents: 'none' }}>T</text>
            </g>
            
            {/* Botón MA - Motor Abierto (debajo de F) */}
            <g className="cursor-pointer">
              <circle 
                cx="120" 
                cy="115" 
                r="16" 
                fill={photos[4]?.file ? '#10b981' : '#3b82f6'} 
                stroke="#fff" 
                strokeWidth="3"
                className={currentHighlight === 4 && !photos[4]?.file ? 'pulse-active' : ''}
                onClick={() => handlePhotoCapture('motor')}
                style={{ cursor: 'pointer' }}
              />
              <text x="120" y="121" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="bold" style={{ pointerEvents: 'none' }}>MA</text>
            </g>
            
            {/* Botón KM - Kilometraje (izquierda, debajo de MA) */}
            <g className="cursor-pointer">
              <circle 
                cx="90" 
                cy="155" 
                r="16" 
                fill={photos[5]?.file ? '#10b981' : '#3b82f6'} 
                stroke="#fff" 
                strokeWidth="3"
                className={currentHighlight === 5 && !photos[5]?.file ? 'pulse-active' : ''}
                onClick={() => handlePhotoCapture('kilometraje')}
                style={{ cursor: 'pointer' }}
              />
              <text x="90" y="161" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="bold" style={{ pointerEvents: 'none' }}>KM</text>
            </g>
            
            {/* Botón TB - Tablero (derecha, debajo de MA) */}
            <g className="cursor-pointer">
              <circle 
                cx="150" 
                cy="155" 
                r="16" 
                fill={photos[6]?.file ? '#10b981' : '#3b82f6'} 
                stroke="#fff" 
                strokeWidth="3"
                className={currentHighlight === 6 && !photos[6]?.file ? 'pulse-active' : ''}
                onClick={() => handlePhotoCapture('tablero')}
                style={{ cursor: 'pointer' }}
              />
              <text x="150" y="161" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="bold" style={{ pointerEvents: 'none' }}>TB</text>
            </g>
            
            {/* Botón AS - Asientos (centro) */}
            <g className="cursor-pointer">
              <circle 
                cx="120" 
                cy="190" 
                r="16" 
                fill={photos[7]?.file ? '#10b981' : '#3b82f6'} 
                stroke="#fff" 
                strokeWidth="3"
                className={currentHighlight === 7 && !photos[7]?.file ? 'pulse-active' : ''}
                onClick={() => handlePhotoCapture('asientos')}
                style={{ cursor: 'pointer' }}
              />
              <text x="120" y="196" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="bold" style={{ pointerEvents: 'none' }}>AS</text>
            </g>
            
            {/* Botón KEY - Llaves (debajo de AS) */}
            <g className="cursor-pointer">
              <circle 
                cx="120" 
                cy="235" 
                r="16" 
                fill={photos[8]?.file ? '#10b981' : '#3b82f6'} 
                stroke="#fff" 
                strokeWidth="3"
                className={currentHighlight === 8 && !photos[8]?.file ? 'pulse-active' : ''}
                onClick={() => handlePhotoCapture('llave')}
                style={{ cursor: 'pointer' }}
              />
              <text x="120" y="241" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold" style={{ pointerEvents: 'none' }}>KEY</text>
            </g>
            
            {/* Botón CH - Placa de Chasis (debajo de KEY, solo IS) */}
            {isInternacional && photos[9] && (
              <g className="cursor-pointer">
                <circle 
                  cx="120" 
                  cy="270" 
                  r="16" 
                  fill={photos[9]?.file ? '#10b981' : '#3b82f6'} 
                  stroke="#fff" 
                  strokeWidth="3"
                  className={currentHighlight === 9 && !photos[9]?.file ? 'pulse-active' : ''}
                  onClick={() => handlePhotoCapture('chasis-placa')}
                  style={{ cursor: 'pointer' }}
                />
                <text x="120" y="276" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold" style={{ pointerEvents: 'none' }}>CH</text>
              </g>
            )}
          </svg>
        </div>

        {/* Leyenda */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-gray-600">Pendiente</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-gray-600">Completada</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
            <span className="text-gray-600">Siguiente sugerida</span>
          </div>
        </div>
      </div>

      {/* IS-specific: Inspection Questions for Cobertura Completa */}
      {isInternacional && (
        <div className="space-y-6">
          {/* Pregunta 1: Extras */}
          <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 p-6">
            <h3 className="text-lg font-bold text-[#010139] mb-4">
              🔧 ¿Su auto cuenta con extras?
            </h3>
            <p className="text-sm text-gray-600 mb-4">Favor detallar si aplica</p>

            <div className="flex items-center gap-4 mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="tieneExtras"
                  checked={tieneExtras === true}
                  onChange={() => setTieneExtras(true)}
                  className="w-4 h-4 text-[#8AAA19]"
                />
                <span className="text-sm font-semibold text-gray-700">Sí</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="tieneExtras"
                  checked={tieneExtras === false}
                  onChange={() => { setTieneExtras(false); setExtrasSeleccionados([]); setExtrasDetalle(''); }}
                  className="w-4 h-4 text-[#8AAA19]"
                />
                <span className="text-sm font-semibold text-gray-700">No</span>
              </label>
            </div>

            {tieneExtras && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {EXTRAS_OPTIONS.map((extra) => (
                    <label key={extra} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={extrasSeleccionados.includes(extra)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setExtrasSeleccionados(prev => [...prev, extra]);
                          } else {
                            setExtrasSeleccionados(prev => prev.filter(x => x !== extra));
                          }
                        }}
                        className="w-4 h-4 text-[#8AAA19] rounded"
                      />
                      <span className="text-gray-700">{extra}</span>
                    </label>
                  ))}
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Detallar extras con valores exactos
                  </label>
                  <textarea
                    value={extrasDetalle}
                    onChange={(e) => setExtrasDetalle(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2.5 text-sm border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none resize-none"
                    placeholder="Ej: Rines Magnesio $500, Alarma $200..."
                  />
                </div>
              </div>
            )}
          </div>

          {/* Pregunta 2: Estado Físico */}
          <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 p-6">
            <h3 className="text-lg font-bold text-[#010139] mb-4">
              🚗 ¿Su vehículo se encuentra en buen estado físico?
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Si marca &quot;Sí&quot;, todas las partes del vehículo se considerarán en buen estado.
            </p>
            
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="buenEstadoFisico"
                  checked={buenEstadoFisico === true}
                  onChange={() => { setBuenEstadoFisico(true); setPartConditions({}); }}
                  className="w-4 h-4 text-[#8AAA19]"
                />
                <span className="text-sm font-semibold text-gray-700">Sí, en buen estado</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="buenEstadoFisico"
                  checked={buenEstadoFisico === false}
                  onChange={() => setBuenEstadoFisico(false)}
                  className="w-4 h-4 text-[#8AAA19]"
                />
                <span className="text-sm font-semibold text-gray-700">No</span>
              </label>
            </div>
            
            {buenEstadoFisico && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-xs text-green-800">
                  ✅ Todas las partes del vehículo se marcarán como en buen estado en el formulario de inspección.
                </p>
              </div>
            )}

            {/* ── Damage Checklist (only when buenEstadoFisico = false) ── */}
            {!buenEstadoFisico && (
              <div className="mt-4 space-y-4">
                {/* Instructions */}
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg">
                  <p className="text-sm font-semibold text-amber-900 mb-1">
                    ⚠️ Marque únicamente las piezas que presentan algún daño
                  </p>
                  <p className="text-xs text-amber-800">
                    Las piezas que no marque se considerarán automáticamente en buen estado (B).
                    Seleccione el tipo de daño para cada pieza afectada:
                    <strong> R</strong> = Regular,
                    <strong> A</strong> = Abollado,
                    <strong> RA</strong> = Rayado/Roto.
                  </p>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block w-7 h-5 rounded bg-yellow-400 text-center text-[10px] font-bold leading-5 text-yellow-900">R</span>
                    <span className="text-gray-600">Regular</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block w-7 h-5 rounded bg-orange-400 text-center text-[10px] font-bold leading-5 text-white">A</span>
                    <span className="text-gray-600">Abollado</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block w-7 h-5 rounded bg-red-500 text-center text-[10px] font-bold leading-5 text-white">RA</span>
                    <span className="text-gray-600">Rayado/Roto</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block w-7 h-5 rounded bg-gray-200 text-center text-[10px] font-bold leading-5 text-gray-500">—</span>
                    <span className="text-gray-600">Bueno (sin marcar)</span>
                  </div>
                </div>

                {/* Two-column parts grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Left column */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-[#010139] text-white text-xs font-bold px-3 py-2 text-center">
                      Lado Izquierdo / Frontal
                    </div>
                    <div className="divide-y divide-gray-100">
                      {INSPECTION_PARTS_LEFT.map((part) => (
                        <div key={part.id} className="flex items-center px-2 py-1.5 hover:bg-gray-50">
                          <span className="flex-1 text-xs font-medium text-gray-700 truncate pr-1">{part.label}</span>
                          <div className="flex gap-1 flex-shrink-0">
                            {DAMAGE_OPTIONS.map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => togglePartCondition(part.id, opt.value)}
                                className={`w-8 h-6 rounded text-[10px] font-bold transition-all ${
                                  partConditions[part.id] === opt.value
                                    ? opt.value === 'R'
                                      ? 'bg-yellow-400 text-yellow-900 ring-2 ring-yellow-500'
                                      : opt.value === 'A'
                                        ? 'bg-orange-400 text-white ring-2 ring-orange-500'
                                        : 'bg-red-500 text-white ring-2 ring-red-600'
                                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right column */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-[#010139] text-white text-xs font-bold px-3 py-2 text-center">
                      Lado Derecho / Trasero
                    </div>
                    <div className="divide-y divide-gray-100">
                      {INSPECTION_PARTS_RIGHT.map((part) => (
                        <div key={part.id} className="flex items-center px-2 py-1.5 hover:bg-gray-50">
                          <span className="flex-1 text-xs font-medium text-gray-700 truncate pr-1">{part.label}</span>
                          <div className="flex gap-1 flex-shrink-0">
                            {DAMAGE_OPTIONS.map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => togglePartCondition(part.id, opt.value)}
                                className={`w-8 h-6 rounded text-[10px] font-bold transition-all ${
                                  partConditions[part.id] === opt.value
                                    ? opt.value === 'R'
                                      ? 'bg-yellow-400 text-yellow-900 ring-2 ring-yellow-500'
                                      : opt.value === 'A'
                                        ? 'bg-orange-400 text-white ring-2 ring-orange-500'
                                        : 'bg-red-500 text-white ring-2 ring-red-600'
                                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Summary of damaged parts */}
                {Object.keys(partConditions).length > 0 && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-xs font-semibold text-red-800 mb-1">
                      🔴 Piezas con daño marcado ({Object.keys(partConditions).length}):
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(partConditions).map(([partId, condition]) => {
                        const allParts = [...INSPECTION_PARTS_LEFT, ...INSPECTION_PARTS_RIGHT];
                        const part = allParts.find(p => p.id === partId);
                        return (
                          <span key={partId} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            condition === 'R' ? 'bg-yellow-100 text-yellow-800' :
                            condition === 'A' ? 'bg-orange-100 text-orange-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {part?.label || partId} ({condition})
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {Object.keys(partConditions).length === 0 && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-800">
                      ℹ️ No ha marcado ninguna pieza con daño. Si el vehículo realmente está en buen estado, seleccione &quot;Sí&quot; arriba.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Botón Continuar */}
      <div className="space-y-3">
        {completedCount < photos.length && (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 text-center">
            <p className="text-sm text-amber-800">
              ⚠️ Faltan <span className="font-bold">{photos.length - completedCount}</span> foto(s) por capturar
            </p>
          </div>
        )}
        
        <button
          onClick={handleSubmit}
          disabled={completedCount < photos.length}
          className={`w-full px-8 py-4 rounded-xl font-bold text-lg transition-all transform ${
            completedCount === photos.length
              ? 'bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white hover:shadow-2xl hover:scale-105'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
          type="button"
        >
          {completedCount === photos.length 
            ? 'Continuar a Información de Pago →' 
            : 'Completa todas las fotos'}
        </button>
      </div>

      {/* ── CameraCapture modal ───────────────────── */}
      {activeCameraId && (() => {
        const activePhoto = photos.find(p => p.id === activeCameraId);
        if (!activePhoto) return null;
        return (
          <Suspense fallback={null}>
            <CameraCapture
              label={activePhoto.name}
              instructions={activePhoto.instructions}
              photoId={activePhoto.id}
              onCapture={handleCaptureComplete}
              onClose={() => setActiveCameraId(null)}
            />
          </Suspense>
        );
      })()}
    </div>
  );
}
