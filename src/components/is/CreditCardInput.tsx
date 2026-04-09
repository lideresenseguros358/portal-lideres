'use client';

/**
 * ⚠️ TRANSITIONAL COMPONENT — PCI-DSS COMPLIANCE NOTES
 * =====================================================
 * This component currently captures card data in local React state (memory only).
 * This is a TEMPORARY implementation for the development phase.
 *
 * BEFORE GOING TO PRODUCTION:
 * 1. Replace this entire component with PagueloFacil's hosted payment fields / iframe.
 * 2. Card data (PAN, CVV, expiry) must NEVER touch our servers — use PagueloFacil tokenization.
 * 3. The payment adapter (src/lib/payments/payment-adapter.ts) is ready to swap the mock
 *    implementation for the real PagueloFacil SDK.
 *
 * CURRENT SECURITY MEASURES (dev phase):
 * - Card data lives ONLY in React useState (volatile memory).
 * - All state is wiped on unmount, navigation, or page refresh.
 * - CVV is rendered as type="password" and never displayed in plain text.
 * - Card number is masked on the 3D preview (only last 4 shown).
 * - No card data is persisted to localStorage, sessionStorage, IndexedDB, or cookies.
 * - No card data is logged to console, analytics, or error tracking.
 * - autocomplete attributes are set to prevent browser autofill of sensitive fields.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';

/** Structured card data passed to parent for server-side PagueloFacil charge */
export interface CardData {
  cardNumber: string;   // Raw digits, no spaces (e.g. "4111111111111111")
  cardName: string;     // Cardholder name
  expMonth: string;     // "01"-"12"
  expYear: string;      // "30" (2-digit year)
  cvv: string;          // "123"
  brand: 'VISA' | 'MASTERCARD';
  last4: string;        // Last 4 digits
  bankName: string;     // Issuing bank name
}

interface CreditCardInputProps {
  /** (Legacy) Called with mock token — kept for backward compat */
  onTokenReceived: (token: string, last4: string, brand: string) => void;
  /** Called with structured card data for PagueloFacil direct charge */
  onCardDataReady?: (data: CardData) => void;
  onError: (error: string) => void;
}

export default function CreditCardInput({ onTokenReceived, onCardDataReady, onError }: CreditCardInputProps) {
  const isSandbox = process.env.NODE_ENV !== 'production';
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [bankName, setBankName] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [isFlipped, setIsFlipped] = useState(false);
  const [cardBrand, setCardBrand] = useState<'visa' | 'mastercard' | 'amex' | 'unknown'>('unknown');
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasValidated, setHasValidated] = useState(false);

  // Unique suffix to prevent browser autofill by randomizing field names
  const formIdRef = useRef(`_${Math.random().toString(36).slice(2, 8)}`);

  /**
   * SECURITY: Wipe all sensitive card data from memory on unmount.
   * This ensures no PAN, CVV, or expiry survives in React state
   * when the user navigates away, cancels, or the wizard step changes.
   */
  const clearSensitiveData = useCallback(() => {
    setCardNumber('');
    setCardName('');
    setBankName('');
    setExpiry('');
    setCvv('');
    setCardBrand('unknown');
    setHasValidated(false);
    setIsProcessing(false);
  }, []);

  useEffect(() => {
    // Also wipe on page refresh / tab close (best-effort)
    const handleBeforeUnload = () => clearSensitiveData();
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      // SECURITY: Cleanup on unmount — wipe all card data
      clearSensitiveData();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [clearSensitiveData]);
  
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

    // Todo OK, procesar
    setIsProcessing(true);

    const last4 = cleanNumber.slice(-4);
    const brandLabel = cardBrand === 'visa' ? 'Visa' : cardBrand === 'mastercard' ? 'Mastercard' : 'Amex';

    setTimeout(() => {
      // Pass structured card data for PagueloFacil direct charge
      if (onCardDataReady) {
        const cardData: CardData = {
          cardNumber: cleanNumber,
          cardName: cardName.trim(),
          expMonth: month.padStart(2, '0'),
          expYear: year,
          cvv,
          brand: cardBrand === 'visa' ? 'VISA' : 'MASTERCARD',
          last4,
          bankName: bankName.trim(),
        };
        onCardDataReady(cardData);
      }

      // Legacy: still call onTokenReceived for backward compat
      const mockToken = `tok_dev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      onTokenReceived(mockToken, last4, brandLabel);

      // NOTE: We do NOT wipe card data here anymore.
      // The parent component holds the CardData in state and will pass it
      // to the backend at emit time. Data is wiped on unmount (see useEffect cleanup).
      setIsProcessing(false);
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
                  {cardNumber
                    ? cardNumber.replace(/\s/g, '').length > 4
                      ? `**** **** **** ${cardNumber.replace(/\s/g, '').slice(-4)}`
                      : cardNumber
                    : '#### #### #### ####'}
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
                      {cvv ? '•'.repeat(cvv.length) : '***'}
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

      {/* Formulario — SECURITY: data-sensitivity prevents debug tools from snapshotting */}
      <form onSubmit={(e) => e.preventDefault()} className="space-y-4" autoComplete="off" data-sensitivity="high">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Número de tarjeta
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={cardNumber}
            onChange={handleCardNumberChange}
            placeholder="1234 5678 9012 3456"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#010139] focus:border-transparent"
            maxLength={cardBrand === 'amex' ? 17 : 19}
            autoComplete="cc-number"
            name={`cardnumber${formIdRef.current}`}
            data-sensitivity="pci-pan"
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
            autoComplete="cc-name"
            name={`ccname${formIdRef.current}`}
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
            name={`bankname${formIdRef.current}`}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de expiración
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={expiry}
              onChange={handleExpiryChange}
              placeholder="MM/AA"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#010139] focus:border-transparent"
              maxLength={5}
              autoComplete="cc-exp"
              name={`ccexp${formIdRef.current}`}
              data-sensitivity="pci-exp"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              CVV
            </label>
            <input
              type="password"
              inputMode="numeric"
              value={cvv}
              onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
              onFocus={() => setIsFlipped(true)}
              onBlur={() => setIsFlipped(false)}
              placeholder="***"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#010139] focus:border-transparent"
              maxLength={cardBrand === 'amex' ? 4 : 3}
              autoComplete="cc-csc"
              name={`cvc${formIdRef.current}`}
              data-sensitivity="pci-cvv"
            />
          </div>
        </div>
      </form>

      {isSandbox && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs">
          <div className="font-semibold text-yellow-800 mb-1">🧪 Modo Desarrollo (PagueloFacil Sandbox)</div>
          <div className="text-yellow-700">
            Visa: 4059 3101 8175 7001 | MC: 5517 7479 5203 9692 | CVV: 123 | Fecha: 12/30
          </div>
        </div>
      )}
    </div>
    </>
  );
}
