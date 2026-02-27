/**
 * Info Panel — Company history, contact info, office hours
 * Slides up from bottom as a full-screen overlay on mobile
 */

'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { FaTimes, FaEnvelope, FaClock, FaWhatsapp, FaRobot, FaBuilding, FaShieldAlt } from 'react-icons/fa';
import { HiSparkles } from 'react-icons/hi2';

interface InfoPanelProps {
  open: boolean;
  onClose: () => void;
}

const LISSA_WHATSAPP_NUMBER = '14155238886';
const LISSA_WHATSAPP_URL = `https://wa.me/${LISSA_WHATSAPP_NUMBER}?text=Hola%20Lissa%2C%20necesito%20ayuda`;

export default function InfoPanel({ open, onClose }: InfoPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="fixed inset-0 z-[60] md:hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div
        ref={panelRef}
        className="absolute inset-x-0 bottom-0 top-0 bg-white overflow-y-auto animate-slide-in-bottom"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-[#010139] to-[#020270] px-4 py-4 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center border border-white/30">
              <Image
                src="/logo_alternativo.png"
                alt="LISSA"
                width={28}
                height={28}
                className="object-contain"
                unoptimized
              />
            </div>
            <div>
              <h2 className="text-white font-bold text-base">Líderes en Seguros</h2>
              <p className="text-gray-300 text-xs">Información de la empresa</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center active:scale-90 transition-all"
            aria-label="Cerrar"
          >
            <FaTimes className="text-white text-sm" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-6 pb-32 space-y-6">

          {/* Historia */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-[#010139]/10 flex items-center justify-center">
                <FaBuilding className="text-[#010139] text-sm" />
              </div>
              <h3 className="text-lg font-bold text-[#010139]">Historia de LISSA</h3>
            </div>

            <div className="space-y-3 text-sm text-gray-700 leading-relaxed">
              <p>
                <strong className="text-[#010139]">LIDERES EN SEGUROS, S.A. (LISSA)</strong>, es una empresa de corretaje de seguros fundada en mayo de 2003. Creada primero como una agencia de ventas de seguros de vida dentro de ALICO Panamá (Empresa del grupo AIG). A los pocos meses de ser creada y por la imperante necesidad de satisfacer los requerimientos de nuestros clientes, LIDERES EN SEGUROS se abre al mercado como un Broker de seguros completamente independiente, logrando una total libertad para asesorarles libremente, dándonos así, la flexibilidad para cotizar los mejores planes de seguros existentes en la plaza, que cumplan con los requisitos necesarios para garantizar a nuestros asegurados la mayor protección posible dentro de sus presupuestos.
              </p>

              <p>
                Actualmente LIDERES EN SEGUROS tiene códigos y somete negocios de seguros con todas las aseguradoras domiciliadas en Panamá y mantiene contactos con aseguradoras domiciliadas en los Estados Unidos. En la actualidad, las aseguradoras con las que se tienen la mayor relación y producción son: <strong>ASSA Compañía de Seguros</strong> (Líderes está dentro de sus 10 corredores más destacados); <strong>Interoceánica de Seguros</strong> (ahora conocida como SURA, Empresa del Grupo Suramericana); <strong>Aseguradora Ancón</strong>; <strong>Banesco Seguros</strong> y <strong>Seguros Fedpa</strong>.
              </p>

              <p>
                El fundador y actual Gerente General de LIDERES EN SEGUROS, el <strong>Lic. Dídimo Samudio</strong>, cuenta con más de 30 años de experiencia en los seguros en Panamá, ha tenido bajo su responsabilidad la formación de corredores, la creación de agencias de corretaje, el desarrollo de nuevos productos y el mercadeo y ventas dentro de diversas Compañías de Seguros. Se destacan: Alico Panamá, Compañía Internacional de Seguros y Assicurazioni Generali. Dentro de Generali fue, además, uno de los responsables en 1998, de la reintroducción del ramo de vida individual en Generali Perú, Empresa del Grupo Generali que no contaba con este ramo desde los años 60.
              </p>

              <p>
                LIDERES EN SEGUROS cuenta con asesores legales y fiscales que le confieren una fortaleza y valor agregado adicional para todos sus clientes, ya que, sin aumentar los costos de sus seguros, se les asesora sobre las implicaciones y beneficios legales y fiscales de sus pólizas, ayudándoles a reducir costes e impuestos y brinda orientación sobre jurisprudencia en caso de reclamos.
              </p>

              <p>
                Con poco más de 20 años de operación y más de seis millones de dólares en primas ya LIDERES EN SEGUROS, es identificada como una empresa de corretaje sólida en todos los ramos, formada por personas integras y profesionales que destacan por el servicio personal a todos sus clientes.
              </p>
            </div>
          </section>

          {/* Divider */}
          <div className="border-t border-gray-200" />

          {/* Estamos a su disposición */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-[#8AAA19]/10 flex items-center justify-center">
                <FaShieldAlt className="text-[#8AAA19] text-sm" />
              </div>
              <h3 className="text-lg font-bold text-[#010139]">Estamos a su disposición</h3>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">
              Nuestro equipo y <strong className="text-[#8AAA19]">Lissa</strong>, nuestra IA, están para atender cualquier duda o inquietud que mantenga con lo que necesite. Lissa está altamente capacitada para orientarle con lo que requiera.
            </p>
          </section>

          {/* Contact Cards */}
          <div className="space-y-3">
            {/* Email */}
            <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3 border border-gray-100">
              <div className="w-10 h-10 rounded-full bg-[#010139]/10 flex items-center justify-center flex-shrink-0">
                <FaEnvelope className="text-[#010139] text-sm" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Correo electrónico</p>
                <a href="mailto:contacto@lideresenseguros.com" className="text-sm font-semibold text-[#010139] underline">
                  contacto@lideresenseguros.com
                </a>
              </div>
            </div>

            {/* Office Hours */}
            <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3 border border-gray-100">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <FaClock className="text-orange-500 text-sm" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Horario de oficina</p>
                <p className="text-sm font-semibold text-[#010139]">Lunes a Viernes, 9:00 AM – 5:00 PM</p>
              </div>
            </div>

            {/* Lissa 24/7 */}
            <div className="bg-gradient-to-r from-[#8AAA19]/10 to-[#8AAA19]/5 rounded-xl p-4 flex items-center gap-3 border border-[#8AAA19]/20">
              <div className="w-10 h-10 rounded-full bg-[#8AAA19]/20 flex items-center justify-center flex-shrink-0">
                <HiSparkles className="text-[#8AAA19] text-lg" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Atención de Lissa (IA)</p>
                <p className="text-sm font-bold text-[#8AAA19]">24/7 todos los días, incluyendo feriados</p>
              </div>
            </div>
          </div>

          {/* WhatsApp CTA */}
          <a
            href={LISSA_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 w-full py-4 px-6 bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white font-bold rounded-2xl shadow-lg active:scale-95 transition-all"
          >
            <FaWhatsapp className="text-white text-xl" />
            <span className="text-base">Ir al WhatsApp de Lissa</span>
          </a>

          {/* Footer note */}
          <p className="text-center text-xs text-gray-400 pt-2">
            © {new Date().getFullYear()} Líderes en Seguros, S.A. — Todos los derechos reservados
          </p>
        </div>
      </div>
    </div>
  );
}
