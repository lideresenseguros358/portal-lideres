'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';

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
  const [hasValidated, setHasValidated] = useState(false);
  
  // Validar automáticamente cuando todos los campos estén completos
  useEffect(() => {
    const cleanNumber = cardNumber.replace(/\s/g, '');
    const allFieldsFilled = 
      cleanNumber.length >= 15 &&
      cardName.trim().length > 0 &&
      bankName.trim().length > 0 &&
      expiry.length === 5 &&
      cvv.length >= 3;
    
    if (allFieldsFilled && !hasValidated && !isProcessing) {
      const isValid = validateCard();
      if (isValid) {
        setHasValidated(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardNumber, cardName, bankName, expiry, cvv, hasValidated, isProcessing]);

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

  // Validar automáticamente cuando se completen todos los campos
  const validateCard = () => {
    // Validar marca de tarjeta primero
    if (!validateCardBrand()) {
      return false;
    }
    
    // Validaciones
    const cleanNumber = cardNumber.replace(/\s/g, '');
    
    if (!cardName.trim()) {
      return false;
    }
    
    if (!bankName.trim()) {
      return false;
    }
    
    if (cleanNumber.length < 15) {
      return false;
    }
    
    if (!luhnCheck(cleanNumber)) {
      onError('Número de tarjeta inválido');
      return false;
    }
    
    if (!expiry || expiry.length < 5) {
      return false;
    }
    
    const [month, year] = expiry.split('/');
    if (!month || !year) {
      onError('Fecha de expiración inválida');
      return false;
    }
    
    const expMonth = parseInt(month);
    const expYear = parseInt('20' + year);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    if (expMonth < 1 || expMonth > 12) {
      onError('Mes de expiración inválido');
      return false;
    }
    
    if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
      onError('Tarjeta expirada');
      return false;
    }
    
    if (!cvv || cvv.length < 3) {
      return false;
    }

    // Todo OK, procesar token
    setIsProcessing(true);

    // MOCK: Simular tokenización (en producción esto llamaría a IS API)
    setTimeout(() => {
      const mockToken = `tok_${Math.random().toString(36).substring(7)}`;
      const last4 = cleanNumber.slice(-4);
      const brand = cardBrand === 'visa' ? 'Visa' : cardBrand === 'mastercard' ? 'Mastercard' : 'Amex';
      
      setIsProcessing(false);
      onTokenReceived(mockToken, last4, brand);
    }, 1500);
    
    return true;
  };

  return (
    <>
      <style jsx>{`
        @keyframes shimmer {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
      
    <div className="w-full max-w-[400px] mx-auto">
      {/* Tarjeta 3D */}
      <div className="perspective-1000 mb-8">
        <motion.div
          className="relative w-full aspect-[1.586/1] cursor-pointer"
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
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(0deg)',
            }}
          >
            <div className="p-6 h-full flex flex-col justify-between relative">
              {/* Efecto metálico overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-black/10 pointer-events-none" />
              
              <div className="flex justify-between items-start relative z-10">
                {/* Favicon como chip - transparente */}
                <div className="w-12 h-12 rounded-lg flex items-center justify-center">
                  <Image src="/favicon.ico" alt="Logo" width={40} height={40} className="object-contain" />
                </div>
                
                <div className="text-right flex items-center justify-end">
                  {cardBrand === 'visa' && (
                    <Image src="/visa_logo.svg" alt="Visa" width={50} height={24} className="object-contain" />
                  )}
                  {cardBrand === 'mastercard' && (
                    <Image src="/mastercard_logo.svg" alt="Mastercard" width={45} height={32} className="object-contain" />
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
              WebkitBackfaceVisibility: 'hidden',
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
      <form onSubmit={(e) => e.preventDefault()} className="space-y-4" autoComplete="off">
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
            autoComplete="off"
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
            autoComplete="off"
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
            autoComplete="off"
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
              autoComplete="off"
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
              autoComplete="off"
            />
          </div>
        </div>
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
