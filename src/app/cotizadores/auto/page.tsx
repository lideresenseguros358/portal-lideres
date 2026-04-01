'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FaCar, FaShieldAlt } from 'react-icons/fa';
import Breadcrumb from '@/components/ui/Breadcrumb';

// ─────────────────────────────────────────────────────────────────────────────
// CSS (inline <style> injected once)
// ─────────────────────────────────────────────────────────────────────────────

const CAROUSEL_STYLES = `
/* ── Carousel wrapper ── */
.auto-carousel {
  display: flex;
  overflow-x: scroll;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  gap: 12px;
  padding: 6px 22px 14px;
}
.auto-carousel::-webkit-scrollbar { display: none; }

/* ── Card item ── */
.auto-carousel-item {
  flex-shrink: 0;
  scroll-snap-align: center;
  width: calc(83vw);
  max-width: 320px;
  transition: transform 0.35s cubic-bezier(.25,.46,.45,.94),
              opacity  0.35s ease;
  will-change: transform, opacity;
}
.auto-carousel-item.auto-active   { transform: scale(1);    opacity: 1;   }
.auto-carousel-item.auto-inactive { transform: scale(0.88); opacity: 0.58; }

/* ── Dot indicators ── */
.auto-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #d1d5db;
  transition: all 0.3s ease;
  flex-shrink: 0;
}
.auto-dot.auto-dot-active {
  background: #8AAA19;
  width: 20px;
  border-radius: 3px;
}

/* ── CTA button — CC shimmer ── */
@keyframes auto-cc-shine {
  0%        { background-position: -250% center; }
  45%, 100% { background-position:  300% center; }
}
@keyframes auto-cc-pop {
  0%, 72%, 100% { transform: scale(1);    box-shadow: 0 2px 8px  rgba(138,170,25,.35); }
  77%            { transform: scale(1.06); box-shadow: 0 0 0 6px  rgba(138,170,25,.18), 0 4px 18px rgba(138,170,25,.6); }
  83%            { transform: scale(0.97); box-shadow: 0 2px 6px  rgba(138,170,25,.30); }
  88%            { transform: scale(1.03); box-shadow: 0 0 0 3px  rgba(138,170,25,.12), 0 3px 12px rgba(138,170,25,.45); }
  93%            { transform: scale(1);    box-shadow: 0 2px 8px  rgba(138,170,25,.35); }
}
.auto-cc-btn-idle {
  background: linear-gradient(105deg,
    #6d8814 0%, #8AAA19 28%, #d6ec4a 46%, #c0d830 50%, #d6ec4a 54%, #8AAA19 72%, #6d8814 100%);
  background-size: 300% auto;
  animation: auto-cc-shine 2.8s ease-in-out infinite,
             auto-cc-pop   4.2s ease-in-out infinite;
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// Page Component
// ─────────────────────────────────────────────────────────────────────────────

export default function CotizarAutoPage() {
  const router = useRouter();
  const [minPriceDT, setMinPriceDT] = useState<number | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(true);

  // Carousel state
  const [activeIdx, setActiveIdx] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const nudgeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasScrolled = useRef(false);

  // Fetch min price for DT
  useEffect(() => {
    fetch('/api/quotes/third-party-min-price')
      .then(r => r.json())
      .then(d => { if (d.success && d.minPrice) setMinPriceDT(d.minPrice); })
      .catch(() => {})
      .finally(() => setLoadingPrice(false));
  }, []);

  // Scroll → active index detection
  const handleScroll = useCallback(() => {
    hasScrolled.current = true;
    const el = carouselRef.current;
    if (!el) return;
    const center = el.scrollLeft + el.clientWidth / 2;
    let closest = 0, minDist = Infinity;
    Array.from(el.children).forEach((child, i) => {
      const c = child as HTMLElement;
      const dist = Math.abs(c.offsetLeft + c.offsetWidth / 2 - center);
      if (dist < minDist) { minDist = dist; closest = i; }
    });
    setActiveIdx(closest);
  }, []);

  // Auto-nudge hint (double pulse once every 60s until user scrolls)
  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;

    const pulse = () => {
      if (hasScrolled.current) return;
      el.scrollTo({ left: 55, behavior: 'smooth' });
      setTimeout(() => el.scrollTo({ left: 0, behavior: 'smooth' }), 550);
    };

    // Initial pulse after 1.2s
    const init = setTimeout(pulse, 1200);
    nudgeRef.current = setInterval(pulse, 60_000);

    return () => {
      clearTimeout(init);
      if (nudgeRef.current) clearInterval(nudgeRef.current);
    };
  }, []);

  const goTo = (idx: number) => {
    const el = carouselRef.current;
    if (!el) return;
    const child = el.children[idx] as HTMLElement | undefined;
    if (!child) return;
    const targetLeft = child.offsetLeft - (el.clientWidth - child.offsetWidth) / 2;
    el.scrollTo({ left: targetLeft, behavior: 'smooth' });
  };

  const handleSelect = (type: 'third-party' | 'full-coverage') => {
    if (type === 'third-party') router.push('/cotizadores/third-party');
    else router.push('/cotizadores/auto/completa');
  };

  const priceLabel = loadingPrice ? 'Cargando...' : minPriceDT ? `Desde B/.${minPriceDT}/año` : 'Desde B/.115/año';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-6 px-4">
      {/* Inject carousel styles once */}
      <style dangerouslySetInnerHTML={{ __html: CAROUSEL_STYLES }} />

      <div className="max-w-6xl mx-auto">
        {/* Breadcrumb */}
        <div className="mb-5">
          <Breadcrumb items={[{ label: 'Auto', icon: <FaCar /> }]} />
        </div>

        {/* Header */}
        <div className="mb-6 text-center">
          <div
            data-reveal="scale"
            className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 bg-gradient-to-r from-[#010139] to-[#020270] rounded-full mb-3"
          >
            <FaCar className="text-white text-3xl md:text-4xl" />
          </div>
          <h1
            data-reveal="down"
            data-delay="80"
            className="text-3xl md:text-5xl font-bold text-[#010139] mb-2"
          >
            Seguro de Auto
          </h1>
          <p
            data-reveal="fade"
            data-delay="160"
            className="text-base md:text-xl text-gray-600"
          >
            Selecciona el tipo de cobertura que necesitas
          </p>
        </div>

        {/* ── MOBILE CAROUSEL ── */}
        <div data-reveal="up" data-delay="220" className="md:hidden -mx-4">
          <div
            ref={carouselRef}
            className="auto-carousel"
            onScroll={handleScroll}
          >
            {/* ── Card 1: Daños a Terceros ── */}
            <div
              className={`auto-carousel-item ${activeIdx === 0 ? 'auto-active' : 'auto-inactive'} bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden cursor-pointer`}
              onClick={() => activeIdx === 0 ? handleSelect('third-party') : goTo(0)}
            >
              {/* Header */}
              <div className="bg-gradient-to-br from-[#010139] to-[#020270] px-5 py-5 text-white">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-11 h-11 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <FaShieldAlt className="text-xl" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold leading-tight">Daños a Terceros</h2>
                    <p className="text-[11px] text-blue-200">Cobertura legal obligatoria</p>
                  </div>
                </div>
                <div className="mt-2 inline-flex items-center gap-1.5 bg-white/15 rounded-lg px-3 py-1.5">
                  <span className="text-[10px] font-semibold text-blue-100 uppercase tracking-wide">Precio</span>
                  <span className="text-base font-bold">{priceLabel}</span>
                </div>
              </div>

              {/* Body */}
              <div className="px-4 py-4">
                <ul className="space-y-2.5 mb-4">
                  {[
                    { title: 'Emisión inmediata', sub: 'Sin inspección del vehículo' },
                    { title: 'Compara aseguradoras', sub: 'Múltiples opciones y tarifas' },
                    { title: 'Planes básico y premium', sub: 'Elige la cobertura ideal' },
                  ].map(({ title, sub }) => (
                    <li key={title} className="flex items-start gap-2.5">
                      <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-green-600 text-[10px] font-bold">✓</span>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{title}</div>
                        <div className="text-[11px] text-gray-500">{sub}</div>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="bg-gradient-to-r from-blue-50 to-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 mb-4">
                  <p className="text-[10px] font-bold text-[#010139] mb-1 uppercase tracking-wide">Incluye</p>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                    {['Resp. civil', 'Daños corporales', 'Gastos médicos', 'Asist. en carretera*'].map(item => (
                      <span key={item} className="text-[11px] text-gray-600">• {item}</span>
                    ))}
                  </div>
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); handleSelect('third-party'); }}
                  className="cot-touch-btn w-full bg-gradient-to-r from-[#010139] to-[#020270] text-white py-3 rounded-xl font-bold text-sm shadow-md active:scale-95 transition-transform"
                >
                  Ver Planes y Tarifas →
                </button>
              </div>
            </div>

            {/* ── Card 2: Cobertura Completa ── */}
            <div
              className={`auto-carousel-item ${activeIdx === 1 ? 'auto-active' : 'auto-inactive'} bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden cursor-pointer`}
              onClick={() => activeIdx === 1 ? handleSelect('full-coverage') : goTo(1)}
            >
              {/* Header */}
              <div className="bg-gradient-to-br from-[#8AAA19] to-[#6d8814] px-5 py-5 text-white">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-11 h-11 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <FaCar className="text-xl" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold leading-tight">Cobertura Completa</h2>
                    <p className="text-[11px] text-green-100">Protección total para tu vehículo</p>
                  </div>
                </div>
                <div className="mt-2 inline-flex items-center gap-1.5 bg-white/15 rounded-lg px-3 py-1.5">
                  <span className="text-[10px] font-semibold text-green-100 uppercase tracking-wide">Recomendado</span>
                  <span className="text-base font-bold">⭐ Top cobertura</span>
                </div>
              </div>

              {/* Body */}
              <div className="px-4 py-4">
                <ul className="space-y-2.5 mb-4">
                  {[
                    { title: 'Cobertura amplia', sub: 'Daños propios y de terceros' },
                    { title: 'Robo e incendio', sub: 'Protección contra pérdida total' },
                    { title: 'Asistencia completa', sub: 'Grúa, cerrajería, taxi y más' },
                  ].map(({ title, sub }) => (
                    <li key={title} className="flex items-start gap-2.5">
                      <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-green-600 text-[10px] font-bold">✓</span>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{title}</div>
                        <div className="text-[11px] text-gray-500">{sub}</div>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-xl px-3 py-2.5 mb-4">
                  <p className="text-[10px] font-bold text-[#010139] mb-1 uppercase tracking-wide">Incluye</p>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                    {['Todo DT +', 'Daños propios', 'Robo total/parcial', 'Desastres naturales'].map(item => (
                      <span key={item} className="text-[11px] text-gray-600">• {item}</span>
                    ))}
                  </div>
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); handleSelect('full-coverage'); }}
                  className={`cot-touch-btn w-full text-white py-3 rounded-xl font-bold text-sm shadow-md active:scale-95 transition-transform ${
                    activeIdx === 1 ? 'auto-cc-btn-idle' : 'bg-gradient-to-r from-[#8AAA19] to-[#6d8814]'
                  }`}
                >
                  Cotizar Ahora →
                </button>
              </div>
            </div>
          </div>

          {/* Dot indicators */}
          <div className="flex items-center justify-center gap-2 mt-2 mb-1">
            {[0, 1].map(i => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`auto-dot ${activeIdx === i ? 'auto-dot-active' : ''}`}
                aria-label={i === 0 ? 'Daños a Terceros' : 'Cobertura Completa'}
              />
            ))}
          </div>

          {/* Label hint */}
          <p className="text-center text-[11px] text-gray-400 mt-1 mb-2">
            {activeIdx === 0 ? 'Desliza para ver Cobertura Completa →' : '← Daños a Terceros'}
          </p>
        </div>

        {/* ── DESKTOP GRID (unchanged) ── */}
        <div className="hidden md:grid grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Daños a Terceros */}
          <div
            onClick={() => handleSelect('third-party')}
            className="group bg-white rounded-2xl shadow-lg border-2 border-gray-100 hover:border-[#8AAA19] hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden"
          >
            <div className="bg-gradient-to-br from-[#010139] to-[#020270] p-8 text-white">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <FaShieldAlt className="text-3xl" />
              </div>
              <h2 className="text-3xl font-bold mb-2">Daños a Terceros</h2>
              <p className="text-gray-300">Cobertura legal obligatoria</p>
            </div>
            <div className="p-8">
              <div className="space-y-4 mb-6">
                {[
                  { title: 'Emisión inmediata', sub: 'Sin inspección del vehículo' },
                  { title: 'Compara aseguradoras', sub: 'Múltiples opciones con logos y tarifas' },
                  { title: priceLabel, sub: 'Planes básicos y premium disponibles' },
                ].map(({ title, sub }) => (
                  <div key={title} className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-green-600 text-sm">✓</span>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{title}</div>
                      <div className="text-sm text-gray-600">{sub}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-gradient-to-r from-blue-50 to-gray-50 border-2 border-gray-200 rounded-xl p-4 mb-6">
                <div className="font-bold text-[#010139] mb-2">Incluye:</div>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Responsabilidad civil</li>
                  <li>• Daños corporales y materiales</li>
                  <li>• Gastos médicos</li>
                  <li>• Asistencia en carretera (según plan)</li>
                </ul>
              </div>
              <button className="w-full bg-gradient-to-r from-[#010139] to-[#020270] hover:from-[#020270] hover:to-[#010139] text-white py-4 rounded-xl font-bold text-lg transition-all shadow-md hover:shadow-lg group-hover:scale-105">
                Ver Planes y Tarifas →
              </button>
            </div>
          </div>

          {/* Cobertura Completa */}
          <div
            onClick={() => handleSelect('full-coverage')}
            className="group bg-white rounded-2xl shadow-lg border-2 border-gray-100 hover:border-[#8AAA19] hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden"
          >
            <div className="bg-gradient-to-br from-[#8AAA19] to-[#6d8814] p-8 text-white">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <FaCar className="text-3xl" />
              </div>
              <h2 className="text-3xl font-bold mb-2">Cobertura Completa</h2>
              <p className="text-green-100">Protección total para tu vehículo</p>
            </div>
            <div className="p-8">
              <div className="space-y-4 mb-6">
                {[
                  { title: 'Cobertura amplia', sub: 'Daños propios y de terceros' },
                  { title: 'Robo e incendio', sub: 'Protección contra pérdida total' },
                  { title: 'Asistencia completa', sub: 'Grúa, cerrajería, taxi y más' },
                ].map(({ title, sub }) => (
                  <div key={title} className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-green-600 text-sm">✓</span>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{title}</div>
                      <div className="text-sm text-gray-600">{sub}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-200 rounded-xl p-4 mb-6">
                <div className="font-bold text-[#010139] mb-2">Incluye:</div>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Todo lo de daños a terceros</li>
                  <li>• Daños propios al vehículo</li>
                  <li>• Robo total y parcial</li>
                  <li>• Desastres naturales</li>
                </ul>
              </div>
              <button className="w-full bg-gradient-to-r from-[#8AAA19] to-[#6d8814] hover:from-[#6d8814] hover:to-[#5a7010] text-white py-4 rounded-xl font-bold text-lg transition-all shadow-md hover:shadow-lg group-hover:scale-105">
                Cotizar Ahora →
              </button>
            </div>
          </div>
        </div>

        {/* Info Footer */}
        <div data-reveal="up" className="mt-8 md:mt-12 max-w-4xl mx-auto bg-white rounded-xl shadow-lg border-2 border-gray-100 p-5 md:p-8">
          <div className="flex items-start gap-3 md:gap-4">
            <div className="text-4xl md:text-5xl">💡</div>
            <div>
              <h3 className="text-xl md:text-2xl font-bold text-[#010139] mb-3">¿Cuál es la diferencia?</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <div className="font-bold text-[#010139] mb-1">Daños a Terceros</div>
                  <p className="text-sm text-gray-700">
                    Cubre los daños que <strong>tu vehículo cause a otros</strong>. Es el seguro
                    mínimo legal obligatorio en Panamá. Ideal si tu auto es antiguo o de bajo
                    valor y solo necesitas cumplir con la ley.
                  </p>
                </div>
                <div>
                  <div className="font-bold text-[#8AAA19] mb-1">Cobertura Completa</div>
                  <p className="text-sm text-gray-700">
                    Cubre daños a terceros <strong>y también a tu propio vehículo</strong>,
                    incluyendo robo, incendio, desastres naturales y más. Recomendado para autos
                    nuevos o de mayor valor.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
