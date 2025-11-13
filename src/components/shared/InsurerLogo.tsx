import Image from 'next/image';

interface InsurerLogoProps {
  logoUrl?: string | null;
  insurerName: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24',
  '2xl': 'w-32 h-32',
  '3xl': 'w-40 h-40',
  '4xl': 'w-48 h-48',
};

const imageSizes = {
  sm: 32,
  md: 48,
  lg: 64,
  xl: 96,
  '2xl': 128,
  '3xl': 160,
  '4xl': 192,
};

export default function InsurerLogo({ 
  logoUrl, 
  insurerName, 
  size = 'md',
  className = ''
}: InsurerLogoProps) {
  const sizeClass = sizeClasses[size];
  const imageSize = imageSizes[size];

  return (
    <div 
      className={`
        ${sizeClass} 
        rounded-lg 
        bg-gradient-to-br from-[#010139] to-[#020270] 
        flex items-center justify-center 
        overflow-hidden
        flex-shrink-0
        shadow-md
        ${className}
      `}
      title={insurerName}
    >
      {logoUrl ? (
        <div className="w-full h-full p-2 flex items-center justify-center bg-gradient-to-br from-[#010139] to-[#020270]">
          <Image 
            src={logoUrl} 
            alt={insurerName}
            width={imageSize}
            height={imageSize}
            className="object-contain w-full h-full"
            style={{ 
              maxWidth: '100%',
              maxHeight: '100%',
            }}
            unoptimized
          />
        </div>
      ) : (
        <div className="text-white font-bold text-sm uppercase">
          {insurerName.split(' ').map(w => w.charAt(0)).join('').slice(0, 2)}
        </div>
      )}
    </div>
  );
}
