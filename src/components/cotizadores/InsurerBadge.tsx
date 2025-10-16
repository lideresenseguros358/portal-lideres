/**
 * Badge de Aseguradora con logo + nombre
 */

'use client';

import Image from 'next/image';

interface InsurerBadgeProps {
  name: string;
  logoUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
}

export default function InsurerBadge({ 
  name, 
  logoUrl, 
  size = 'md', 
  showName = true 
}: InsurerBadgeProps) {
  const sizes = {
    sm: { img: 24, text: 'text-xs' },
    md: { img: 32, text: 'text-sm' },
    lg: { img: 48, text: 'text-base' }
  };

  const config = sizes[size];

  return (
    <div className="flex items-center gap-2">
      {logoUrl ? (
        <div 
          className="rounded-lg bg-white border border-gray-200 flex items-center justify-center p-1"
          style={{ 
            width: config.img + 8, 
            height: config.img + 8 
          }}
        >
          <Image
            src={logoUrl}
            alt={name}
            width={config.img}
            height={config.img}
            className="object-contain"
            unoptimized
          />
        </div>
      ) : (
        <div
          className="rounded-lg bg-gradient-to-br from-[#010139] to-[#8AAA19] flex items-center justify-center text-white font-bold"
          style={{ 
            width: config.img + 8, 
            height: config.img + 8,
            fontSize: Math.floor(config.img * 0.5)
          }}
        >
          {name.charAt(0)}
        </div>
      )}
      
      {showName && (
        <span className={`${config.text} font-semibold text-gray-800`}>
          {name}
        </span>
      )}
    </div>
  );
}
