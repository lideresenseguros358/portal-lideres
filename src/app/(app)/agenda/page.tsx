import { Metadata } from 'next';
import AgendaMainClient from '@/components/agenda/AgendaMainClient';

export const metadata: Metadata = {
  title: 'Agenda | Portal Líderes',
  description: 'Calendario corporativo de eventos y actividades',
};

export default function AgendaPage() {
  return <AgendaMainClient />;
}
