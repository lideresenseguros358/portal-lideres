/**
 * Página de Cotización - Contenido/Hogar (Wizard)
 */

import { Suspense } from 'react';
import ContenidoWizard from '@/components/cotizadores/ContenidoWizard';
import LoadingSkeleton from '@/components/cotizadores/LoadingSkeleton';

export const metadata = {
  title: 'Cotizar Seguro de Contenido - Líderes en Seguros',
  description: 'Protege tus muebles, enseres y pertenencias contra robos y daños.'
};

export default function CotizarContenidoPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <ContenidoWizard />
    </Suspense>
  );
}
