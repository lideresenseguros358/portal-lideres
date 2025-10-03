'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FaArrowLeft } from 'react-icons/fa6';
import type { ReactNode } from 'react';

interface AuthShellProps {
  children: ReactNode;
  description?: string;
  backHref?: string;
}

const AuthShell = ({ children, description = 'Ingrese su usuario y contraseña', backHref }: AuthShellProps) => {
  const currentYear = new Date().getFullYear();

  return (
    <div className="auth-shell">
      <header className="auth-header">
        <div className="auth-logo-wrapper">
          <Link href="/">
            <Image src="/logo.png" alt="Líderes en Seguros" width={120} height={32} priority />
          </Link>
        </div>
      </header>

      <main className="auth-main">
        <div className="auth-card">
          {backHref ? (
            <Link href={backHref} className="auth-back">
              <FaArrowLeft />
              <span>Volver</span>
            </Link>
          ) : null}

          <h1 className="auth-title">Portal Virtual</h1>
          <h2 className="auth-subtitle">Corredores</h2>
          {description ? <p className="auth-description">{description}</p> : null}

          <div className="auth-content">{children}</div>
        </div>
      </main>

      <footer className="auth-footer">
        <p className="auth-footer-line">
          Regulado y Supervisado por la Superintendencia de Seguros y Reaseguros de Panamá - Licencia PJ750
        </p>
        <p className="auth-footer-line small">
          Desarrollado por Líderes en Seguros | Todos los derechos reservados ({currentYear})
        </p>
      </footer>

      <style jsx>{`
        .auth-shell {
          position: relative;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          color: #2e3131;
          overflow: hidden;
        }

        .auth-shell::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image: linear-gradient(rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0.35)),
            image-set(url('/fondo_login.webp') type('image/webp'), url('/fondo_login.jpg') type('image/jpeg'));
          background-size: cover;
          background-position: center;
          z-index: 0;
        }

        .auth-header {
          position: sticky;
          top: 0;
          left: 0;
          right: 0;
          z-index: 10;
          background-color: #ffffff;
          padding: 12px 32px;
          display: flex;
          justify-content: flex-start;
          align-items: center;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
        }

        .auth-logo-wrapper {
          display: flex;
          align-items: center;
          justify-content: flex-start;
        }

        .auth-main {
          position: relative;
          z-index: 1;
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 16px 48px;
        }

        .auth-card {
          width: 100%;
          max-width: 520px;
          background-color: #ffffff;
          border-radius: 22px;
          padding: 36px;
          box-shadow: 0 12px 28px rgba(1, 1, 57, 0.12);
          backdrop-filter: blur(6px);
        }

        .auth-back {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #8aaa19;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 18px;
          text-decoration: none;
          transition: transform 0.2s ease, color 0.2s ease;
        }

        .auth-back:hover {
          color: #6f8815;
          transform: translateX(-2px);
        }

        .auth-title {
          margin: 0;
          font-size: 26px;
          color: #8aaa19;
          font-weight: 700;
          letter-spacing: 0.4px;
          text-align: center;
        }

        .auth-subtitle {
          margin: 6px 0 18px;
          font-size: 18px;
          color: #2e3131;
          font-weight: 600;
          text-align: center;
        }

        .auth-description {
          font-size: 13px;
          color: #6d6d6d;
          margin-bottom: 24px;
          text-align: center;
        }

        .auth-content {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .auth-footer {
          position: sticky;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 10;
          background-color: #010139;
          text-align: center;
          padding: 16px 16px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-height: 60px;
          justify-content: center;
        }

        .auth-footer-line {
          margin: 0;
          color: #f1f2f6;
          font-size: 11px;
          line-height: 1.4;
        }

        .auth-footer-line.small {
          color: #dbe1ff;
          font-size: 10px;
        }

        @media (max-width: 480px) {
          .auth-card {
            max-width: 100%;
            padding: 28px 24px;
            border-radius: 18px;
          }

          .auth-header {
            padding: 16px;
          }
        }
      `}</style>

      <style jsx global>{`
        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .auth-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .auth-label {
          font-size: 13px;
          color: #6d6d6d;
          font-weight: 500;
        }

        .auth-input,
        .auth-textarea,
        .auth-select {
          width: 100%;
          border: 1px solid #8aaa19;
          border-radius: 10px;
          background-color: #ffffff;
          padding: 10px 12px;
          font-size: 14px;
          color: #2e3131;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .auth-input:focus,
        .auth-textarea:focus,
        .auth-select:focus {
          outline: none;
          border-color: #8aaa19;
          box-shadow: 0 0 0 3px rgba(138, 170, 25, 0.18);
        }

        .auth-primary-button {
          width: 100%;
          background-color: #010139;
          color: #ffffff;
          border: none;
          border-radius: 12px;
          padding: 12px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s ease, transform 0.2s ease;
        }

        .auth-primary-button:hover {
          background-color: #8aaa19;
          transform: scale(1.02);
        }

        .auth-primary-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .auth-link-button {
          background: transparent;
          border: none;
          color: #8aaa19;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          padding: 0;
          align-self: flex-start;
          transition: color 0.2s ease;
        }

        .auth-link-button:hover {
          color: #6f8815;
        }

        .auth-inline-links {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 10px;
          font-size: 13px;
        }

        .auth-inline-links a {
          color: #8aaa19;
          text-decoration: none;
          font-weight: 600;
          transition: color 0.2s ease;
        }

        .auth-inline-links a:hover {
          color: #6f8815;
        }

        .auth-section {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .auth-section + .auth-section {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid rgba(1, 1, 57, 0.08);
        }

        .auth-section-title {
          font-size: 16px;
          font-weight: 700;
          color: #010139;
          margin: 0;
        }

        .auth-section-subtitle {
          font-size: 13px;
          color: #8aaa19;
          font-weight: 600;
          margin: -6px 0 10px;
        }

        .auth-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        @media (max-width: 560px) {
          .auth-grid {
            grid-template-columns: 1fr;
          }
        }

        .auth-checkbox {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #2e3131;
        }

        .auth-checkbox input[type="checkbox"] {
          width: 16px;
          height: 16px;
          accent-color: #8aaa19;
        }

        .auth-message {
          border-radius: 10px;
          padding: 12px;
          font-size: 13px;
          line-height: 1.5;
        }

        .auth-message.success {
          background-color: rgba(138, 170, 25, 0.12);
          color: #4f6512;
          border: 1px solid rgba(138, 170, 25, 0.35);
        }

        .auth-message.error {
          background-color: rgba(220, 53, 69, 0.12);
          color: #962a36;
          border: 1px solid rgba(220, 53, 69, 0.35);
        }
      `}</style>
    </div>
  );
};

export default AuthShell;
