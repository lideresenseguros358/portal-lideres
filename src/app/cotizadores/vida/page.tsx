/**
 * Página de Cotización - Vida
 */

import { Suspense } from 'react';
import FormVida from '@/components/cotizadores/FormVida';
import LoadingSkeleton from '@/components/cotizadores/LoadingSkeleton';

export const metadata = {
  title: 'Cotizar Seguro de Vida - Líderes en Seguros',
  description: 'Cotiza tu seguro de vida con ASSA. Protección para tu familia.'
};

export default function CotizarVidaPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <FormVida />
    </Suspense>
  );
}
