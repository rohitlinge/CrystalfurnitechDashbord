interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: 'h-8',
  md: 'h-10',
  lg: 'h-14',
};

export default function BrandLogo({ size = 'md', className = '' }: BrandLogoProps) {
  return (
    <div className={`cf-logo-wrap inline-flex items-center justify-center shrink-0 ${className}`}>
      <img
        src="/crystal-furnitech-logo.webp"
        alt="Crystal Furnitech"
        className={`${sizes[size]} w-auto object-contain`}
      />
    </div>
  );
}
