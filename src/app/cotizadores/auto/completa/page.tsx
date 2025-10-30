/**
 * Página de Cotización - Auto Cobertura Completa
 */

import { Suspense } from 'react';
import FormAutoCoberturaCompleta from '@/components/cotizadores/FormAutoCoberturaCompleta';
import LoadingSkeleton from '@/components/cotizadores/LoadingSkeleton';

export const metadata = {
  title: 'Cotizar Seguro de Auto - Cobertura Completa',
  description: 'Cotiza tu seguro de auto con cobertura completa. Protección total para tu vehículo con sliders interactivos.'
};

export default function CotizarAutoCompletaPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <FormAutoCoberturaCompleta />
    </Suspense>
  );
}
