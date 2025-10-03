'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaSearch } from 'react-icons/fa';
import Modal from '@/components/Modal';

export default function SearchModal() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/db?tab=clients&search=${searchQuery}`);
  };

  return (
    <Modal title="Buscar Cliente" onClose={() => router.push('/db?tab=clients')}>
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#010139]"
          placeholder="Buscar por nombre, cédula o email..."
        />
        <button type="submit" className="px-4 py-2 bg-[#010139] text-white rounded-md hover:bg-[#8aaa19] transition-colors">
          <FaSearch />
        </button>
      </form>
    </Modal>
  );
}
