/**
 * Página de Cotización - Incendio (Wizard)
 */

import { Suspense } from 'react';
import IncendioWizard from '@/components/cotizadores/IncendioWizard';
import LoadingSkeleton from '@/components/cotizadores/LoadingSkeleton';

export const metadata = {
  title: 'Cotizar Seguro de Incendio - Líderes en Seguros',
  description: 'Protege la estructura de tu propiedad contra incendios.'
};

export default function CotizarIncendioPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <IncendioWizard />
    </Suspense>
  );
}
