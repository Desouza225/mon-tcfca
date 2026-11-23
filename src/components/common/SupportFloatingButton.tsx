import { useLocation } from 'react-router-dom';
import { Mail } from 'lucide-react';

const SUPPORT_EMAIL = 'support@mon-tcfca.com';
const MAILTO_HREF = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Support — Mon TCF Canada')}`;

export function SupportFloatingButton() {
  const location = useLocation();

  if (location.pathname === '/promo-video') {
    return null;
  }

  return (
    <a
      href={MAILTO_HREF}
      title={`Envoyer un e-mail à ${SUPPORT_EMAIL}`}
      aria-label={`Contacter le support par e-mail (${SUPPORT_EMAIL})`}
      className="fixed bottom-5 right-5 z-40 group flex items-center gap-2.5 rounded-full bg-[#0d233a] hover:bg-[#1a365d] text-white px-4 py-3 shadow-lg shadow-[#0d233a]/25 border border-white/15 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e53e3e] focus-visible:ring-offset-2"
    >
      <span className="relative flex items-center justify-center">
        <Mail className="w-5 h-5 text-[#ffdcc3] transition-transform duration-200 group-hover:scale-110" />
        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#e53e3e] ring-2 ring-[#0d233a]" />
      </span>
      <span className="hidden sm:inline font-heading font-bold text-xs tracking-wide pr-0.5">
        Support
      </span>
    </a>
  );
}
