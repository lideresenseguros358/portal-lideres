/**
 * Página de Cotización - Contenido
 */

import { Suspense } from 'react';
import FormContenido from '@/components/cotizadores/FormContenido';
import LoadingSkeleton from '@/components/cotizadores/LoadingSkeleton';

export const metadata = {
  title: 'Cotizar Seguro de Contenido - Líderes en Seguros',
  description: 'Protege tus muebles, enseres y pertenencias contra robos y daños.'
};

export default function CotizarContenidoPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <FormContenido />
    </Suspense>
  );
}
