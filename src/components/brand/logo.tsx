import { cn } from '@/lib/utils';

/** Isotipo de Mi Bolsillo: un bolsillo con una moneda entrando. */
export function LogoMark({ className }: { className?: string }) {
  // Ids fijos: todas las instancias usan los mismos gradientes (evita diferencias servidor/cliente)
  const id = '-mibolsillo';
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" className={cn('h-9 w-9 shrink-0', className)}>
      <defs>
        <linearGradient id={`bg${id}`} x1="6" y1="4" x2="58" y2="62" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1F8A76" />
          <stop offset="1" stopColor="#0B3B35" />
        </linearGradient>
        <linearGradient id={`cn${id}`} x1="25" y1="10" x2="39" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFD27A" />
          <stop offset="1" stopColor="#E9A23B" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#bg${id})`} />
      <circle cx="32" cy="20" r="8.5" fill={`url(#cn${id})`} />
      <path
        d="M32 14.5v2.2M32 23.3v.2M34.6 16.8c-.5-.9-1.5-1.4-2.6-1.4-1.5 0-2.7.9-2.7 2.1 0 2.8 5.6 1.4 5.6 4.3 0 1.2-1.2 2.1-2.9 2.1-1.2 0-2.3-.6-2.8-1.5"
        stroke="#0B3B35"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M14 26.5h36v14.2c0 2-1.1 3.8-2.9 4.7L34.3 52a5 5 0 0 1-4.6 0L16.9 45.4A5.3 5.3 0 0 1 14 40.7z" fill="#fff" />
      <path d="M18.5 31h27" stroke="#1F8A76" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3" />
    </svg>
  );
}

export function Logo({ className, subtitle = true }: { className?: string; subtitle?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <LogoMark />
      <div className="flex flex-col leading-none">
        <span className="font-headline text-lg font-extrabold tracking-tight">Mi Bolsillo</span>
        {subtitle && <span className="mt-0.5 text-[11px] font-medium text-muted-foreground">Tus cuentas, claras</span>}
      </div>
    </div>
  );
}
