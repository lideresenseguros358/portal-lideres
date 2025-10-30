import Image from 'next/image';

interface InsurerLogoProps {
  logoUrl?: string | null;
  insurerName: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24',
};

const imageSizes = {
  sm: 32,
  md: 48,
  lg: 64,
  xl: 96,
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
        ${className}
      `}
      title={insurerName}
    >
      {logoUrl ? (
        <div className="w-full h-full p-1.5 flex items-center justify-center">
          <Image 
            src={logoUrl} 
            alt={insurerName}
            width={imageSize}
            height={imageSize}
            className="object-contain w-full h-full"
            style={{ 
              maxWidth: '100%',
              maxHeight: '100%',
              filter: 'brightness(1.1)' // Brighten slightly for better visibility
            }}
            unoptimized
          />
        </div>
      ) : (
        <div className="text-white font-bold text-sm">
          {insurerName.charAt(0)}
        </div>
      )}
    </div>
  );
}
