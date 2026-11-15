import { findCountry } from '@/data/countries';
import { cn } from '@/lib/utils';

interface CountryFlagProps {
  country?: string | null;
  showName?: boolean;
  className?: string;
  imgClassName?: string;
}

/**
 * Affiche le drapeau réel d'un pays (via image SVG/PNG, compatible Windows/Mac/Mobile)
 * suivi optionnellement du nom complet du pays.
 */
export function CountryFlag({
  country,
  showName = false,
  className,
  imgClassName,
}: CountryFlagProps) {
  if (!country) return null;
  const info = findCountry(country);

  if (!info) {
    return showName ? <span className={className}>{country}</span> : null;
  }

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <img
        src={`https://flagcdn.com/w40/${info.code.toLowerCase()}.png`}
        alt={`Drapeau ${info.name}`}
        className={cn(
          'w-4.5 h-3 object-cover rounded-[2px] border border-black/15 shrink-0 inline-block',
          imgClassName
        )}
        loading="lazy"
      />
      {showName && <span>{info.name}</span>}
    </span>
  );
}

