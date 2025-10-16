'use client';

import { useState, useEffect } from 'react';
import { FaTimes, FaPlus, FaEdit, FaTrash, FaSave, FaStar, FaRegStar } from 'react-icons/fa';
import { toast } from 'sonner';
import { 
  actionGetInsurerContacts, 
  actionCreateInsurerContact, 
  actionUpdateInsurerContact,
  actionDeleteInsurerContact,
  actionSetPrimaryContact
} from '@/app/(app)/insurers/actions';
import { createUppercaseHandler, uppercaseInputClass } from '@/lib/utils/uppercase';

interface Contact {
  id: string;
  name: string;
  position: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  is_primary?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  insurer_id?: string;
}

interface ContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  insurerId: string;
  insurerName: string;
  initialContacts: Contact[];
  onUpdate: () => void;
}

export default function ContactsModal({ 
  isOpen, 
  onClose, 
  insurerId, 
  insurerName,
  initialContacts,
  onUpdate
}: ContactsModalProps) {
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  
  const [newContact, setNewContact] = useState({
    name: '',
    position: '',
    phone: '',
    email: '',
    notes: ''
  });

  const [editContact, setEditContact] = useState<Contact | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadContacts();
    }
  }, [isOpen, insurerId]);

  const loadContacts = async () => {
    try {
      const result = await actionGetInsurerContacts(insurerId);
      if (result.ok) {
        setContacts(result.data);
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
    }
  };

  const handleAdd = async () => {
    if (!newContact.name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    setLoading(true);
    try {
      const result = await actionCreateInsurerContact({
        insurer_id: insurerId,
        name: newContact.name.trim(),
        position: newContact.position.trim() || undefined,
        phone: newContact.phone.trim() || undefined,
        email: newContact.email.trim() || undefined,
        notes: newContact.notes.trim() || undefined
      });

      if (result.ok) {
        toast.success('✅ Contacto agregado');
        setNewContact({ name: '', position: '', phone: '', email: '', notes: '' });
        setShowAddForm(false);
        await loadContacts();
        onUpdate();
      } else {
        toast.error(result.error || 'Error al agregar contacto');
      }
    } catch (error: any) {
      toast.error(error.message || 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (contact: Contact) => {
    setEditingId(contact.id);
    setEditContact({ ...contact });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContact(null);
  };

  const handleSaveEdit = async () => {
    if (!editContact || !editContact.name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    setLoading(true);
    try {
      const result = await actionUpdateInsurerContact(editContact.id, {
        name: editContact.name.trim(),
        position: editContact.position?.trim() || undefined,
        phone: editContact.phone?.trim() || undefined,
        email: editContact.email?.trim() || undefined,
        notes: editContact.notes?.trim() || undefined
      });

      if (result.ok) {
        toast.success('✅ Contacto actualizado');
        setEditingId(null);
        setEditContact(null);
        await loadContacts();
        onUpdate();
      } else {
        toast.error(result.error || 'Error al actualizar contacto');
      }
    } catch (error: any) {
      toast.error(error.message || 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (contactId: string, contactName: string) => {
    if (!confirm(`¿Eliminar el contacto "${contactName}"?`)) return;

    setLoading(true);
    try {
      const result = await actionDeleteInsurerContact(contactId, insurerId);

      if (result.ok) {
        toast.success('✅ Contacto eliminado');
        await loadContacts();
        onUpdate();
      } else {
        toast.error(result.error || 'Error al eliminar contacto');
      }
    } catch (error: any) {
      toast.error(error.message || 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  const handleSetPrimary = async (contactId: string) => {
    setLoading(true);
    try {
      const result = await actionSetPrimaryContact(contactId, insurerId);

      if (result.ok) {
        toast.success('✅ Contacto principal establecido');
        await loadContacts();
        onUpdate();
      } else {
        toast.error(result.error || 'Error al establecer contacto principal');
      }
    } catch (error: any) {
      toast.error(error.message || 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-[#010139]">Contactos</h2>
            <p className="text-gray-600 text-sm mt-1">{insurerName}</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-red-500 hover:text-white transition-all"
          >
            <FaTimes />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Add Contact Button */}
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full mb-6 py-3 px-4 bg-[#8AAA19] text-white rounded-lg hover:bg-[#6d8814] transition-all flex items-center justify-center gap-2 font-semibold"
              disabled={loading}
            >
              <FaPlus /> Agregar Contacto
            </button>
          )}

          {/* Add Contact Form */}
          {showAddForm && (
            <div className="mb-6 p-4 bg-gray-50 rounded-xl border-2 border-[#8AAA19]">
              <h3 className="text-lg font-bold text-[#010139] mb-4">Nuevo Contacto</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="NOMBRE COMPLETO"
                    value={newContact.name}
                    onChange={createUppercaseHandler((e) => setNewContact({...newContact, name: e.target.value}))}
                    className={`w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none ${uppercaseInputClass}`}
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Cargo</label>
                  <input
                    type="text"
                    placeholder="CARGO O POSICIÓN"
                    value={newContact.position}
                    onChange={createUppercaseHandler((e) => setNewContact({...newContact, position: e.target.value}))}
                    className={`w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none ${uppercaseInputClass}`}
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Teléfono</label>
                  <input
                    type="text"
                    placeholder="6000-0000"
                    value={newContact.phone}
                    onChange={(e) => setNewContact({...newContact, phone: e.target.value})}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                    disabled={loading}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="email@ejemplo.com"
                    value={newContact.email}
                    onChange={(e) => setNewContact({...newContact, email: e.target.value.toLowerCase()})}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                    disabled={loading}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Notas</label>
                  <textarea
                    placeholder="NOTAS ADICIONALES"
                    value={newContact.notes}
                    onChange={createUppercaseHandler((e) => setNewContact({...newContact, notes: e.target.value}))}
                    className={`w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none ${uppercaseInputClass}`}
                    rows={2}
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  className="flex-1 py-2 px-4 bg-[#8AAA19] text-white rounded-lg hover:bg-[#6d8814] transition-all flex items-center justify-center gap-2 font-semibold"
                  disabled={loading || !newContact.name.trim()}
                >
                  <FaSave /> Guardar
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setNewContact({ name: '', position: '', phone: '', email: '', notes: '' });
                  }}
                  className="py-2 px-4 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all"
                  disabled={loading}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Contacts List */}
          <div className="space-y-3">
            {contacts.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                <p className="text-gray-500">No hay contactos registrados</p>
                <p className="text-gray-400 text-sm mt-1">Agrega el primer contacto usando el botón de arriba</p>
              </div>
            ) : (
              contacts.map(contact => (
                <div
                  key={contact.id}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    contact.is_primary 
                      ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-[#8AAA19]' 
                      : 'bg-white border-gray-200 hover:border-[#8AAA19]'
                  }`}
                >
                  {editingId === contact.id && editContact ? (
                    // Edit Mode
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={editContact.name}
                          onChange={createUppercaseHandler((e) => setEditContact({...editContact, name: e.target.value}))}
                          className={`px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none ${uppercaseInputClass}`}
                          placeholder="NOMBRE"
                        />
                        <input
                          type="text"
                          value={editContact.position || ''}
                          onChange={createUppercaseHandler((e) => setEditContact({...editContact, position: e.target.value}))}
                          className={`px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none ${uppercaseInputClass}`}
                          placeholder="CARGO"
                        />
                        <input
                          type="text"
                          value={editContact.phone || ''}
                          onChange={(e) => setEditContact({...editContact, phone: e.target.value})}
                          className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                          placeholder="TELÉFONO"
                        />
                        <input
                          type="email"
                          value={editContact.email || ''}
                          onChange={(e) => setEditContact({...editContact, email: e.target.value.toLowerCase()})}
                          className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                          placeholder="EMAIL"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveEdit}
                          className="flex-1 py-2 px-4 bg-[#8AAA19] text-white rounded-lg hover:bg-[#6d8814] transition-all flex items-center justify-center gap-2 font-semibold"
                          disabled={loading}
                        >
                          <FaSave /> Guardar
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="py-2 px-4 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all"
                          disabled={loading}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-bold text-[#010139]">{contact.name}</h3>
                          {contact.is_primary && (
                            <span className="flex items-center gap-1 px-2 py-1 bg-[#8AAA19] text-white text-xs font-semibold rounded-full">
                              <FaStar /> Principal
                            </span>
                          )}
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                          {contact.position && <p>📋 {contact.position}</p>}
                          {contact.phone && <p>📞 {contact.phone}</p>}
                          {contact.email && <p>✉️ {contact.email}</p>}
                          {contact.notes && (
                            <p className="mt-2 p-2 bg-gray-100 rounded-lg italic">💬 {contact.notes}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSetPrimary(contact.id)}
                          className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all ${
                            contact.is_primary
                              ? 'bg-yellow-100 text-yellow-600 cursor-not-allowed'
                              : 'bg-gray-100 text-gray-600 hover:bg-yellow-500 hover:text-white'
                          }`}
                          title={contact.is_primary ? 'Ya es principal' : 'Marcar como principal'}
                          disabled={loading || contact.is_primary === true}
                        >
                          {contact.is_primary ? <FaStar /> : <FaRegStar />}
                        </button>
                        <button
                          onClick={() => handleStartEdit(contact)}
                          className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-[#010139] hover:text-white transition-all"
                          title="Editar contacto"
                          disabled={loading}
                        >
                          <FaEdit />
                        </button>
                        <button
                          onClick={() => handleDelete(contact.id, contact.name)}
                          className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-red-500 hover:text-white transition-all"
                          title="Eliminar contacto"
                          disabled={loading}
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
