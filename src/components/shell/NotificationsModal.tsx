import { format } from "date-fns";
import { es } from "date-fns/locale";

import type { Database } from "@/lib/database.types";

export type NotificationType = 'renewal' | 'case_digest' | 'commission' | 'delinquency' | 'download' | 'guide' | 'carnet_renewal' | 'agenda_event' | 'other';

export type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"] & {
  read_at: string | null;
};

interface NotificationsModalProps {
  open: boolean;
  onClose: () => void;
  notifications: NotificationRow[];
  onMarkRead: (notificationId: string) => Promise<void>;
  onDelete: (notificationId: string) => Promise<void>;
  onDeleteAll: () => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onRenewPolicy?: (policyId: string, notificationId: string) => Promise<void>;
}

const NotificationsModal = ({
  open,
  onClose,
  notifications,
  onMarkRead,
  onDelete,
  onDeleteAll,
  onMarkAllRead,
  onRenewPolicy,
}: NotificationsModalProps) => {
  if (!open) return null;

  const getTypeIcon = (type?: NotificationType | null) => {
    switch (type) {
      case 'renewal': return '🔄';
      case 'case_digest': return '📋';
      case 'commission': return '💰';
      case 'delinquency': return '⚠️';
      case 'download': return '📥';
      case 'guide': return '📚';
      case 'carnet_renewal': return '🎫';
      case 'agenda_event': return '📅';
      default: return '📝';
    }
  };

  const getTypeBadge = (type?: NotificationType | null) => {
    const colors: Record<string, string> = {
      renewal: '#2196F3',
      case_digest: '#8AAA19',
      commission: '#4CAF50',
      delinquency: '#FF9800',
      download: '#9C27B0',
      guide: '#00BCD4',
      carnet_renewal: '#9C27B0',
      agenda_event: '#FF5722',
      other: '#757575'
    };
    return colors[type || 'other'];
  };

  return (
    <div className="notifications-modal" role="dialog" aria-modal="true">
      <div className="notifications-modal__backdrop" onClick={onClose} />

      <div className="notifications-modal__card">
        <header>
          <div className="header-content">
            <h2>Notificaciones</h2>
            <div className="header-actions">
              {notifications.length > 0 && (
                <>
                  <button 
                    type="button" 
                    className="action-btn mark-all-btn"
                    onClick={onMarkAllRead}
                    aria-label="Marcar todas como leídas"
                    title="Marcar todas como leídas"
                  >
                    ✓
                  </button>
                  <button 
                    type="button" 
                    className="action-btn delete-all-btn"
                    onClick={async () => {
                      if (confirm('¿Eliminar todas las notificaciones?')) {
                        await onDeleteAll();
                      }
                    }}
                    aria-label="Eliminar todas"
                    title="Eliminar todas"
                  >
                    🗑️
                  </button>
                </>
              )}
              <button type="button" className="close-btn" onClick={onClose} aria-label="Cerrar">
                ×
              </button>
            </div>
          </div>
        </header>

        <div className="notifications-modal__body">
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Título</th>
                <th>Mensaje</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {notifications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty">
                    No hay notificaciones disponibles.
                  </td>
                </tr>
              ) : (
                notifications.map((notification) => {
                  const meta = notification.meta as { 
                    cta_url?: string;
                    show_renew_button?: boolean;
                    policies?: Array<{ policy_id?: string; policy_number?: string }>
                  } | null;
                  const ctaUrl = meta?.cta_url;
                  const showRenewButton = meta?.show_renew_button;
                  const policies = meta?.policies || [];
                  
                  return (
                    <tr key={notification.id} className={notification.read_at ? "read" : "unread"}>
                      <td data-label="Tipo:">
                        <span 
                          className="type-badge"
                          style={{ backgroundColor: getTypeBadge(notification.notification_type) }}
                        >
                          {getTypeIcon(notification.notification_type)}
                        </span>
                      </td>
                      <td data-label="Título:">
                        {ctaUrl ? (
                          <a href={ctaUrl} className="notification-link">
                            {notification.title}
                          </a>
                        ) : (
                          notification.title
                        )}
                      </td>
                      <td data-label="Mensaje:">{notification.body}</td>
                      <td data-label="Fecha:">
                        {format(new Date(notification.created_at), "PPpp", {
                          locale: es,
                        })}
                      </td>
                      <td data-label="Estado:">{notification.read_at ? "Leída" : "No leída"}</td>
                      <td className="actions">
                        {showRenewButton && policies.length > 0 && onRenewPolicy && (
                          <button 
                            type="button" 
                            className="action-btn-small renew-btn"
                            onClick={async () => {
                              if (confirm(`¿Confirmar renovación de ${policies.length} póliza${policies.length > 1 ? 's' : ''}? Esto actualizará las fechas sumando 1 año.`)) {
                                for (const policy of policies) {
                                  if (policy.policy_id) {
                                    await onRenewPolicy(policy.policy_id, notification.id);
                                  }
                                }
                              }
                            }}
                            title="Ya renovó"
                          >
                            🔄 Renovar
                          </button>
                        )}
                        {!notification.read_at ? (
                          <button 
                            type="button" 
                            className="action-btn-small mark-read-btn"
                            onClick={() => onMarkRead(notification.id)}
                            title="Marcar como leída"
                          >
                            ✓
                          </button>
                        ) : null}
                        <button 
                          type="button" 
                          className="action-btn-small delete-btn"
                          onClick={() => onDelete(notification.id)}
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style jsx>{`
        .notifications-modal {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 210;
        }

        .notifications-modal__backdrop {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.35);
          backdrop-filter: blur(3px);
        }

        .notifications-modal__card {
          position: relative;
          z-index: 1;
          width: min(840px, 90vw);
          max-height: 80vh;
          background: #ffffff;
          border-radius: 20px;
          box-shadow: 0 28px 60px rgba(1, 1, 57, 0.22);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        header {
          background: #010139;
          color: #ffffff;
          padding: 20px 26px;
        }
        
        .header-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        
        .header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .action-btn {
          background: rgba(255, 255, 255, 0.1);
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 6px;
          padding: 6px 10px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 600;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 36px;
          height: 36px;
        }
        
        .action-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: translateY(-1px);
        }
        
        .mark-all-btn:hover {
          background: rgba(138, 170, 25, 0.9);
          border-color: #8AAA19;
        }
        
        .delete-all-btn:hover {
          background: rgba(239, 68, 68, 0.9);
          border-color: #EF4444;
        }
        
        .close-btn {
          background: transparent;
          border: none;
          color: #ffffff;
          font-size: 28px;
          cursor: pointer;
          line-height: 1;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s ease;
        }
        
        .close-btn:hover {
          transform: scale(1.1);
        }

        header h2 {
          margin: 0;
          font-size: 20px;
          font-weight: 700;
        }


        .notifications-modal__body {
          padding: 24px;
          overflow-y: auto;
          overflow-x: hidden;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
          color: #23262f;
          table-layout: fixed;
        }

        th,
        td {
          text-align: left;
          padding: 12px;
          border-bottom: 1px solid rgba(1, 1, 57, 0.08);
        }

        tbody tr.unread {
          background: rgba(138, 170, 25, 0.12);
        }

        tbody tr:hover {
          background: rgba(138, 170, 25, 0.06);
        }

        td.empty {
          text-align: center;
          color: #6d6d6d;
          font-style: italic;
        }

        td.actions {
          display: flex;
          gap: 6px;
          align-items: center;
        }

        .action-btn-small {
          background: rgba(1, 1, 57, 0.08);
          color: #010139;
          border: 1px solid rgba(1, 1, 57, 0.15);
          border-radius: 6px;
          padding: 6px 10px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 32px;
          height: 32px;
        }

        .action-btn-small:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        .mark-read-btn {
          background: rgba(138, 170, 25, 0.1);
          color: #8AAA19;
          border-color: rgba(138, 170, 25, 0.3);
        }
        
        .mark-read-btn:hover {
          background: #8AAA19;
          color: white;
          border-color: #8AAA19;
        }
        
        .delete-btn {
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.3);
        }
        
        .delete-btn:hover {
          background: #EF4444;
          border-color: #EF4444;
        }
        
        .renew-btn {
          background: rgba(33, 150, 243, 0.1);
          color: #2196F3;
          border-color: rgba(33, 150, 243, 0.3);
          font-weight: 600;
        }
        
        .renew-btn:hover {
          background: #2196F3;
          color: white;
          border-color: #2196F3;
        }

        .type-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          font-size: 16px;
          color: #ffffff;
        }

        .notification-link {
          color: #010139;
          text-decoration: none;
          font-weight: 600;
        }

        .notification-link:hover {
          color: #8aaa19;
          text-decoration: underline;
        }

        @media (max-width: 640px) {
          .notifications-modal__card {
            width: 95vw;
          }

          .notifications-modal__body {
            padding: 12px;
          }
          
          .header-content {
            flex-wrap: wrap;
            gap: 12px;
          }
          
          .header-actions {
            flex-shrink: 0;
          }
          
          .action-btn {
            min-width: 32px;
            height: 32px;
            padding: 4px 8px;
            font-size: 14px;
          }

          table {
            display: block;
            width: 100%;
          }
          
          thead {
            display: none;
          }
          
          tbody {
            display: block;
            width: 100%;
          }
          
          tr {
            display: block;
            margin-bottom: 16px;
            border: 1px solid rgba(1, 1, 57, 0.12);
            border-radius: 12px;
            padding: 12px;
            background: #fff;
          }
          
          tr.unread {
            background: rgba(138, 170, 25, 0.08);
            border-color: #8AAA19;
          }
          
          td {
            display: block;
            text-align: left;
            padding: 6px 0;
            border: none;
          }
          
          td:before {
            content: attr(data-label);
            font-weight: 700;
            color: #010139;
            margin-right: 8px;
          }
          
          td.actions {
            flex-direction: row;
            justify-content: flex-start;
            padding-top: 12px;
            margin-top: 8px;
            border-top: 1px solid rgba(1, 1, 57, 0.08);
          }
          
          td.empty {
            text-align: center;
          }
        }
      `}</style>
    </div>
  );
};

export default NotificationsModal;
