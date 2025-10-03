'use client';

import Image from 'next/image';

export default function LoadingPage() {
  return (
    <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
      <div className="relative w-32 h-32 md:w-48 md:h-48 animate-bounce-subtle">
        <Image
          src="/emblema.png"
          alt="Loading..."
          fill
          className="object-contain"
          priority
        />
      </div>
      <style jsx global>{`
        @keyframes bounce-subtle {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
