/**
 * Página de Cotización - Auto
 */

import { Suspense } from 'react';
import FormAuto from '@/components/cotizadores/FormAuto';
import LoadingSkeleton from '@/components/cotizadores/LoadingSkeleton';

export const metadata = {
  title: 'Cotizar Seguro de Auto - Líderes en Seguros',
  description: 'Cotiza tu seguro de auto en minutos. Compara opciones de múltiples aseguradoras.'
};

export default function CotizarAutoPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <FormAuto />
    </Suspense>
  );
}
