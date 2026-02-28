import { Suspense } from 'react';
import AdmCotChats from '@/components/adm-cot/chats/AdmCotChats';

export default function ChatsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20 text-gray-400 text-sm">Cargando chats...</div>}>
      <AdmCotChats />
    </Suspense>
  );
}
