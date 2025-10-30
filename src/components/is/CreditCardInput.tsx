'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

interface CreditCardInputProps {
  onTokenReceived: (token: string, last4: string, brand: string) => void;
  onError: (error: string) => void;
  environment?: 'development' | 'production';
}

export default function CreditCardInput({ onTokenReceived, onError, environment = 'development' }: CreditCardInputProps) {
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [bankName, setBankName] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [isFlipped, setIsFlipped] = useState(false);
  const [cardBrand, setCardBrand] = useState<'visa' | 'mastercard' | 'amex' | 'unknown'>('unknown');
  const [isProcessing, setIsProcessing] = useState(false);

  // Detectar marca por BIN (primeros 6 dígitos)
  const detectCardBrand = (number: string) => {
    const cleanNumber = number.replace(/\s/g, '');
    if (/^4/.test(cleanNumber)) return 'visa';
    if (/^5[1-5]/.test(cleanNumber)) return 'mastercard';
    if (/^3[47]/.test(cleanNumber)) return 'amex';
    return 'unknown';
  };

  // Validar que solo sea Visa o Mastercard
  const validateCardBrand = () => {
    if (cardBrand === 'amex') {
      onError('Lo sentimos, no aceptamos tarjetas American Express. Solo Visa y Mastercard.');
      return false;
    }
    if (cardBrand === 'unknown' && cardNumber.replace(/\s/g, '').length >= 4) {
      onError('Tipo de tarjeta no reconocido. Solo aceptamos Visa y Mastercard.');
      return false;
    }
    return true;
  };

  // Formatear número de tarjeta
  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    const maxLength = cardBrand === 'amex' ? 15 : 16;
    const truncated = cleaned.slice(0, maxLength);
    
    if (cardBrand === 'amex') {
      return truncated.replace(/(\d{4})(\d{6})(\d{5})/, '$1 $2 $3').trim();
    }
    return truncated.replace(/(\d{4})/g, '$1 ').trim();
  };

  // Formatear fecha de expiración
  const formatExpiry = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4);
    }
    return cleaned;
  };

  // Validación de Luhn
  const luhnCheck = (num: string) => {
    const arr = num.split('').reverse().map(x => parseInt(x));
    const lastDigit = arr.shift();
    let sum = arr.reduce((acc, val, i) => {
      return i % 2 === 0 ? acc + (val * 2 > 9 ? val * 2 - 9 : val * 2) : acc + val;
    }, 0);
    sum += lastDigit!;
    return sum % 10 === 0;
  };

  // Manejar cambio de número
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const brand = detectCardBrand(value);
    setCardBrand(brand);
    setCardNumber(formatCardNumber(value));
  };

  // Manejar cambio de expiración
  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setExpiry(formatExpiry(e.target.value));
  };

  // Procesar pago (MOCK - sin conexión real)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar marca de tarjeta primero
    if (!validateCardBrand()) {
      return;
    }
    
    // Validaciones
    const cleanNumber = cardNumber.replace(/\s/g, '');
    
    if (!cardName.trim()) {
      onError('Ingrese el nombre del titular');
      return;
    }
    
    if (cleanNumber.length < 15) {
      onError('Número de tarjeta incompleto');
      return;
    }
    
    if (!luhnCheck(cleanNumber)) {
      onError('Número de tarjeta inválido');
      return;
    }
    
    if (!expiry || expiry.length < 5) {
      onError('Fecha de expiración incompleta');
      return;
    }
    
    const [month, year] = expiry.split('/');
    if (!month || !year) {
      onError('Fecha de expiración inválida');
      return;
    }
    
    const expMonth = parseInt(month);
    const expYear = parseInt('20' + year);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    if (expMonth < 1 || expMonth > 12) {
      onError('Mes de expiración inválido');
      return;
    }
    
    if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
      onError('Tarjeta expirada');
      return;
    }
    
    if (!cvv || cvv.length < 3) {
      onError('CVV incompleto');
      return;
    }

    setIsProcessing(true);

    // MOCK: Simular tokenización (en producción esto llamaría a IS API)
    setTimeout(() => {
      const mockToken = `tok_${Math.random().toString(36).substring(7)}`;
      const last4 = cleanNumber.slice(-4);
      const brand = cardBrand === 'visa' ? 'Visa' : cardBrand === 'mastercard' ? 'Mastercard' : 'Amex';
      
      console.log('[MOCK] Token generado:', mockToken);
      console.log('[MOCK] Last4:', last4);
      console.log('[MOCK] Brand:', brand);
      
      setIsProcessing(false);
      onTokenReceived(mockToken, last4, brand);
    }, 1500);
  };

  return (
    <>
      <style jsx>{`
        @keyframes shimmer {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
      
    <div className="w-full max-w-md mx-auto">
      {/* Tarjeta 3D */}
      <div className="perspective-1000 mb-8">
        <motion.div
          className="relative w-full h-56 cursor-pointer"
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.6 }}
          style={{ transformStyle: 'preserve-3d' }}
          onMouseEnter={() => setIsFlipped(false)}
        >
          {/* Cara frontal */}
          <div
            className="absolute inset-0 backface-hidden rounded-2xl shadow-2xl overflow-hidden border border-gray-300"
            style={{
              background: 'linear-gradient(135deg, #e8e8e8 0%, #c0c0c0 50%, #d8d8d8 100%)',
              backgroundSize: '200% 200%',
              animation: 'shimmer 3s ease-in-out infinite',
              backfaceVisibility: 'hidden',
            }}
          >
            <div className="p-6 h-full flex flex-col justify-between relative">
              {/* Efecto metálico overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-black/10 pointer-events-none" />
              
              <div className="flex justify-between items-start relative z-10">
                {/* Favicon como chip */}
                <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-lg border border-gray-200">
                  <img src="/favicon.ico" alt="Logo" className="w-10 h-10 object-contain" />
                </div>
                
                <div className="text-right">
                  {cardBrand === 'visa' && (
                    <svg className="h-10 w-auto" viewBox="0 0 141 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect width="141" height="48" rx="4" fill="white"/>
                      <path d="M58.2 15.9L47.4 32.1H40.8L35.7 18.6C35.4 17.7 35.1 17.4 34.2 17.1C32.7 16.5 30.3 15.9 28.2 15.6L28.5 15H39.3C40.5 15 41.7 15.9 42 17.4L44.7 29.1L51.9 15H58.2V15.9ZM84.9 28.5C84.9 21.9 76.5 21.6 76.5 18.6C76.5 17.7 77.4 16.8 79.2 16.5C80.1 16.5 82.5 16.2 85.2 17.7L86.4 12.3C84.9 11.7 82.8 11.1 80.4 11.1C74.4 11.1 70.2 14.4 70.2 19.2C70.2 22.8 73.5 24.6 76.2 25.8C78.9 27 79.8 27.6 79.8 28.8C79.8 30.6 77.7 31.5 75.9 31.5C72.9 31.5 71.4 30.9 69 29.7L67.8 35.4C69.6 36.3 72.6 37.2 75.6 37.2C82.2 37.2 86.4 34.2 84.9 28.5ZM105.9 32.1H111.6L106.8 15H101.7C100.5 15 99.6 15.6 99 16.8L90.3 32.1H96.6L98.1 28.2H105.6L105.9 32.1V32.1ZM99.9 23.7L102.9 16.5L104.7 23.7H99.9ZM67.5 15L62.7 32.1H56.7L61.5 15H67.5Z" fill="#1434CB"/>
                    </svg>
                  )}
                  {cardBrand === 'mastercard' && (
                    <svg className="h-10 w-auto" viewBox="0 0 48 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="15" cy="15" r="15" fill="#EB001B"/>
                      <circle cx="33" cy="15" r="15" fill="#F79E1B"/>
                      <path fillRule="evenodd" clipRule="evenodd" d="M24 26C27.8 26 31.2 24.1 33.3 21C31.2 17.9 27.8 16 24 16C20.2 16 16.8 17.9 14.7 21C16.8 24.1 20.2 26 24 26Z" fill="#FF5F00"/>
                    </svg>
                  )}
                  {cardBrand === 'amex' && (
                    <div className="bg-red-50 border border-red-300 px-2 py-1 rounded text-xs text-red-700 font-semibold">
                      No aceptada
                    </div>
                  )}
                </div>
              </div>
              
              <div className="relative z-10">
                {bankName && (
                  <div className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wider">
                    {bankName}
                  </div>
                )}
                <div className="font-mono text-xl tracking-wider mb-4 text-gray-800 font-bold">
                  {cardNumber || '#### #### #### ####'}
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-xs text-gray-600 font-medium">TITULAR</div>
                    <div className="font-semibold uppercase text-gray-800">
                      {cardName || 'NOMBRE APELLIDO'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 font-medium">EXPIRA</div>
                    <div className="font-mono text-gray-800 font-semibold">{expiry || 'MM/AA'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Cara trasera */}
          <div
            className="absolute inset-0 backface-hidden rounded-2xl shadow-2xl overflow-hidden border border-gray-300"
            style={{
              background: 'linear-gradient(135deg, #e8e8e8 0%, #c0c0c0 50%, #d8d8d8 100%)',
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            <div className="h-full relative">
              {/* Efecto metálico overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-black/10 pointer-events-none" />
              
              <div className="w-full h-12 bg-gradient-to-r from-gray-700 via-gray-800 to-gray-700 mt-6" />
              <div className="px-6 mt-6 relative z-10">
                <div className="flex justify-end">
                  <div className="bg-white px-4 py-2 rounded-lg shadow-md border border-gray-200">
                    <div className="text-xs text-gray-600 mb-1 font-medium">CVV</div>
                    <div className="font-mono text-gray-800 font-bold tracking-widest text-lg">
                      {cvv || '***'}
                    </div>
                  </div>
                </div>
                {bankName && (
                  <div className="mt-6 text-right">
                    <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      {bankName}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Número de tarjeta
          </label>
          <input
            type="text"
            value={cardNumber}
            onChange={handleCardNumberChange}
            placeholder="1234 5678 9012 3456"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#010139] focus:border-transparent"
            maxLength={cardBrand === 'amex' ? 17 : 19}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre del titular
          </label>
          <input
            type="text"
            value={cardName}
            onChange={(e) => setCardName(e.target.value.toUpperCase())}
            placeholder="NOMBRE APELLIDO"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#010139] focus:border-transparent uppercase"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Banco Emisor
          </label>
          <input
            type="text"
            value={bankName}
            onChange={(e) => setBankName(e.target.value.toUpperCase())}
            placeholder="Ej: BANCO GENERAL"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#010139] focus:border-transparent uppercase"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de expiración
            </label>
            <input
              type="text"
              value={expiry}
              onChange={handleExpiryChange}
              placeholder="MM/AA"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#010139] focus:border-transparent"
              maxLength={5}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              CVV
            </label>
            <input
              type="text"
              value={cvv}
              onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
              onFocus={() => setIsFlipped(true)}
              onBlur={() => setIsFlipped(false)}
              placeholder="***"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#010139] focus:border-transparent"
              maxLength={cardBrand === 'amex' ? 4 : 3}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isProcessing}
          className="w-full bg-[#010139] text-white py-3 rounded-lg font-semibold hover:bg-[#010139]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Procesando...
            </span>
          ) : (
            'Emitir Póliza'
          )}
        </button>
      </form>

      {environment === 'development' && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs">
          <div className="font-semibold text-yellow-800 mb-1">🧪 Modo Desarrollo</div>
          <div className="text-yellow-700">
            Tarjeta de prueba: 4242 4242 4242 4242 | CVV: 123 | Fecha: 12/25
          </div>
        </div>
      )}
    </div>
    </>
  );
}
