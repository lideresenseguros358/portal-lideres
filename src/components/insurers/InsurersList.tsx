'use client';

import { useState, useTransition, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { FaEdit, FaPlus, FaSearch, FaToggleOn, FaToggleOff, FaClone, FaUndo } from 'react-icons/fa';
import { actionToggleInsurerActive, actionCloneInsurer } from '@/app/(app)/insurers/actions';

interface Insurer {
  id: string;
  name: string;
  active: boolean | null;
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

  const handleToggle = (insurerId: string) => {
    startTransition(async () => {
      const result = await actionToggleInsurerActive(insurerId);
      if (result.ok && result.data) {
        setInsurers(currentInsurers =>
          currentInsurers.map(ins => (ins.id === insurerId ? (result.data as Insurer) : ins))
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
        const newInsurer = result.data as Insurer;
        setInsurers(currentInsurers => [newInsurer, ...currentInsurers]);
        alert(`Aseguradora '${newInsurer.name}' creada.`);
      } else {
        alert(`Error al clonar: ${result.error}`);
      }
    });
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
      {/* Actions Bar */}
      <div className="actions-bar">
        <div className="search-filter-bar">
          <div className="search-input-wrapper">
            <FaSearch className="search-icon" />
            <input
              type="text"
              placeholder="Buscar aseguradoras..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
          <div className="filter-buttons">
            <button onClick={() => setStatusFilter('all')} className={statusFilter === 'all' ? 'active' : ''}>Todas</button>
            <button onClick={() => setStatusFilter('active')} className={statusFilter === 'active' ? 'active' : ''}>Activas</button>
            <button onClick={() => setStatusFilter('inactive')} className={statusFilter === 'inactive' ? 'active' : ''}>Inactivas</button>
          </div>
        </div>
        <Link href="/insurers/new" className="btn-primary">
          <FaPlus /> Nueva Aseguradora
        </Link>
      </div>

      {/* Insurers Grid */}
      {filteredInsurers.length === 0 ? (
        <div className="empty-state">No se encontraron aseguradoras.</div>
      ) : (
        <div className="insurers-grid">
          {filteredInsurers.map(insurer => (
            <div
              key={insurer.id}
              className={`insurer-card-container ${isPending ? 'pending' : ''}`}
              onClick={() => handleFlip(insurer.id)}
            >
              <div className={`insurer-card ${flippedCards.includes(insurer.id) ? 'is-flipped' : ''}`}>
                {/* Card Front */}
                <div className="card-face card-front">
                  <div className="card-header">
                    <div className="logo-container">
                      <div className="logo-placeholder">{insurer.name.charAt(0)}</div>
                    </div>
                    <span className={`status-badge ${insurer.active ? 'active' : 'inactive'}`}>
                      {insurer.active ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                  <h3 className="insurer-name">{insurer.name}</h3>
                  <div className="card-actions">
                    <Link href={`/insurers/${insurer.id}/edit`} className="action-btn edit" title="Editar" onClick={(e) => e.stopPropagation()}>
                      <FaEdit />
                    </Link>
                    <button onClick={(e) => { e.stopPropagation(); handleClone(insurer.id); }} className="action-btn clone" title="Clonar">
                      <FaClone />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleToggle(insurer.id); }} className="action-btn toggle" title={insurer.active ? 'Desactivar' : 'Activar'}>
                      {insurer.active ? <FaToggleOn /> : <FaToggleOff />}
                    </button>
                  </div>
                </div>
                {/* Card Back */}
                <div className="card-face card-back">
                  <div className="card-back-header">
                    <h4 className="card-back-title">Contacto Principal</h4>
                    <button onClick={(e) => { e.stopPropagation(); handleFlip(insurer.id); }} className="action-btn unflip" title="Volver">
                      <FaUndo />
                    </button>
                  </div>
                  <div className="card-back-content">
                    <p>No hay contacto registrado.</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <style>{`
        .actions-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          background: white;
          border-radius: 16px;
          margin-bottom: 24px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }
        .search-filter-bar {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .search-input-wrapper {
          position: relative;
        }
        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #999;
        }
        .search-input {
          padding: 10px 10px 10px 36px;
          border: 1px solid #ddd;
          border-radius: 8px;
          min-width: 300px;
        }
        .filter-buttons {
          display: flex;
          background: #f0f0f0;
          border-radius: 8px;
          padding: 4px;
        }
        .filter-buttons button {
          padding: 6px 16px;
          border: none;
          background: transparent;
          border-radius: 6px;
          font-weight: 500;
          cursor: pointer;
          color: #666;
        }
        .filter-buttons button.active {
          background: white;
          color: #010139;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 500;
          text-decoration: none;
          transition: all 0.2s ease;
          background: #010139;
          color: white;
        }
        .btn-primary:hover {
          background: #8aaa19;
        }

        .insurers-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 24px;
        }
                .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
        }
        .logo-container {
          height: 40px;
          display: flex;
          align-items: center;
        }
        .insurer-card-logo {
          object-fit: contain;
          object-position: left;
          height: 100%;
          width: auto;
        }
        .logo-placeholder {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          background: #f0f0f0;
          color: #999;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          font-weight: bold;
        }
        .status-badge {
          padding: 4px 12px;
          border-radius: 16px;
          font-size: 12px;
          font-weight: 500;
        }
        .status-badge.active {
          background: #e8f5e9;
          color: #4caf50;
        }
        .status-badge.inactive {
          background: #f5f5f5;
          color: #757575;
        }
        .insurer-name {
          font-size: 18px;
          font-weight: 600;
          color: #010139;
          margin-bottom: auto;
          flex-grow: 1;
        }
        .card-actions {
          margin-top: 20px;
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }
        .action-btn {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          background: #f6f6ff;
          color: #666;
          text-decoration: none;
        }
        .action-btn:hover {
          color: white;
        }
        .action-btn.edit:hover { background: #010139; }
        .action-btn.clone:hover { background: #8aaa19; }
        .action-btn.toggle:hover { background: #ff9800; }
        .empty-state {
          text-align: center;
          padding: 60px;
          color: #666;
          background: white;
          border-radius: 16px;
        }

        /* Flip Card Styles */
        .insurer-card-container {
          perspective: 1000px;
          background: white;
          border-radius: 16px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
          transition: all 0.2s ease;
          cursor: pointer;
          /* Add a minimum height to prevent collapse */
          min-height: 220px;
          position: relative;
        }
        .insurer-card-container:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.12);
        }
        .insurer-card {
          position: relative;
          width: 100%;
          height: 100%;
          transform-style: preserve-3d;
          transition: transform 0.6s;
        }
        .insurer-card.is-flipped {
          transform: rotateY(180deg);
        }
        .card-face {
          position: absolute;
          top: 0; left: 0;
          width: 100%;
          height: 100%;
          backface-visibility: hidden;
          display: flex;
          flex-direction: column;
          padding: 24px;
          box-sizing: border-box; /* Ensure padding is included in dimensions */
        }
        .card-back {
          transform: rotateY(180deg);
          justify-content: center;
          align-items: center;
        }
        .card-back-header {
          position: absolute;
          top: 24px;
          left: 24px;
          right: 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .card-back-title {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #010139;
        }
        .card-back-content {
          color: #666;
          font-size: 14px;
        }
        .action-btn.unflip:hover { background: #757575; }

      `}</style>
    </div>
  );
}
