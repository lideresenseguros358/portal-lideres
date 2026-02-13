'use client';

import { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { FaEraser, FaPen } from 'react-icons/fa';

interface SignaturePadProps {
  onSignatureComplete: (signatureDataUrl: string) => void;
  onCancel?: () => void;
}

export default function SignaturePad({ onSignatureComplete, onCancel }: SignaturePadProps) {
  const sigRef = useRef<SignatureCanvas>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  const handleClear = () => {
    sigRef.current?.clear();
    setIsEmpty(true);
  };

  const handleConfirm = () => {
    if (sigRef.current?.isEmpty()) {
      return;
    }
    const dataUrl = sigRef.current?.getTrimmedCanvas().toDataURL('image/png');
    if (dataUrl) {
      onSignatureComplete(dataUrl);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[10000] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#010139] to-[#020270] text-white p-5">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <FaPen /> Firma Digital del Asegurado
          </h3>
          <p className="text-sm text-white/80 mt-1">
            Firme con el dedo o mouse en el recuadro blanco
          </p>
        </div>

        {/* Canvas */}
        <div className="p-4">
          <div className="border-2 border-gray-300 rounded-xl overflow-hidden bg-white">
            <SignatureCanvas
              ref={sigRef}
              penColor="black"
              canvasProps={{
                className: 'w-full',
                style: { width: '100%', height: '200px' },
              }}
              onBegin={() => setIsEmpty(false)}
            />
          </div>
          <p className="text-xs text-gray-500 text-center mt-2">
            Firme dentro del recuadro. Esta firma se incluirá en el formulario de inspección.
          </p>
        </div>

        {/* Actions */}
        <div className="p-4 border-t bg-gray-50 flex gap-3">
          {onCancel && (
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              type="button"
            >
              Cancelar
            </button>
          )}
          <button
            onClick={handleClear}
            className="px-4 py-3 bg-red-100 text-red-700 rounded-lg font-semibold hover:bg-red-200 transition-colors flex items-center gap-2"
            type="button"
          >
            <FaEraser /> Borrar
          </button>
          <button
            onClick={handleConfirm}
            disabled={isEmpty}
            className={`flex-1 px-4 py-3 rounded-lg font-bold text-lg transition-all ${
              isEmpty
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white hover:shadow-xl'
            }`}
            type="button"
          >
            Confirmar Firma
          </button>
        </div>
      </div>
    </div>
  );
}
