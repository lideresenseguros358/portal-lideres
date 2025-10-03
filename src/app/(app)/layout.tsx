import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { FaBars, FaBell } from "react-icons/fa";
import SideMenu from "@/components/shell/SideMenu";
import NotificationsBell from "@/components/shell/NotificationsBell";
import AccountMenu from "@/components/shell/AccountMenu";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await getSupabaseServer();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect("/login");
  }

  // Get profile with role
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<ProfileRow>();

  // If no profile exists, redirect to login to retry
  if (!profile) {
    redirect("/login");
  }

  const role = profile.role === "master" ? "MASTER" : "BROKER";
  const displayName = profile.full_name || user.email || "Usuario";

  return (
    <>
      {/* Mobile menu toggle (hidden checkbox) */}
      <input type="checkbox" id="app-sidemenu-toggle" className="sidemenu-toggle" />
      
      {/* Overlay for sidemenu with blur */}
      <label htmlFor="app-sidemenu-toggle" className="sidemenu-overlay"></label>
      
      {/* Main App Container */}
      <div className="app-container">
        {/* Fixed White Header */}
        <header className="app-header">
          {/* Hamburger Menu */}
          <label htmlFor="app-sidemenu-toggle" className="hamburger">
            <FaBars />
          </label>

          {/* Logo */}
          <Link href="/dashboard" className="logo-link">
            <Image
              src="/logo.png"
              alt="LISSA"
              width={80} // Adjusted width to make it smaller
              height={16} // Adjusted height to maintain aspect ratio
              priority
              className="logo"
            />
          </Link>

          {/* Right Actions */}
          <div className="header-actions">
            {/* Notifications Bell */}
            <NotificationsBell profileId={user.id} />
            
            {/* User Menu */}
            <AccountMenu displayName={displayName} role={role} avatarUrl={profile.avatar_url} />
          </div>
        </header>

        {/* Side Menu - slides over everything */}
        <SideMenu role={role} />
        
        {/* Main Content with proper margins */}
        <main className="app-main">
          <div className="content-container">
            {children}
          </div>
        </main>
        
        {/* Blue Footer */}
        <footer className="app-footer">
          <div className="footer-content">
            <p className="footer-text">
              Regulado y Supervisado por la Superintendencia de Seguros y Reaseguros de Panamá
            </p>
            <p className="footer-text-secondary">
              © 2025 Desarrollado por Líderes en Seguros | Todos los derechos reservados
            </p>
          </div>
        </footer>
      </div>

      <style>{`
        /* Overlay with blur */
        .sidemenu-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.35);
          backdrop-filter: blur(4px);
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.3s ease, visibility 0.3s ease;
          z-index: 998;
        }
        
        .sidemenu-toggle:checked ~ .sidemenu-overlay {
          opacity: 1;
          visibility: visible;
        }
        
        /* When checkbox is checked, slide in the menu */
        .sidemenu-toggle:checked ~ .app-container .side-menu {
          transform: translateX(0) !important;
        }
        
        /* App Container */
        .app-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: linear-gradient(to bottom right, #f9fafb, #dbeafe, #f9fafb);
        }
        
        /* Header - White and Fixed */
        .app-header {
          position: sticky;
          top: 0;
          height: 64px;
          background: #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          display: flex;
          align-items: center;
          padding: 0 24px;
          z-index: 997;
        }
        
        .hamburger {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          color: #666;
          cursor: pointer;
          transition: transform 0.2s ease;
        }
        
        .hamburger:hover {
          transform: scale(1.1);
        }
        
        .logo-link {
          margin-left: 16px;
        }
        
        .header-actions {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 12px; /* Reduced from 16px */
        }
        
        /* Main Content */
        .app-main {
          flex: 1;
          width: 100%;
          padding: 32px 24px;
          background: transparent;
        }
        
        .content-container {
          max-width: 1400px;
          margin: 0 auto;
        }
        
        /* Footer - Blue stripe */
        .app-footer {
          background: #010139; /* Blue background */
          padding: 24px 0;
          margin-top: auto;
        }
        
        .footer-content {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 24px;
          text-align: center;
        }
        
        .footer-text {
          color: #a9a9a9; /* Light grey text for dark background */
          font-size: 14px;
          margin: 0 0 8px 0;
        }
        .footer-text-secondary {
          color: #6c757d; /* Darker grey for secondary text */
          font-size: 12px;
          margin: 0;
        }
        
        .footer-link:hover {
          color: #8aaa19;
        }
        
        .footer-separator {
          color: #666;
          margin: 0 8px;
        }
        
        /* User Menu */
        .user-menu {
          position: relative;
        }

        .user-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          overflow: hidden;
          transition: transform 0.2s ease;
        }
        
        .user-avatar:hover {
          transform: scale(1.05);
        }
        
        .user-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .dropdown-menu {
          position: absolute;
          top: calc(100% + 12px);
          right: 0;
          background: white;
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
          min-width: 200px;
          opacity: 0;
          visibility: hidden;
          transform: translateY(-10px);
          transition: all 0.2s ease;
          z-index: 1000;
          pointer-events: none;
        }
        
        .account-menu .dropdown-menu.open {
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
          pointer-events: auto;
        }
        
        .user-name {
          display: flex;
          font-weight: 600;
          color: #010139;
          margin-bottom: 4px;
        }
        
        .user-role {
          display: flex;
          font-size: 12px;
          color: #8aaa19;
        }
        
        .dropdown-item, .dropdown-logout {
          display: flex;
          width: 100%;
          padding: 15px 55px;
          gap: 10px;
          color: #333;
          text-decoration: none;
          transition: background 0.2s ease;
          border: none;
          background: none;
          text-align: center;
          align-items: center;
          cursor: pointer;
        }
        
        .dropdown-item .icon,
        .dropdown-logout .icon {
          display: inline-flex;
          flex: 0 0 auto;
          font-size: 16px;
          line-height: 1;
        }
        
        .dropdown-item .label,
        .dropdown-logout .label {
          display: flex;
          white-space: nowrap;
          line-height: 1.2;
        }
        
        .dropdown-item:hover, .dropdown-logout:hover {
          background: #f8f9fa;
          color: #8aaa19;
        }
        
        /* Mobile Responsive */
        @media (max-width: 768px) {
          .app-header {
            padding: 0 16px;
          }
          
          .app-main {
            padding: 20px 16px;
          }
          
          .footer-content {
            flex-direction: column;
            gap: 12px;
            text-align: center;
          }
        }
        
        /* Hide checkbox toggles */
        .sidemenu-toggle {
          display: none;
        }
      `}</style>

      <style>{`
        body {
          background: linear-gradient(to bottom right, #f9fafb, #dbeafe, #f9fafb);
          margin: 0;
          font-family: Arial, sans-serif;
        }
      `}</style>
    </>
  );
};
