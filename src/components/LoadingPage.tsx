'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

interface LoadingPageProps {
  isLoading?: boolean;
  onComplete?: () => void;
}

export default function LoadingPage({ isLoading = true, onComplete }: LoadingPageProps) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      // Iniciar fade out
      setFadeOut(true);
      // Llamar onComplete después de la animación
      const timer = setTimeout(() => {
        onComplete?.();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, onComplete]);

  return (
    <div 
      className={`fixed inset-0 bg-white flex items-center justify-center z-[9999] transition-opacity duration-500 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
      style={{
        animation: fadeOut ? 'none' : 'fadeIn 500ms ease-in-out'
      }}
    >
      <div className="relative w-32 h-32 md:w-48 md:h-48 animate-pulse-bounce">
        <Image
          src="/emblema.png"
          alt="Cargando..."
          fill
          className="object-contain"
          priority
        />
      </div>
      
      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        @keyframes pulse-bounce {
          0%, 100% {
            transform: scale(1) translateY(0);
            opacity: 1;
          }
          25% {
            transform: scale(1.05) translateY(-8px);
            opacity: 0.9;
          }
          50% {
            transform: scale(1.1) translateY(-15px);
            opacity: 0.85;
          }
          75% {
            transform: scale(1.05) translateY(-8px);
            opacity: 0.9;
          }
        }
        
        .animate-pulse-bounce {
          animation: pulse-bounce 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
