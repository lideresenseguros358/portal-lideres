/**
 * Página de Cotización - Incendio
 */

import { Suspense } from 'react';
import FormIncendio from '@/components/cotizadores/FormIncendio';
import LoadingSkeleton from '@/components/cotizadores/LoadingSkeleton';

export const metadata = {
  title: 'Cotizar Seguro de Incendio - Líderes en Seguros',
  description: 'Protege la estructura de tu propiedad contra incendios.'
};

export default function CotizarIncendioPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <FormIncendio />
    </Suspense>
  );
}
