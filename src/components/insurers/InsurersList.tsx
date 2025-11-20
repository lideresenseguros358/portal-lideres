'use client';

import { useState, useTransition, useRef } from 'react';
import Link from 'next/link';
import { FaEdit, FaPlus, FaSearch, FaToggleOn, FaToggleOff, FaClone, FaUndo, FaEye } from 'react-icons/fa';
import { actionToggleInsurerActive, actionCloneInsurer } from '@/app/(app)/insurers/actions';
import ContactsModal from './ContactsModal';
import InsurerLogo from '@/components/shared/InsurerLogo';

interface Contact {
  id: string;
  name: string;
  position: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  is_primary?: boolean | null;
}

interface Insurer {
  id: string;
  name: string;
  active: boolean | null;
  logo_url?: string | null;
  contacts: Contact[];
}

interface InsurersListProps {
  initialInsurers: Insurer[];
}

export default function InsurersList({ initialInsurers }: InsurersListProps) {
  const [insurers, setInsurers] = useState(initialInsurers);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [flippedCards, setFlippedCards] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [modalInsurer, setModalInsurer] = useState<{ id: string; name: string; contacts: Contact[] } | null>(null);

  const handleToggle = (insurerId: string) => {
    startTransition(async () => {
      const result = await actionToggleInsurerActive(insurerId);
      if (result.ok && result.data) {
        setInsurers(currentInsurers =>
          currentInsurers.map(ins => 
            ins.id === insurerId 
              ? { 
                  id: result.data.id, 
                  name: result.data.name, 
                  active: result.data.active,
                  logo_url: (result.data as any).logo_url || ins.logo_url,
                  contacts: ins.contacts 
                }
              : ins
          )
        );
      } else {
        alert(`Error: ${result.error}`);
      }
    });
  };

  const handleFlip = (insurerId: string) => {
    setFlippedCards(currentFlipped =>
      currentFlipped.includes(insurerId)
        ? currentFlipped.filter(id => id !== insurerId)
        : [...currentFlipped, insurerId]
    );
  };

  const handleClone = (insurerId: string) => {
    if (!confirm('¿Está seguro de que desea clonar esta aseguradora? Se creará una copia con sus mapeos y configuraciones.')) {
      return;
    }
    startTransition(async () => {
      const result = await actionCloneInsurer(insurerId);
      if (result.ok && result.data) {
        // For simplicity, we'll just add it to the top of the list.
        // A full refresh might be better in a real app.
        const newInsurer = {
          id: result.data.id,
          name: result.data.name,
          active: result.data.active,
          contacts: []
        };
        setInsurers(currentInsurers => [newInsurer, ...currentInsurers]);
        alert(`Aseguradora '${newInsurer.name}' creada.`);
      } else {
        alert(`Error al clonar: ${result.error}`);
      }
    });
  };

  const handleOpenModal = (insurer: Insurer) => {
    setModalInsurer({
      id: insurer.id,
      name: insurer.name,
      contacts: insurer.contacts
    });
  };

  const handleCloseModal = () => {
    setModalInsurer(null);
  };

  const handleModalUpdate = () => {
    // Refresh the page to get updated contacts
    window.location.reload();
  };

  const filteredInsurers = insurers.filter(insurer => {
    const matchesSearch = insurer.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = 
      statusFilter === 'all' || 
      (statusFilter === 'active' && insurer.active) || 
      (statusFilter === 'inactive' && !insurer.active);
    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      {/* Actions Bar - Con Card */}
      <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-4 sm:p-6 mb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Buscador y Filtros */}
          <div className="flex flex-col gap-3 flex-1">
            {/* Buscador */}
            <div className="relative w-full">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar aseguradoras..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition-colors"
              />
            </div>
            
            {/* Pestañas de filtro - Distribuidas en mobile */}
            <div className="grid grid-cols-3 gap-2 w-full">
              <button 
                onClick={() => setStatusFilter('all')} 
                className={`px-3 py-2 rounded-lg font-medium transition-all text-sm sm:text-base ${
                  statusFilter === 'all' 
                    ? 'bg-[#010139] text-white shadow-md' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Todas
              </button>
              <button 
                onClick={() => setStatusFilter('active')} 
                className={`px-3 py-2 rounded-lg font-medium transition-all text-sm sm:text-base ${
                  statusFilter === 'active' 
                    ? 'bg-[#8AAA19] text-white shadow-md' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Activas
              </button>
              <button 
                onClick={() => setStatusFilter('inactive')} 
                className={`px-3 py-2 rounded-lg font-medium transition-all text-sm sm:text-base ${
                  statusFilter === 'inactive' 
                    ? 'bg-red-500 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Inactivas
              </button>
            </div>
          </div>
          
          {/* Botón Nueva Aseguradora */}
          <Link 
            href="/insurers/new" 
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-[#010139] text-white rounded-lg hover:bg-[#8AAA19] transition-colors font-semibold shadow-lg [&>svg]:text-white"
          >
            <FaPlus className="text-white" /> <span className="text-white">Nueva Aseguradora</span>
          </Link>
        </div>
      </div>

      {/* Insurers Grid */}
      {filteredInsurers.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white rounded-2xl shadow-lg">
          <p className="text-gray-500 text-lg">No se encontraron aseguradoras.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredInsurers.map(insurer => (
            <div
              key={insurer.id}
              className={`bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer min-h-[220px] ${
                isPending ? 'opacity-50' : ''
              }`}
              onClick={() => handleFlip(insurer.id)}
              style={{ perspective: '1000px' }}
            >
              <div 
                className={`relative w-full h-full transition-transform duration-600`}
                style={{ 
                  transformStyle: 'preserve-3d',
                  transform: flippedCards.includes(insurer.id) ? 'rotateY(180deg)' : 'rotateY(0deg)'
                }}
              >
                {/* Card Front - Logo protagonista */}
                <div 
                  className="absolute inset-0 flex flex-col p-4 bg-white rounded-2xl"
                  style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                >
                  {/* Badge de estado en esquina */}
                  <div className="absolute top-3 right-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium shadow-sm ${
                      insurer.active 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {insurer.active ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                  
                  {/* Logo protagonista - Centrado y grande */}
                  <div className="flex-1 flex items-center justify-center py-4">
                    <InsurerLogo 
                      logoUrl={insurer.logo_url}
                      insurerName={insurer.name}
                      size="2xl"
                    />
                  </div>
                  
                  {/* Botones de acción */}
                  <div className="flex justify-end gap-2 mt-2">
                    <Link 
                      href={`/insurers/${insurer.id}/edit`} 
                      className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#f6f6ff] text-gray-600 hover:bg-[#010139] hover:text-white transition-all" 
                      title="Editar" 
                      onClick={(e) => e.stopPropagation()}
                    >
                      <FaEdit />
                    </Link>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleClone(insurer.id); }} 
                      className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#f6f6ff] text-gray-600 hover:bg-[#8AAA19] hover:text-white transition-all" 
                      title="Clonar"
                    >
                      <FaClone />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleToggle(insurer.id); }} 
                      className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#f6f6ff] text-gray-600 hover:bg-orange-500 hover:text-white transition-all" 
                      title={insurer.active ? 'Desactivar' : 'Activar'}
                    >
                      {insurer.active ? <FaToggleOn /> : <FaToggleOff />}
                    </button>
                  </div>
                </div>
                {/* Card Back */}
                <div 
                  className="absolute inset-0 flex flex-col p-6 bg-white rounded-2xl"
                  style={{ 
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)'
                  }}
                >
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-base font-semibold text-[#010139]">Contacto Principal</h4>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleFlip(insurer.id); }} 
                      className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#f6f6ff] text-gray-600 hover:bg-[#010139] hover:text-white transition-all" 
                      title="Volver"
                    >
                      <FaUndo />
                    </button>
                  </div>
                  {(() => {
                    const primaryContact = insurer.contacts.find(c => c.is_primary);
                    return primaryContact ? (
                      <div className="text-gray-700 text-sm space-y-2 flex-1">
                        <p className="font-bold text-[#010139] text-base">{primaryContact.name}</p>
                        {primaryContact.position && <p className="text-gray-600">📋 {primaryContact.position}</p>}
                        {primaryContact.phone && <p className="text-gray-600">📞 {primaryContact.phone}</p>}
                        {primaryContact.email && <p className="text-gray-600">✉️ {primaryContact.email}</p>}
                      </div>
                    ) : (
                      <div className="text-gray-500 text-sm flex-1 flex items-center justify-center">
                        <p>No hay contacto principal</p>
                      </div>
                    );
                  })()}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleOpenModal(insurer); }}
                    className="mt-4 w-full py-2 px-4 bg-[#8AAA19] text-white rounded-lg hover:bg-[#6d8814] transition-all flex items-center justify-center gap-2 font-semibold"
                  >
                    <FaEye /> Ver + ({insurer.contacts.length})
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Contacts Modal */}
      {modalInsurer && (
        <ContactsModal
          isOpen={true}
          onClose={handleCloseModal}
          insurerId={modalInsurer.id}
          insurerName={modalInsurer.name}
          initialContacts={modalInsurer.contacts}
          onUpdate={handleModalUpdate}
        />
      )}
    </div>
  );
}
