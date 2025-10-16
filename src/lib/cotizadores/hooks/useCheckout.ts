/**
 * Hook para manejar redirección a checkout de Wix
 */

import { useCallback } from 'react';
import type { WixCheckoutParams } from '../types';

export function useCheckout() {
  const buildCheckoutUrl = useCallback((params: WixCheckoutParams): string => {
    const baseUrl = process.env.NEXT_PUBLIC_WIX_CHECKOUT_URL || 'https://example.wix.com/checkout';
    
    const searchParams = new URLSearchParams({
      quoteId: encodeURIComponent(params.quoteId),
      amount: params.amount.toString(),
      concept: encodeURIComponent(params.concept),
      returnUrl: encodeURIComponent(params.returnUrl)
    });

    return `${baseUrl}?${searchParams.toString()}`;
  }, []);

  const goToCheckout = useCallback((params: WixCheckoutParams) => {
    const checkoutUrl = buildCheckoutUrl(params);
    
    // Analytics log
    console.log('[Analytics] go_to_payment:', {
      quoteId: params.quoteId,
      amount: params.amount,
      concept: params.concept
    });
    
    // Redirect
    window.location.href = checkoutUrl;
  }, [buildCheckoutUrl]);

  const buildReturnUrl = useCallback((): string => {
    const origin = process.env.NEXT_PUBLIC_APP_ORIGIN || 
                   (typeof window !== 'undefined' ? window.location.origin : '');
    return `${origin}/cotizadores/confirmacion`;
  }, []);

  return {
    buildCheckoutUrl,
    goToCheckout,
    buildReturnUrl
  };
}
