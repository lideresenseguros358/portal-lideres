import { Metadata } from 'next';
import DelinquencyMainClient from '@/components/delinquency/DelinquencyMainClient';

export const metadata: Metadata = {
  title: 'Morosidad | Portal Líderes',
  description: 'Gestión de morosidad y deudas por aseguradora',
};

export default function DelinquencyPage() {
  return <DelinquencyMainClient />;
}
