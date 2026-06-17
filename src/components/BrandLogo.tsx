interface BrandLogoProps {
  variant?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  subtitle?: string;
  className?: string;
}

const sizes = {
  sm: 'h-8',
  md: 'h-10',
  lg: 'h-14',
};

export default function BrandLogo({
  variant = 'dark',
  size = 'md',
  showText = true,
  subtitle,
  className = '',
}: BrandLogoProps) {
  const textColor = variant === 'light' ? 'text-white' : 'text-black';
  const subColor = variant === 'light' ? 'text-[#d4af37]/80' : 'text-neutral-500';

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img
        src="/crystal-furnitech-logo.webp"
        alt="Crystal Furnitech"
        className={`${sizes[size]} w-auto object-contain shrink-0`}
      />
      {showText && (
        <div className="min-w-0">
          <p className={`font-serif italic text-base sm:text-lg font-semibold leading-tight ${textColor}`}>
            Crystal Furnitech
          </p>
          {subtitle && (
            <p className={`text-[10px] font-semibold uppercase tracking-widest ${subColor}`}>{subtitle}</p>
          )}
        </div>
      )}
    </div>
  );
}
