import { Metadata } from 'next';
import ChecksMainClient from '@/components/checks/ChecksMainClient';

export const metadata: Metadata = {
  title: 'Cheques | Portal Líderes',
  description: 'Gestión de cheques y referencias bancarias',
};

export default function ChecksPage() {
  return <ChecksMainClient />;
}
