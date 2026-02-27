/**
 * Mobile Bottom Navigation Bar
 * Shows: Home | Cotizar (expandable) | Info
 * Only visible on mobile (md:hidden)
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { FaHome, FaCar, FaHeart, FaFire, FaCouch, FaTimes, FaInfoCircle } from 'react-icons/fa';
import { HiSparkles } from 'react-icons/hi2';
import InfoPanel from './InfoPanel';
import LissaChatWidget from './LissaChatWidget';

const COTIZADOR_OPTIONS = [
  { id: 'auto', label: 'Auto', icon: FaCar, href: '/cotizadores/auto', color: 'text-[#8AAA19]', bg: 'bg-green-50' },
  { id: 'vida', label: 'Vida', icon: FaHeart, href: '/cotizadores/vida', color: 'text-[#010139]', bg: 'bg-blue-50' },
  { id: 'incendio', label: 'Incendio', icon: FaFire, href: '/cotizadores/incendio', color: 'text-orange-500', bg: 'bg-orange-50' },
  { id: 'contenido', label: 'Hogar', icon: FaCouch, href: '/cotizadores/contenido', color: 'text-teal-500', bg: 'bg-teal-50' },
];

export default function MobileBottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [cotizarOpen, setCotizarOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close cotizar menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setCotizarOpen(false);
      }
    };
    if (cotizarOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [cotizarOpen]);

  // Close cotizar menu on route change
  useEffect(() => {
    setCotizarOpen(false);
  }, [pathname]);

  const isHome = pathname === '/cotizadores';

  return (
    <>
      {/* Lissa Chat Widget (embedded WhatsApp) */}
      <LissaChatWidget open={chatOpen} onClose={() => setChatOpen(false)} />

      {/* Info Panel */}
      <InfoPanel open={infoOpen} onClose={() => setInfoOpen(false)} />

      {/* Floating Lissa Chat Button — above bottom nav */}
      <button
        onClick={() => setChatOpen(true)}
        className="md:hidden fixed right-4 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-[#25D366] to-[#128C7E] shadow-lg flex items-center justify-center active:scale-90 transition-all hover:shadow-xl"
        style={{ bottom: 'calc(4.5rem + 12px)' }}
        aria-label="Chat con Lissa"
      >
        <div className="relative">
          <svg viewBox="0 0 32 32" className="w-7 h-7 fill-white">
            <path d="M16 3C8.832 3 3 8.832 3 16c0 2.293.6 4.438 1.637 6.313L3 29l6.938-1.605A12.93 12.93 0 0 0 16 29c7.168 0 13-5.832 13-13S23.168 3 16 3zm0 2c6.087 0 11 4.913 11 11s-4.913 11-11 11a10.95 10.95 0 0 1-5.313-1.375l-.375-.219-4.094.95.98-3.907-.25-.406A10.93 10.93 0 0 1 5 16c0-6.087 4.913-11 11-11zm-3.5 6a1.22 1.22 0 0 0-.875.438c-.238.28-.938 1.03-.938 2.468s.97 2.875 1.094 3.063c.125.187 1.875 3.062 4.594 4.156.55.222.979.356 1.313.456.55.175 1.05.15 1.45.094.443-.069 1.343-.55 1.531-1.082.188-.53.188-.98.125-1.074-.063-.094-.219-.156-.469-.281-.25-.125-1.468-.719-1.688-.8-.218-.083-.406-.094-.562.155-.156.25-.656.782-.813.97-.156.186-.312.217-.562.092-.25-.125-1.05-.387-2.003-1.237-.738-.661-1.238-1.476-1.388-1.726-.148-.25-.017-.383.114-.508.117-.113.25-.281.375-.438.125-.156.175-.25.262-.437.088-.188.038-.344-.025-.469-.062-.125-.562-1.356-.769-1.856-.2-.488-.406-.419-.562-.425-.156-.006-.332-.013-.5-.013z" />
          </svg>
          {/* Pulse indicator */}
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-white rounded-full border-2 border-[#25D366] flex items-center justify-center">
            <HiSparkles className="w-2 h-2 text-[#25D366]" />
          </span>
        </div>
      </button>

      {/* Cotizar Expandable Menu (fan-out above the center button) */}
      {cotizarOpen && (
        <div className="md:hidden fixed inset-0 z-50" ref={menuRef}>
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setCotizarOpen(false)}
          />

          {/* Fan menu */}
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 pb-4">
            {COTIZADOR_OPTIONS.map((opt, i) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  onClick={() => router.push(opt.href)}
                  className="flex items-center gap-3 px-5 py-3 bg-white rounded-2xl shadow-xl border border-gray-100 active:scale-95 transition-all animate-slide-up-fan"
                  style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'backwards' }}
                >
                  <div className={`w-10 h-10 rounded-xl ${opt.bg} flex items-center justify-center`}>
                    <Icon className={`text-lg ${opt.color}`} />
                  </div>
                  <span className="text-sm font-semibold text-[#010139] min-w-[70px] text-left">{opt.label}</span>
                </button>
              );
            })}
          </div>

          {/* Close button overlaying the Cotizar position */}
          <button
            onClick={() => setCotizarOpen(false)}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-red-500 text-white flex items-center justify-center shadow-xl z-10 active:scale-90 transition-all"
          >
            <FaTimes className="text-white text-lg" />
          </button>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-around h-[4.5rem] max-w-md mx-auto px-2">
          {/* Home */}
          <button
            onClick={() => router.push('/cotizadores')}
            className="flex flex-col items-center justify-center gap-1 flex-1 py-2 active:scale-90 transition-all"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isHome ? 'bg-[#010139]' : 'bg-gray-100'}`}>
              <FaHome className={`text-lg ${isHome ? 'text-white' : 'text-gray-500'}`} />
            </div>
            <span className={`text-[10px] font-semibold ${isHome ? 'text-[#010139]' : 'text-gray-500'}`}>Inicio</span>
          </button>

          {/* Cotizar (center, prominent) */}
          <button
            onClick={() => setCotizarOpen(!cotizarOpen)}
            className="flex flex-col items-center justify-center gap-1 flex-1 py-2 -mt-4 active:scale-90 transition-all"
          >
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#8AAA19] to-[#6d8814] flex items-center justify-center shadow-lg border-4 border-white">
              <HiSparkles className="text-white text-xl" />
            </div>
            <span className="text-[10px] font-bold text-[#8AAA19]">Cotizar</span>
          </button>

          {/* Info */}
          <button
            onClick={() => setInfoOpen(true)}
            className="flex flex-col items-center justify-center gap-1 flex-1 py-2 active:scale-90 transition-all"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${infoOpen ? 'bg-[#010139]' : 'bg-gray-100'}`}>
              <FaInfoCircle className={`text-lg ${infoOpen ? 'text-white' : 'text-gray-500'}`} />
            </div>
            <span className={`text-[10px] font-semibold ${infoOpen ? 'text-[#010139]' : 'text-gray-500'}`}>Info</span>
          </button>
        </div>

        {/* Safe area for iPhones */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>

      {/* Spacer so content is not hidden behind the bottom nav */}
      <div className="md:hidden h-[4.5rem]" />
    </>
  );
}
