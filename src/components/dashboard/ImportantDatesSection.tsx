'use client';

import { useState } from 'react';
import EditDatesModal from './EditDatesModal';
import type { ImportantDatesData } from '@/lib/important-dates';

interface ImportantDatesSectionProps {
  initialDates: ImportantDatesData;
  isMaster: boolean;
}

export default function ImportantDatesSection({ initialDates, isMaster }: ImportantDatesSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dates, setDates] = useState(initialDates);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const monthName = new Date(dates.year, dates.month - 1).toLocaleString('es', { month: 'long' });

  const handleSave = async (newDates: ImportantDatesData) => {
    const response = await fetch('/api/important-dates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newDates),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al guardar');
    }

    setDates(newDates);
    setIsRefreshing(true);
    
    // Recargar la página para obtener datos frescos
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  return (
    <>
      <div className="dates-section">
        <div className="dates-card">
          <h3 className="dates-card-title">Actividad del mes de {monthName}</h3>
          
          <div className="date-item">
            <div className="date-icon">📋</div>
            <div className="date-content">
              <div className="date-label">Último día trámites vida con cancelación</div>
              <div className="date-value">{dates.vidaConCancelacionDay} de {monthName}</div>
            </div>
          </div>
          
          <div className="date-item">
            <div className="date-icon">📄</div>
            <div className="date-content">
              <div className="date-label">Último día trámites vía regular</div>
              <div className="date-value">{dates.viaRegularDay} de {monthName}</div>
            </div>
          </div>
          
          <div className="date-item">
            <div className="date-icon">📅</div>
            <div className="date-content">
              <div className="date-label">Fechas APADEA</div>
              <div className="date-value">{dates.apadeaText || 'No especificado'}</div>
            </div>
          </div>
          
          <div className="date-item">
            <div className="date-icon">🔒</div>
            <div className="date-content">
              <div className="date-label">Día de cierre de mes</div>
              <div className="date-value">{dates.cierreMesDay} de {monthName}</div>
            </div>
          </div>
          
          {dates.newsActive && dates.newsText && (
            <div className="news-item">
              <div className="news-icon">📢</div>
              <div className="news-content">
                <div className="news-label">Noticias</div>
                <div className="news-text">{dates.newsText}</div>
              </div>
            </div>
          )}
          
          {isMaster && (
            <button 
              className="edit-dates-btn" 
              title="Editar fechas"
              onClick={() => setIsModalOpen(true)}
              disabled={isRefreshing}
            >
              {isRefreshing ? '⏳ Actualizando...' : '✏️ Editar fechas'}
            </button>
          )}
        </div>
      </div>

      {isMaster && (
        <EditDatesModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          currentDates={dates}
          onSave={handleSave}
        />
      )}
    </>
  );
}
