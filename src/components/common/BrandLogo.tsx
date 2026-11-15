import { useState } from 'react';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'light' | 'dark' | 'auto' | 'sidebar';
  showSubtitle?: boolean;
  useImage?: boolean;
}

const LOGO_SRC = '/images/logo/mon-tcfca-logo.png';
const LOGO_SIDEBAR_SRC = '/images/logo/mon-tcfca-logo-sidebar.png';

export default function BrandLogo({
  className,
  size = 'md',
  variant = 'auto',
  showSubtitle = false,
  useImage = true,
}: BrandLogoProps) {
  const [imgError, setImgError] = useState(false);

  const sizeMap = {
    xs: {
      img: 'h-8 w-auto',
      icon: 'w-7 h-7',
      title: 'text-base',
      subtitle: 'text-[9px]',
      gap: 'gap-2',
    },
    sm: {
      img: 'h-10 sm:h-12 w-auto',
      icon: 'w-9 h-9',
      title: 'text-lg',
      subtitle: 'text-[10px]',
      gap: 'gap-2.5',
    },
    md: {
      img: 'h-14 sm:h-16 md:h-18 w-auto',
      icon: 'w-14 h-14',
      title: 'text-2xl',
      subtitle: 'text-xs',
      gap: 'gap-3',
    },
    lg: {
      img: 'h-18 sm:h-22 md:h-24 w-auto',
      icon: 'w-18 h-18',
      title: 'text-3xl',
      subtitle: 'text-sm',
      gap: 'gap-3.5',
    },
    xl: {
      img: 'h-26 sm:h-32 md:h-40 w-auto',
      icon: 'w-24 h-24',
      title: 'text-4xl',
      subtitle: 'text-base',
      gap: 'gap-4',
    },
  };

  const currentSize = sizeMap[size];

  // If useImage is true and image loaded successfully, render the official logo
  if (useImage && !imgError) {
    if (variant === 'sidebar') {
      return (
        <div className={cn('inline-flex items-center gap-2 select-none', className)}>
          <img
            src={LOGO_SIDEBAR_SRC}
            alt="Mon TCF CA"
            className={cn(currentSize.img, 'object-contain drop-shadow-sm filter contrast-105 transition-transform duration-200 hover:scale-[1.02]')}
            onError={() => setImgError(true)}
          />
          {showSubtitle && size !== 'xs' && (
            <div className="flex flex-col leading-tight">
              <span className="text-[11px] text-white/90 uppercase font-heading font-semibold tracking-wider">
                Préparation Officielle
              </span>
            </div>
          )}
        </div>
      );
    }

    if (variant === 'light') {
      return (
        <div className={cn('inline-flex items-center gap-2 select-none', className)}>
          <img
            src={LOGO_SRC}
            alt="Mon TCF CA"
            className={cn(currentSize.img, 'object-contain drop-shadow-sm filter contrast-105')}
            onError={() => setImgError(true)}
          />
          {showSubtitle && size !== 'xs' && (
            <div className="flex flex-col leading-tight">
              <span className="text-[11px] text-white/80 uppercase font-heading font-semibold tracking-wider">
                Préparation Officielle
              </span>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className={cn('inline-flex items-center select-none', className)}>
        <img
          src={LOGO_SRC}
          alt="Mon TCF CA"
          className={cn(currentSize.img, 'object-contain drop-shadow-xs transition-transform duration-200 hover:scale-[1.02]')}
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  // Fallback Vector Emblem + Typography
  return (
    <div className={cn('inline-flex items-center select-none', currentSize.gap, className)}>
      {/* Emblem SVG (Maple leaf + Open Book + Student + Star) */}
      <div
        className={cn(
          'relative flex items-center justify-center shrink-0 rounded-xl shadow-sm transition-transform duration-200 hover:scale-105',
          currentSize.icon,
          variant === 'light'
            ? 'bg-white rounded-xl p-1 shadow-sm'
            : 'bg-white rounded-xl p-1 border border-[#e2e8f0] shadow-xs'
        )}
      >
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="Mon TCF CA"
        >
          <title>Mon TCF CA</title>
          {/* Canadian Maple Leaf in Red */}
          <path
            d="M50 8 L54 18 L62 16 L61 24 L70 25 L67 33 L76 37 L71 44 L77 49 L67 52 L65 60 L58 57 L54 66 L51 58 L50 68 L49 58 L46 66 L42 57 L35 60 L33 52 L23 49 L29 44 L24 37 L33 33 L30 25 L39 24 L38 16 L46 18 Z"
            fill="#d62828"
          />
          {/* Small Gold Star */}
          <polygon
            points="76,30 78,35 83,37 78,39 76,44 74,39 69,37 74,35"
            fill="#e9a820"
          />
          {/* Outstretched Person Head */}
          <circle cx="50" cy="46" r="6" fill={variant === 'sidebar' ? '#ffffff' : '#0d233a'} />
          {/* Outstretched Person Arms forming V */}
          <path
            d="M38 42 C44 48 48 54 50 64 C52 54 56 48 62 42 C56 50 53 58 50 72 C47 58 44 50 38 42 Z"
            fill={variant === 'sidebar' ? '#ffffff' : '#0d233a'}
          />
          {/* Open Book Wings in Navy/White */}
          <path
            d="M26 62 C34 60 43 64 49 74 C44 70 34 68 24 70 Z"
            fill={variant === 'sidebar' ? '#ffffff' : '#0d233a'}
          />
          <path
            d="M74 62 C66 60 57 64 51 74 C56 70 66 68 76 70 Z"
            fill={variant === 'sidebar' ? '#ffffff' : '#0d233a'}
          />
        </svg>
      </div>

      {/* Brand Text */}
      <div className="flex flex-col leading-none">
        <div className="flex items-center font-heading font-extrabold tracking-tight">
          <span
            className={cn(
              currentSize.title,
              variant === 'light' || variant === 'sidebar' ? 'text-white' : 'text-[#0d233a]'
            )}
          >
            Mon
          </span>
          <span className={cn(currentSize.title, 'text-[#d62828] mx-1')}>
            TCF
          </span>
          <span
            className={cn(
              currentSize.title,
              variant === 'light' || variant === 'sidebar' ? 'text-white' : 'text-[#0d233a]'
            )}
          >
            CA
          </span>
        </div>
        {showSubtitle && (
          <span
            className={cn(
              currentSize.subtitle,
              'font-medium uppercase tracking-wider mt-0.5',
              variant === 'light' || variant === 'sidebar' ? 'text-white/70' : 'text-[#475569]'
            )}
          >
            Préparation Officielle
          </span>
        )}
      </div>
    </div>
  );
}
