/**
 * Página de Cotización - Vida (Wizard)
 */

import { Suspense } from 'react';
import VidaWizard from '@/components/cotizadores/VidaWizard';
import LoadingSkeleton from '@/components/cotizadores/LoadingSkeleton';

export const metadata = {
  title: 'Cotizar Seguro de Vida - Líderes en Seguros',
  description: 'Cotiza tu seguro de vida. Protección para tu familia con Líderes en Seguros.'
};

export default function CotizarVidaPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <VidaWizard />
    </Suspense>
  );
}
