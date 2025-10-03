'use client';

import { FaFileAlt, FaTrash, FaExclamationTriangle } from 'react-icons/fa';

interface Report {
  id: string;
  insurer_name: string;
  total_amount: number;
  created_at: string;
  items_count: number;
  broker_commissions?: number; // Mock data for now
  office_total?: number;
  office_percentage?: number;
  is_life_insurance?: boolean;
}

interface Props {
  reports: Report[];
  onDelete: (importId: string) => Promise<void>;
}

export default function ImportedReportsList({ reports, onDelete }: Props) {
  if (reports.length === 0) {
    return (
      <div className="empty-list">
        <p>No hay reportes importados en esta quincena.</p>
      </div>
    );
  }
  
  // Calculate totals for each report
  // Total Oficina = Total Reporte (porque aún no hay items identificados con broker)
  const reportsWithTotals = reports.map(report => {
    // Broker commissions = 0 porque todos están sin identificar (broker_id = NULL)
    const brokerCommissions = 0;
    const officeTotal = report.total_amount;
    const officePercentage = 100; // 100% oficina porque nada está identificado
    return {
      ...report,
      broker_commissions: brokerCommissions,
      office_total: officeTotal,
      office_percentage: officePercentage,
    };
  });

  return (
    <div className="reports-list-container">
      <h3 className="section-title">Reportes Importados</h3>
      <div className="list-content">
        {reportsWithTotals.map(report => (
          <div key={report.id} className="report-item">
            <div className="report-icon">
              <FaFileAlt />
            </div>
            <div className="report-details">
              <div className="report-header">
                <span className="insurer-name">{report.insurer_name}</span>
                {report.is_life_insurance && (
                  <span className="life-badge">Vida</span>
                )}
              </div>
              <div className="report-totals">
                <div className="total-item">
                  <span className="label">Total Reporte:</span>
                  <span className="value">${report.total_amount.toLocaleString()}</span>
                </div>
                <div className="total-item">
                  <span className="label">Comisiones:</span>
                  <span className="value text-gray-600">${report.broker_commissions?.toLocaleString()}</span>
                </div>
                <div className="total-item">
                  <span className="label">Total Oficina:</span>
                  <span className="value text-[#8AAA19]">${report.office_total?.toLocaleString()}</span>
                  <span className={`percentage ${report.office_percentage && report.office_percentage <= 20 ? 'low' : 'normal'}`}>
                    {report.office_percentage?.toFixed(1)}%
                    {report.office_percentage && report.office_percentage <= 20 && (
                      <FaExclamationTriangle className="warning-icon" />
                    )}
                  </span>
                </div>
              </div>
              <span className="report-meta">
                {report.items_count} items procesados
              </span>
            </div>
            <button onClick={() => onDelete(report.id)} className="delete-btn" title="Eliminar Importación">
              <FaTrash />
            </button>
          </div>
        ))}
      </div>

      <style>{`
        .reports-list-container {
          background: #f8f9fa;
          border-radius: 12px;
          padding: 24px;
        }
        .section-title {
          font-size: 18px;
          font-weight: 600;
          color: #010139;
          margin-bottom: 16px;
        }
        .empty-list {
          text-align: center;
          color: #666;
          padding: 24px;
          background: #f8f9fa;
          border-radius: 12px;
        }
        .list-content {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .report-item {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          background: white;
          padding: 16px;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          border-left: 3px solid transparent;
          transition: all 0.2s;
        }
        .report-item:hover {
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          border-left-color: #8AAA19;
        }
        .report-icon {
          color: #8aaa19;
        }
        .report-details {
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .report-header {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .insurer-name {
          font-weight: 600;
          color: #010139;
          font-size: 16px;
        }
        .life-badge {
          background: #3B82F6;
          color: white;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
        }
        .report-totals {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 8px;
          background: #f8f9fa;
          border-radius: 6px;
        }
        .total-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
        }
        .total-item .label {
          color: #667085;
        }
        .total-item .value {
          font-weight: 500;
          font-family: monospace;
        }
        .percentage {
          margin-left: 8px;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
        }
        .percentage.normal {
          background: #D1FAE5;
          color: #065F46;
        }
        .percentage.low {
          background: #FEE2E2;
          color: #991B1B;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .warning-icon {
          font-size: 10px;
        }
        .report-meta {
          font-size: 11px;
          color: #98A2B3;
        }
        .delete-btn {
          background: none;
          border: none;
          color: #98a2b3;
          cursor: pointer;
          transition: color 0.2s;
        }
        .delete-btn:hover {
          color: #d92d20;
        }
      `}</style>
    </div>
  );
}
