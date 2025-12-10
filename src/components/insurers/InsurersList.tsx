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
      <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-3 sm:p-4 md:p-6 mb-6">
        <div className="flex flex-col gap-3 sm:gap-4">
          {/* Buscador compacto */}
          <div className="relative w-full">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition-colors"
            />
          </div>
          
          {/* Filtros y Botón - Responsive */}
          <div className="flex flex-wrap gap-2 sm:gap-3 items-center justify-center sm:justify-start">
            {/* Filtros compactos */}
            <button 
              onClick={() => setStatusFilter('all')} 
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg font-medium transition-all text-xs sm:text-sm ${
                statusFilter === 'all' 
                  ? 'bg-[#010139] text-white shadow-md' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Todas
            </button>
            <button 
              onClick={() => setStatusFilter('active')} 
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg font-medium transition-all text-xs sm:text-sm ${
                statusFilter === 'active' 
                  ? 'bg-[#8AAA19] text-white shadow-md' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Activas
            </button>
            <button 
              onClick={() => setStatusFilter('inactive')} 
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg font-medium transition-all text-xs sm:text-sm ${
                statusFilter === 'inactive' 
                  ? 'bg-red-500 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Inactivas
            </button>
            
            {/* Botón Nueva Aseguradora */}
            <Link 
              href="/insurers/new" 
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-[#010139] text-white rounded-lg hover:bg-[#8AAA19] transition-colors font-semibold shadow-lg whitespace-nowrap text-xs sm:text-sm"
            >
              <FaPlus className="text-white" /> <span className="text-white">Nueva</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Insurers Grid */}
      {filteredInsurers.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white rounded-2xl shadow-lg">
          <p className="text-gray-500 text-lg">No se encontraron aseguradoras.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredInsurers.map(insurer => (
            <div
              key={insurer.id}
              className={`relative bg-white rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 cursor-pointer aspect-square ${
                isPending ? 'opacity-50' : ''
              }`}
              onClick={() => handleFlip(insurer.id)}
              style={{ perspective: '1000px' }}
            >
              {/* Badge de estado - FIJO, fuera del flip */}
              <div className="absolute top-2 right-2 z-20 pointer-events-none">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shadow-sm ${
                  insurer.active 
                    ? 'bg-green-500 text-white' 
                    : 'bg-gray-400 text-white'
                }`}>
                  {insurer.active ? '✓' : '○'}
                </span>
              </div>

              <div 
                className={`relative w-full h-full transition-transform duration-600`}
                style={{ 
                  transformStyle: 'preserve-3d',
                  transform: flippedCards.includes(insurer.id) ? 'rotateY(180deg)' : 'rotateY(0deg)'
                }}
              >
                {/* Card Front - Logo protagonista */}
                <div 
                  className="absolute inset-0 flex flex-col p-2 sm:p-3 bg-gradient-to-br from-white to-gray-50 rounded-xl"
                  style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                >
                  {/* Logo - Centrado y grande */}
                  <div className="flex-1 flex items-center justify-center p-1 sm:p-2 mt-4">
                    <InsurerLogo 
                      logoUrl={insurer.logo_url}
                      insurerName={insurer.name}
                      size="2xl"
                    />
                  </div>
                  
                  {/* Nombre en la parte inferior - Solo visible cuando NO está volteado */}
                  <div className="text-center px-1 py-1.5 sm:py-2 border-t border-gray-200 bg-white/50 backdrop-blur-sm">
                    <p className="text-[10px] sm:text-xs font-bold text-[#010139] truncate px-1" title={insurer.name}>
                      {insurer.name}
                    </p>
                  </div>
                  
                  {/* Botones de acción - Responsive y contenidos */}
                  <div className="flex justify-center gap-1 sm:gap-1.5 mt-1 px-1">
                    <Link 
                      href={`/insurers/${insurer.id}/edit`} 
                      className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center rounded-md sm:rounded-lg bg-[#010139] text-white hover:bg-[#8AAA19] transition-all flex-shrink-0" 
                      title="Editar" 
                      onClick={(e) => e.stopPropagation()}
                    >
                      <FaEdit size={10} className="sm:hidden text-white" />
                      <FaEdit size={12} className="hidden sm:block text-white" />
                    </Link>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleClone(insurer.id); }} 
                      className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center rounded-md sm:rounded-lg bg-[#8AAA19] text-white hover:bg-[#010139] transition-all flex-shrink-0" 
                      title="Clonar"
                    >
                      <FaClone size={10} className="sm:hidden text-white" />
                      <FaClone size={12} className="hidden sm:block text-white" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleToggle(insurer.id); }} 
                      className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center rounded-md sm:rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-500 hover:text-white transition-all flex-shrink-0" 
                      title={insurer.active ? 'Desactivar' : 'Activar'}
                    >
                      {insurer.active ? <FaToggleOn size={12} className="sm:hidden" /> : <FaToggleOff size={12} className="sm:hidden" />}
                      {insurer.active ? <FaToggleOn size={14} className="hidden sm:block" /> : <FaToggleOff size={14} className="hidden sm:block" />}
                    </button>
                  </div>
                </div>
                {/* Card Back */}
                <div 
                  className="absolute inset-0 flex flex-col p-2 sm:p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl"
                  style={{ 
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <div className="flex justify-between items-start mb-2 flex-shrink-0 mt-4">
                    <h4 className="text-[10px] sm:text-xs font-bold text-[#010139]">Contacto</h4>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleFlip(insurer.id); }} 
                      className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-md sm:rounded-lg bg-white text-gray-600 hover:bg-[#010139] hover:text-white transition-all shadow-sm flex-shrink-0" 
                      title="Volver"
                    >
                      <FaUndo size={9} className="sm:hidden" />
                      <FaUndo size={10} className="hidden sm:block" />
                    </button>
                  </div>
                  {(() => {
                    const primaryContact = insurer.contacts.find(c => c.is_primary);
                    return primaryContact ? (
                      <div className="text-gray-700 text-[9px] sm:text-[10px] space-y-1 flex-1 overflow-y-auto mb-2">
                        <p className="font-bold text-[#010139] text-[10px] sm:text-xs mb-1 truncate">{primaryContact.name}</p>
                        {primaryContact.position && <p className="text-gray-600 truncate">📋 {primaryContact.position}</p>}
                        {primaryContact.phone && <p className="text-gray-600 truncate">📞 {primaryContact.phone}</p>}
                        {primaryContact.email && <p className="text-gray-600 truncate break-all">✉️ {primaryContact.email}</p>}
                      </div>
                    ) : (
                      <div className="text-gray-500 text-[9px] sm:text-[10px] flex-1 flex items-center justify-center mb-2">
                        <p className="text-center">Sin contacto principal</p>
                      </div>
                    );
                  })()}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleOpenModal(insurer); }}
                    className="w-full py-1.5 px-2 bg-[#8AAA19] text-white rounded-md sm:rounded-lg hover:bg-[#6d8814] transition-all flex items-center justify-center gap-1 font-semibold text-[9px] sm:text-[10px] flex-shrink-0"
                  >
                    <FaEye size={9} className="text-white sm:hidden" />
                    <FaEye size={10} className="text-white hidden sm:block" /> Ver ({insurer.contacts.length})
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
