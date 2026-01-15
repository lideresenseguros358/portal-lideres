"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FaBell } from "react-icons/fa";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

import { supabaseClient, type Tables } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";
import NotificationsModal, { NotificationRow } from "./NotificationsModal";
type NotificationRead = Database["public"]["Tables"]["notification_reads"]["Row"];

interface NotificationsBellProps {
  profileId: string;
  role: 'master' | 'broker' | null;
  brokerId: string | null;
}

const NotificationsBell = ({ profileId, role, brokerId }: NotificationsBellProps) => {
  const router = useRouter();
  const supabase = useMemo(() => supabaseClient(), []);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const unreadCount = notifications.filter((item) => !item.read_at).length;

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [{ data: notificationsData, error: notificationsError }, { data: readsData, error: readsError }] =
        await Promise.all([
          supabase
            .from("notifications")
            .select("id, title, body, created_at, target, broker_id, meta, notification_type, email_sent")
            .order("created_at", { ascending: false }),
          supabase
            .from("notification_reads")
            .select("notification_id, read_at")
            .eq("profile_id", profileId),
        ]);

      if (notificationsError) throw notificationsError;
      if (readsError) throw readsError;

      // FILTRAR notificaciones según rol
      let filteredNotifications = notificationsData ?? [];
      
      if (role === 'master') {
        // Master solo ve: target='MASTER' o target='ALL'
        filteredNotifications = filteredNotifications.filter(
          notif => notif.target === 'MASTER' || notif.target === 'ALL'
        );
      } else if (role === 'broker' && brokerId) {
        // Broker solo ve: (target='BROKER' y broker_id=suyo) o target='ALL'
        filteredNotifications = filteredNotifications.filter(
          notif => 
            notif.target === 'ALL' || 
            (notif.target === 'BROKER' && notif.broker_id === profileId)
        );
      }

      const readsMap = new Map<string, NotificationRead["read_at"]>(
        (readsData ?? []).map((read) => [read.notification_id, read.read_at])
      );
      const mapped: NotificationRow[] = filteredNotifications.map((item) => ({
        ...item,
        read_at: readsMap.get(item.id) ?? null,
      }));

      setNotifications(mapped);
      setError(null);
    } catch (err: any) {
      console.error("notifications fetch error", err);
      const fallback = "No se pudieron cargar las notificaciones";
      setError(err?.message ?? fallback);
      setToast({ type: "error", message: fallback });
    } finally {
      setLoading(false);
    }
  }, [profileId, role, brokerId, supabase]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (event: MouseEvent) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timeout);
  }, [toast]);

  const showErrorToast = useCallback((message: string) => {
    setToast({ type: "error", message });
  }, []);

  const handleMarkRead = useCallback(
    async (notificationId: string) => {
      try {
        const { error: upsertError } = await supabase.from("notification_reads").upsert({
          notification_id: notificationId,
          profile_id: profileId,
          read_at: new Date().toISOString(),
        });
        if (upsertError) throw upsertError;
        await loadNotifications();
      } catch (err) {
        console.error("mark read error", err);
        showErrorToast("No se pudo marcar la notificación como leída");
      }
    },
    [loadNotifications, profileId, showErrorToast, supabase]
  );

  const handleNotificationClick = useCallback(
    async (notification: NotificationRow) => {
      // Marcar como leída
      if (!notification.read_at) {
        await handleMarkRead(notification.id);
      }

      // Navegar a deep-link si existe
      if (notification.meta && typeof notification.meta === 'object') {
        const meta = notification.meta as { cta_url?: string };
        if (meta.cta_url) {
          setDropdownOpen(false);
          router.push(meta.cta_url);
        }
      }
    },
    [handleMarkRead, router]
  );

  const handleDelete = useCallback(
    async (notificationId: string) => {
      try {
        // Marcar como leída
        const { error: upsertError } = await supabase
          .from("notification_reads")
          .upsert({
            notification_id: notificationId,
            profile_id: profileId,
            read_at: new Date().toISOString(),
          });
        
        if (upsertError) throw upsertError;
        
        // Remover del estado local (simula eliminación)
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        setToast({ type: "success", message: "Notificación eliminada" });
      } catch (err) {
        console.error("delete notification error", err);
        showErrorToast("No se pudo borrar la notificación");
      }
    },
    [profileId, showErrorToast, supabase]
  );
  
  const handleMarkAllRead = useCallback(
    async () => {
      try {
        const now = new Date().toISOString();
        const unreadNotifications = notifications.filter(n => !n.read_at);
        
        if (unreadNotifications.length === 0) {
          setToast({ type: "success", message: "No hay notificaciones sin leer" });
          return;
        }
        
        // Marcar todas como leídas
        const upsertPromises = unreadNotifications.map(notif => 
          supabase.from("notification_reads").upsert({
            notification_id: notif.id,
            profile_id: profileId,
            read_at: now,
          })
        );
        
        await Promise.all(upsertPromises);
        await loadNotifications();
        setToast({ type: "success", message: "Todas marcadas como leídas" });
      } catch (err) {
        console.error("mark all read error", err);
        showErrorToast("No se pudieron marcar todas como leídas");
      }
    },
    [notifications, profileId, showErrorToast, supabase, loadNotifications]
  );

  const handleRenewPolicy = useCallback(
    async (policyId: string, notificationId: string) => {
      try {
        const response = await fetch('/api/policies/renew', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ policyId }),
        });

        const result = await response.json();

        if (!result.ok) {
          throw new Error(result.error || 'Error al renovar póliza');
        }

        setToast({ type: "success", message: "Póliza renovada exitosamente" });
        
        // Marcar notificación como leída
        await handleMarkRead(notificationId);
        
        // Recargar notificaciones
        await loadNotifications();
      } catch (err: any) {
        console.error("renew policy error", err);
        showErrorToast(err.message || "No se pudo renovar la póliza");
      }
    },
    [handleMarkRead, loadNotifications, showErrorToast]
  );
  
  const handleDeleteAll = useCallback(
    async () => {
      try {
        const now = new Date().toISOString();
        
        // Marcar todas como leídas
        const upsertPromises = notifications.map(notif => 
          supabase.from("notification_reads").upsert({
            notification_id: notif.id,
            profile_id: profileId,
            read_at: now,
          })
        );
        
        await Promise.all(upsertPromises);
        
        // Limpiar estado local (simula eliminación)
        setNotifications([]);
        setToast({ type: "success", message: "Todas las notificaciones eliminadas" });
      } catch (err) {
        console.error("delete all notifications error", err);
        showErrorToast("No se pudieron eliminar todas las notificaciones");
      }
    },
    [notifications, profileId, showErrorToast, supabase]
  );

  const latestFive = notifications.slice(0, 5);

  return (
    <div className="notifications-bell" ref={dropdownRef}>
      <button
        type="button"
        className="bell-button"
        aria-label="Notificaciones"
        onClick={() => setDropdownOpen((prev) => !prev)}
      >
        <FaBell />
        {unreadCount > 0 ? <span className="badge">{unreadCount}</span> : null}
      </button>

      {dropdownOpen ? (
        <div className="dropdown">
          <div className="dropdown-header">
            <p>Últimas notificaciones</p>
            <button type="button" onClick={loadNotifications} disabled={loading}>
              {loading ? "Actualizando..." : "Actualizar"}
            </button>
          </div>

          {error ? <p className="error">{error}</p> : null}

          <ul>
            {latestFive.length === 0 ? (
              <li className="empty">Sin notificaciones recientes</li>
            ) : (
              latestFive.map((notification) => (
                <li 
                  key={notification.id} 
                  className={notification.read_at ? "read" : "unread"}
                  onClick={() => handleNotificationClick(notification)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="info">
                    <span className="title">{notification.title}</span>
                    <span className="body">{notification.body}</span>
                  </div>
                  <span className="date">
                    {formatDistanceToNow(new Date(notification.created_at), {
                      addSuffix: true,
                      locale: es,
                    })}
                  </span>
                  {!notification.read_at ? (
                    <button 
                      type="button" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkRead(notification.id);
                      }}
                    >
                      Marcar leído
                    </button>
                  ) : null}
                </li>
              ))
            )}
          </ul>

          <button
            type="button"
            className="view-all"
            onClick={() => {
              setModalOpen(true);
              setDropdownOpen(false);
            }}
          >
            Ver todas
          </button>
        </div>
      ) : null}

      <NotificationsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        notifications={notifications}
        onMarkRead={handleMarkRead}
        onDelete={handleDelete}
        onDeleteAll={handleDeleteAll}
        onMarkAllRead={handleMarkAllRead}
        onRenewPolicy={handleRenewPolicy}
      />

      {toast ? (
        <div className={`toast toast-${toast.type}`} role="status">
          {toast.message}
        </div>
      ) : null}

      <style jsx>{`
        .notifications-bell {
          position: relative;
        }

        .bell-button {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: none;
          background: transparent;
          color: #010139;
          cursor: pointer;
          transition: transform 0.2s ease;
        }

        .bell-button:hover {
          transform: scale(1.05);
        }

        .badge {
          position: absolute;
          top: -4px;
          right: -2px;
          background: #8aaa19;
          color: #ffffff;
          border-radius: 999px;
          padding: 2px 6px;
          font-size: 11px;
          font-weight: 700;
        }

        .dropdown {
          position: absolute;
          top: calc(100% + 10px);
          right: 0;
          width: 320px;
          background: #ffffff;
          border-radius: 18px;
          box-shadow: 0 24px 45px rgba(1, 1, 57, 0.18);
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          z-index: 120;
        }

        .dropdown-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .dropdown-header p {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: #010139;
        }

        .dropdown-header button {
          background: none;
          border: none;
          color: #8aaa19;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .error {
          margin: 0;
          color: #d22;
          font-size: 13px;
        }

        ul {
          margin: 0;
          padding: 0;
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-height: 280px;
          overflow-y: auto;
        }

        li {
          display: flex;
          flex-direction: column;
          gap: 6px;
          border-radius: 14px;
          padding: 10px 12px;
          background: rgba(1, 1, 57, 0.04);
        }

        li.unread {
          background: rgba(138, 170, 25, 0.14);
        }

        li .info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        li .title {
          font-size: 14px;
          font-weight: 600;
          color: #010139;
        }

        li .body {
          font-size: 13px;
          color: #505050;
        }

        li .date {
          font-size: 12px;
          color: #8a8a8a;
        }

        li button {
          align-self: flex-start;
          background: none;
          border: none;
          color: #8aaa19;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          padding: 0;
        }

        li button:hover {
          color: #6f8815;
        }

        .empty {
          text-align: center;
          color: #6d6d6d;
          font-style: italic;
          background: rgba(1, 1, 57, 0.02);
        }

        .view-all {
          background: #010139;
          color: #ffffff;
          border: none;
          border-radius: 12px;
          padding: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s ease, transform 0.2s ease;
        }

        .view-all:hover {
          background: #8aaa19;
          transform: translateY(-1px);
        }

        .toast {
          position: fixed;
          top: 24px;
          right: 24px;
          background: rgba(255, 255, 255, 0.96);
          border-radius: 12px;
          padding: 12px 18px;
          box-shadow: 0 18px 40px rgba(1, 1, 57, 0.16);
          font-size: 14px;
          font-weight: 600;
          color: #010139;
          z-index: 200;
          border-left: 6px solid #8aaa19;
        }

        .toast-error {
          border-left-color: #d94f4f;
          color: #861b1b;
        }
      `}</style>
    </div>
  );
};

export default NotificationsBell;
