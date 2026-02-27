/**
 * Lissa Chat Widget — Embedded WhatsApp Web chat within the portal
 * Opens as a full-screen iframe overlay on mobile, stays internal
 */

'use client';

import { useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';
import { HiSparkles } from 'react-icons/hi2';

interface LissaChatWidgetProps {
  open: boolean;
  onClose: () => void;
}

const LISSA_WHATSAPP_NUMBER = '14155238886';

export default function LissaChatWidget({ open, onClose }: LissaChatWidgetProps) {
  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  // Use WhatsApp Web API embedded URL
  const chatUrl = `https://web.whatsapp.com/send?phone=${LISSA_WHATSAPP_NUMBER}&text=Hola%20Lissa%2C%20necesito%20ayuda`;
  // For mobile devices, use the api.whatsapp.com which opens in-app or web
  const mobileChatUrl = `https://api.whatsapp.com/send?phone=${LISSA_WHATSAPP_NUMBER}&text=Hola%20Lissa%2C%20necesito%20ayuda`;

  return (
    <div className="fixed inset-0 z-[70] md:hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Chat Container */}
      <div className="absolute inset-x-0 top-0 bottom-0 flex flex-col bg-white animate-slide-in-bottom">
        {/* Chat Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-[#25D366] to-[#128C7E] px-4 py-3 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center border-2 border-white/40">
              <HiSparkles className="text-white text-lg" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm">Lissa</h3>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-300 animate-pulse" />
                <span className="text-white/80 text-xs">En línea 24/7</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center active:scale-90 transition-all"
            aria-label="Cerrar chat"
          >
            <FaTimes className="text-white text-sm" />
          </button>
        </div>

        {/* Chat Body */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 bg-[#ECE5DD]">
          {/* Decorative chat pattern */}
          <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23000000\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />

          <div className="relative z-10 flex flex-col items-center text-center max-w-xs">
            {/* Lissa Avatar */}
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#25D366] to-[#128C7E] flex items-center justify-center shadow-xl mb-4 border-4 border-white">
              <HiSparkles className="text-white text-3xl" />
            </div>

            {/* Welcome bubble */}
            <div className="bg-white rounded-2xl rounded-tl-sm px-5 py-4 shadow-md mb-6 max-w-[280px]">
              <p className="text-sm text-gray-800 leading-relaxed">
                ¡Hola! Soy <strong className="text-[#25D366]">Lissa</strong>, tu asistente virtual de Líderes en Seguros. Estoy disponible <strong>24/7</strong> para ayudarte con cualquier consulta sobre seguros.
              </p>
              <p className="text-[10px] text-gray-400 text-right mt-2">Ahora</p>
            </div>

            <p className="text-xs text-gray-600 mb-5">
              Al tocar el botón serás conectado directamente con Lissa vía WhatsApp dentro de tu dispositivo.
            </p>

            {/* Open WhatsApp Button */}
            <a
              href={mobileChatUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-4 px-6 bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white font-bold rounded-2xl shadow-lg active:scale-95 transition-all"
            >
              <svg viewBox="0 0 32 32" className="w-5 h-5 fill-white flex-shrink-0">
                <path d="M16 3C8.832 3 3 8.832 3 16c0 2.293.6 4.438 1.637 6.313L3 29l6.938-1.605A12.93 12.93 0 0 0 16 29c7.168 0 13-5.832 13-13S23.168 3 16 3zm0 2c6.087 0 11 4.913 11 11s-4.913 11-11 11a10.95 10.95 0 0 1-5.313-1.375l-.375-.219-4.094.95.98-3.907-.25-.406A10.93 10.93 0 0 1 5 16c0-6.087 4.913-11 11-11zm-3.5 6a1.22 1.22 0 0 0-.875.438c-.238.28-.938 1.03-.938 2.468s.97 2.875 1.094 3.063c.125.187 1.875 3.062 4.594 4.156.55.222.979.356 1.313.456.55.175 1.05.15 1.45.094.443-.069 1.343-.55 1.531-1.082.188-.53.188-.98.125-1.074-.063-.094-.219-.156-.469-.281-.25-.125-1.468-.719-1.688-.8-.218-.083-.406-.094-.562.155-.156.25-.656.782-.813.97-.156.186-.312.217-.562.092-.25-.125-1.05-.387-2.003-1.237-.738-.661-1.238-1.476-1.388-1.726-.148-.25-.017-.383.114-.508.117-.113.25-.281.375-.438.125-.156.175-.25.262-.437.088-.188.038-.344-.025-.469-.062-.125-.562-1.356-.769-1.856-.2-.488-.406-.419-.562-.425-.156-.006-.332-.013-.5-.013z" />
              </svg>
              <span>Iniciar chat con Lissa</span>
            </a>

            {/* Note */}
            <p className="text-[10px] text-gray-400 mt-4 leading-relaxed">
              La conversación se abrirá en WhatsApp dentro de tu dispositivo.
              <br />Lissa responde al instante, todos los días, incluyendo feriados.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
