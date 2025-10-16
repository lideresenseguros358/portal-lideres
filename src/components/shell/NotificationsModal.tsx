import { format } from "date-fns";
import { es } from "date-fns/locale";

import type { Database } from "@/lib/database.types";

export type NotificationType = 'renewal' | 'case_digest' | 'commission' | 'delinquency' | 'download' | 'guide' | 'carnet_renewal' | 'other';

export type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"] & {
  read_at: string | null;
};

interface NotificationsModalProps {
  open: boolean;
  onClose: () => void;
  notifications: NotificationRow[];
  onMarkRead: (notificationId: string) => Promise<void>;
  onDelete: (notificationId: string) => Promise<void>;
}

const NotificationsModal = ({
  open,
  onClose,
  notifications,
  onMarkRead,
  onDelete,
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
      carnet_renewal: '#EF4444',
      other: '#757575'
    };
    return colors[type || 'other'];
  };

  return (
    <div className="notifications-modal" role="dialog" aria-modal="true">
      <div className="notifications-modal__backdrop" onClick={onClose} />

      <div className="notifications-modal__card">
        <header>
          <h2>Notificaciones</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
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
                  const meta = notification.meta as { cta_url?: string } | null;
                  const ctaUrl = meta?.cta_url;
                  
                  return (
                    <tr key={notification.id} className={notification.read_at ? "read" : "unread"}>
                      <td>
                        <span 
                          className="type-badge"
                          style={{ backgroundColor: getTypeBadge(notification.notification_type) }}
                        >
                          {getTypeIcon(notification.notification_type)}
                        </span>
                      </td>
                      <td>
                        {ctaUrl ? (
                          <a href={ctaUrl} className="notification-link">
                            {notification.title}
                          </a>
                        ) : (
                          notification.title
                        )}
                      </td>
                      <td>{notification.body}</td>
                      <td>
                        {format(new Date(notification.created_at), "PPpp", {
                          locale: es,
                        })}
                      </td>
                      <td>{notification.read_at ? "Leída" : "No leída"}</td>
                      <td className="actions">
                        {!notification.read_at ? (
                          <button type="button" onClick={() => onMarkRead(notification.id)}>
                            Marcar leído
                          </button>
                        ) : null}
                        <button type="button" onClick={() => onDelete(notification.id)}>
                          Borrar
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
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 26px;
          background: #010139;
          color: #ffffff;
        }

        header h2 {
          margin: 0;
          font-size: 20px;
          font-weight: 700;
        }

        header button {
          background: transparent;
          border: none;
          color: #ffffff;
          font-size: 26px;
          cursor: pointer;
          line-height: 1;
        }

        .notifications-modal__body {
          padding: 24px;
          overflow: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
          color: #23262f;
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
          gap: 8px;
        }

        td.actions button {
          background: #010139;
          color: #ffffff;
          border: none;
          border-radius: 10px;
          padding: 8px 12px;
          cursor: pointer;
          font-size: 13px;
          transition: transform 0.2s ease, background 0.2s ease;
        }

        td.actions button:hover {
          background: #8aaa19;
          transform: translateY(-1px);
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

          td,
          th {
            padding: 10px;
          }
        }
      `}</style>
    </div>
  );
};

export default NotificationsModal;
