'use client';

import { useState } from 'react';
import { FaPlus, FaTrash } from 'react-icons/fa';

// This is a placeholder component. The actions for contacts are not yet implemented.

interface ContactsTabProps {
  contacts: any[]; // Replace with actual type
  insurerId: string;
}

export default function ContactsTab({ contacts, insurerId }: ContactsTabProps) {
  const [contactList, setContactList] = useState(contacts);
  const [newContact, setNewContact] = useState({ name: '', position: '', phone: '', email: '' });

  const handleAdd = () => {
    // Placeholder: Add logic to save the new contact
    alert('Funcionalidad para agregar contactos no implementada.');
  };

  const handleDelete = (contactId: string) => {
    // Placeholder: Add logic to delete the contact
    alert('Funcionalidad para eliminar contactos no implementada.');
  };

  return (
    <div className="tab-pane">
      <h2 className="tab-title">Contactos</h2>
      
      {/* Add Contact Form */}
      <div className="add-contact-form">
        <input type="text" placeholder="Nombre" value={newContact.name} onChange={e => setNewContact({...newContact, name: e.target.value})} />
        <input type="text" placeholder="Cargo" value={newContact.position} onChange={e => setNewContact({...newContact, position: e.target.value})} />
        <input type="text" placeholder="Teléfono" value={newContact.phone} onChange={e => setNewContact({...newContact, phone: e.target.value})} />
        <input type="email" placeholder="Email" value={newContact.email} onChange={e => setNewContact({...newContact, email: e.target.value})} />
        <button onClick={handleAdd} className="btn-add"><FaPlus /> Agregar</button>
      </div>

      {/* Contacts List */}
      <div className="contacts-list">
        {contactList.map(contact => (
          <div key={contact.id} className="contact-item">
            <div>
              <p className="contact-name">{contact.name}</p>
              <p className="contact-details">{contact.position} | {contact.phone} | {contact.email}</p>
            </div>
            <button onClick={() => handleDelete(contact.id)} className="btn-delete"><FaTrash /></button>
          </div>
        ))}
      </div>

      <style>{`
        .add-contact-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .add-contact-form input { padding: 10px; border: 1px solid #ddd; border-radius: 8px; }
        .btn-add { display: flex; align-items: center; justify-content: center; gap: 8px; background: #8aaa19; color: white; border: none; border-radius: 8px; cursor: pointer; }
        .contacts-list { display: flex; flex-direction: column; gap: 12px; }
        .contact-item { display: flex; justify-content: space-between; align-items: center; padding: 16px; background: #f9f9f9; border-radius: 8px; }
        .contact-name { font-weight: 600; }
        .contact-details { font-size: 14px; color: #666; }
        .btn-delete { background: none; border: none; color: #d32f2f; cursor: pointer; }
      `}</style>
    </div>
  );
}
