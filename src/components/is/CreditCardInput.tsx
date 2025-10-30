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
            className="absolute inset-0 backface-hidden rounded-2xl shadow-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              backfaceVisibility: 'hidden',
            }}
          >
            <div className="p-6 h-full flex flex-col justify-between text-white">
              <div className="flex justify-between items-start">
                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm" />
                <div className="text-right">
                  {cardBrand === 'visa' && <div className="text-2xl font-bold">VISA</div>}
                  {cardBrand === 'mastercard' && <div className="text-2xl font-bold">Mastercard</div>}
                  {cardBrand === 'amex' && <div className="text-2xl font-bold">AMEX</div>}
                </div>
              </div>
              
              <div>
                <div className="font-mono text-xl tracking-wider mb-4">
                  {cardNumber || '#### #### #### ####'}
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-xs opacity-70">TITULAR</div>
                    <div className="font-semibold uppercase">
                      {cardName || 'NOMBRE APELLIDO'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs opacity-70">EXPIRA</div>
                    <div className="font-mono">{expiry || 'MM/AA'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Cara trasera */}
          <div
            className="absolute inset-0 backface-hidden rounded-2xl shadow-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            <div className="h-full">
              <div className="w-full h-12 bg-black/50 mt-6" />
              <div className="px-6 mt-6">
                <div className="flex justify-end">
                  <div className="bg-white/90 px-4 py-2 rounded">
                    <div className="text-xs text-gray-600 mb-1">CVV</div>
                    <div className="font-mono text-black font-bold tracking-widest">
                      {cvv || '***'}
                    </div>
                  </div>
                </div>
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
  );
}
