'use client';

import { useState, useEffect } from 'react';
import { FaPlus, FaTrash, FaEdit, FaSave, FaTimes } from 'react-icons/fa';
import { toast } from 'sonner';
import { 
  actionGetInsurerContacts, 
  actionCreateInsurerContact, 
  actionUpdateInsurerContact,
  actionDeleteInsurerContact 
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

interface ContactsTabProps {
  contacts: Contact[];
  insurerId: string;
}

export default function ContactsTab({ contacts: initialContacts, insurerId }: ContactsTabProps) {
  const [contactList, setContactList] = useState<Contact[]>(initialContacts || []);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [newContact, setNewContact] = useState({
    name: '',
    position: '',
    phone: '',
    email: '',
    notes: ''
  });

  const [editContact, setEditContact] = useState<Contact | null>(null);

  // Cargar contactos al montar
  useEffect(() => {
    loadContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insurerId]);

  const loadContacts = async () => {
    try {
      const result = await actionGetInsurerContacts(insurerId);
      if (result.ok) {
        setContactList(result.data);
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
        toast.success('✅ Contacto agregado correctamente');
        setNewContact({ name: '', position: '', phone: '', email: '', notes: '' });
        await loadContacts();
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
      } else {
        toast.error(result.error || 'Error al eliminar contacto');
      }
    } catch (error: any) {
      toast.error(error.message || 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tab-pane">
      <h2 className="tab-title">Contactos de la Aseguradora</h2>
      
      {/* Add Contact Form */}
      <div className="add-contact-section">
        <h3 className="section-subtitle">Agregar Nuevo Contacto</h3>
        <div className="add-contact-form">
          <div className="form-field">
            <label>Nombre <span className="required">*</span></label>
            <input
              type="text"
              placeholder="NOMBRE COMPLETO"
              value={newContact.name}
              onChange={createUppercaseHandler((e) => setNewContact({...newContact, name: e.target.value}))}
              className={uppercaseInputClass}
              disabled={loading}
            />
          </div>
          
          <div className="form-field">
            <label>Cargo</label>
            <input
              type="text"
              placeholder="CARGO O POSICIÓN"
              value={newContact.position}
              onChange={createUppercaseHandler((e) => setNewContact({...newContact, position: e.target.value}))}
              className={uppercaseInputClass}
              disabled={loading}
            />
          </div>
          
          <div className="form-field">
            <label>Teléfono</label>
            <input
              type="text"
              placeholder="6000-0000"
              value={newContact.phone}
              onChange={(e) => setNewContact({...newContact, phone: e.target.value})}
              disabled={loading}
            />
          </div>
          
          <div className="form-field">
            <label>Email</label>
            <input
              type="email"
              placeholder="email@ejemplo.com"
              value={newContact.email}
              onChange={(e) => setNewContact({...newContact, email: e.target.value.toLowerCase()})}
              disabled={loading}
            />
          </div>

          <div className="form-field full-width">
            <label>Notas</label>
            <textarea
              placeholder="NOTAS ADICIONALES"
              value={newContact.notes}
              onChange={createUppercaseHandler((e) => setNewContact({...newContact, notes: e.target.value}))}
              className={uppercaseInputClass}
              rows={2}
              disabled={loading}
            />
          </div>
        </div>
        
        <button 
          onClick={handleAdd} 
          className="btn-add"
          disabled={loading || !newContact.name.trim()}
        >
          <FaPlus /> {loading ? 'Agregando...' : 'Agregar Contacto'}
        </button>
      </div>

      {/* Contacts List */}
      <div className="contacts-section">
        <h3 className="section-subtitle">
          Contactos Registrados ({contactList.length})
        </h3>
        
        {contactList.length === 0 ? (
          <div className="empty-state">
            <p>No hay contactos registrados</p>
            <p className="empty-hint">Agrega el primer contacto usando el formulario arriba</p>
          </div>
        ) : (
          <div className="contacts-list">
            {contactList.map(contact => (
              <div key={contact.id} className="contact-item">
                {editingId === contact.id && editContact ? (
                  // Edit Mode
                  <div className="contact-edit-form">
                    <div className="edit-fields">
                      <input
                        type="text"
                        value={editContact.name}
                        onChange={createUppercaseHandler((e) => setEditContact({...editContact, name: e.target.value}))}
                        className={`edit-input ${uppercaseInputClass}`}
                        placeholder="NOMBRE"
                      />
                      <input
                        type="text"
                        value={editContact.position || ''}
                        onChange={createUppercaseHandler((e) => setEditContact({...editContact, position: e.target.value}))}
                        className={`edit-input ${uppercaseInputClass}`}
                        placeholder="CARGO"
                      />
                      <input
                        type="text"
                        value={editContact.phone || ''}
                        onChange={(e) => setEditContact({...editContact, phone: e.target.value})}
                        className="edit-input"
                        placeholder="TELÉFONO"
                      />
                      <input
                        type="email"
                        value={editContact.email || ''}
                        onChange={(e) => setEditContact({...editContact, email: e.target.value.toLowerCase()})}
                        className="edit-input"
                        placeholder="EMAIL"
                      />
                    </div>
                    <div className="edit-actions">
                      <button onClick={handleSaveEdit} className="btn-save" disabled={loading}>
                        <FaSave /> Guardar
                      </button>
                      <button onClick={handleCancelEdit} className="btn-cancel" disabled={loading}>
                        <FaTimes /> Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <>
                    <div className="contact-info">
                      <p className="contact-name">{contact.name}</p>
                      <div className="contact-details">
                        {contact.position && <span className="detail-item">📋 {contact.position}</span>}
                        {contact.phone && <span className="detail-item">📞 {contact.phone}</span>}
                        {contact.email && <span className="detail-item">✉️ {contact.email}</span>}
                      </div>
                      {contact.notes && (
                        <p className="contact-notes">💬 {contact.notes}</p>
                      )}
                    </div>
                    <div className="contact-actions">
                      <button 
                        onClick={() => handleStartEdit(contact)} 
                        className="btn-edit"
                        disabled={loading}
                        title="Editar contacto"
                      >
                        <FaEdit />
                      </button>
                      <button 
                        onClick={() => handleDelete(contact.id, contact.name)} 
                        className="btn-delete"
                        disabled={loading}
                        title="Eliminar contacto"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .tab-pane {
          padding: 20px;
        }

        .tab-title {
          font-size: 24px;
          color: #010139;
          margin-bottom: 24px;
          font-weight: bold;
        }

        .section-subtitle {
          font-size: 18px;
          color: #010139;
          margin-bottom: 16px;
          font-weight: 600;
        }

        .required {
          color: #d32f2f;
        }

        .add-contact-section {
          background: #f9f9f9;
          padding: 20px;
          border-radius: 12px;
          margin-bottom: 32px;
          border: 2px solid #e0e0e0;
        }

        .add-contact-form {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }

        .form-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .form-field.full-width {
          grid-column: 1 / -1;
        }

        .form-field label {
          font-size: 13px;
          font-weight: 600;
          color: #666;
        }

        .add-contact-form input,
        .add-contact-form textarea {
          padding: 10px 12px;
          border: 2px solid #ddd;
          border-radius: 8px;
          font-size: 14px;
          transition: border-color 0.2s;
        }

        .add-contact-form input:focus,
        .add-contact-form textarea:focus {
          outline: none;
          border-color: #8aaa19;
        }

        .add-contact-form input:disabled,
        .add-contact-form textarea:disabled {
          background: #f5f5f5;
          cursor: not-allowed;
        }

        .btn-add {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: #8aaa19;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 12px 24px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
          font-size: 14px;
        }

        .btn-add:hover:not(:disabled) {
          background: #6d8814;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(138, 170, 25, 0.3);
        }

        .btn-add:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .contacts-section {
          margin-top: 32px;
        }

        .empty-state {
          text-align: center;
          padding: 48px 24px;
          background: #f9f9f9;
          border-radius: 12px;
          border: 2px dashed #ddd;
        }

        .empty-state p {
          margin: 0;
          color: #666;
        }

        .empty-hint {
          font-size: 13px;
          margin-top: 8px !important;
          color: #999;
        }

        .contacts-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .contact-item {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 16px;
          background: white;
          border: 2px solid #e0e0e0;
          border-radius: 12px;
          transition: all 0.2s;
        }

        .contact-item:hover {
          border-color: #8aaa19;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .contact-info {
          flex: 1;
        }

        .contact-name {
          font-weight: 700;
          font-size: 16px;
          color: #010139;
          margin: 0 0 8px 0;
        }

        .contact-details {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 8px;
        }

        .detail-item {
          font-size: 13px;
          color: #666;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .contact-notes {
          font-size: 13px;
          color: #666;
          font-style: italic;
          margin: 8px 0 0 0;
          padding: 8px;
          background: #f9f9f9;
          border-radius: 6px;
        }

        .contact-actions {
          display: flex;
          gap: 8px;
          flex-shrink: 0;
        }

        .btn-edit,
        .btn-delete {
          background: none;
          border: none;
          cursor: pointer;
          padding: 8px;
          border-radius: 6px;
          transition: all 0.2s;
          font-size: 16px;
        }

        .btn-edit {
          color: #1976d2;
        }

        .btn-edit:hover:not(:disabled) {
          background: #e3f2fd;
        }

        .btn-delete {
          color: #d32f2f;
        }

        .btn-delete:hover:not(:disabled) {
          background: #ffebee;
        }

        .btn-edit:disabled,
        .btn-delete:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .contact-edit-form {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .edit-fields {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
        }

        .edit-input {
          padding: 8px 12px;
          border: 2px solid #ddd;
          border-radius: 6px;
          font-size: 13px;
        }

        .edit-input:focus {
          outline: none;
          border-color: #8aaa19;
        }

        .edit-actions {
          display: flex;
          gap: 8px;
        }

        .btn-save,
        .btn-cancel {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          transition: all 0.2s;
        }

        .btn-save {
          background: #8aaa19;
          color: white;
        }

        .btn-save:hover:not(:disabled) {
          background: #6d8814;
        }

        .btn-cancel {
          background: #e0e0e0;
          color: #666;
        }

        .btn-cancel:hover:not(:disabled) {
          background: #d0d0d0;
        }

        .btn-save:disabled,
        .btn-cancel:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          .add-contact-form {
            grid-template-columns: 1fr;
          }
          
          .contact-item {
            flex-direction: column;
            gap: 12px;
          }

          .contact-actions {
            width: 100%;
            justify-content: flex-end;
          }

          .edit-fields {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
