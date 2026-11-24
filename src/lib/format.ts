import { format, parseISO, differenceInCalendarDays, isValid } from 'date-fns';
import { es } from 'date-fns/locale';

export const CURRENCIES = [
  { code: 'ARS', label: 'Peso argentino (ARS)' },
  { code: 'UYU', label: 'Peso uruguayo (UYU)' },
  { code: 'USD', label: 'Dólar estadounidense (USD)' },
  { code: 'EUR', label: 'Euro (EUR)' },
  { code: 'CLP', label: 'Peso chileno (CLP)' },
  { code: 'MXN', label: 'Peso mexicano (MXN)' },
  { code: 'COP', label: 'Peso colombiano (COP)' },
  { code: 'PEN', label: 'Sol peruano (PEN)' },
] as const;

export const DEFAULT_CURRENCY = 'ARS';

const formatters = new Map<string, Intl.NumberFormat>();

function getFormatter(currency: string, compact: boolean) {
  const key = `${currency}-${compact}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency,
      // "$" sólo para pesos argentinos; el resto con su símbolo propio (US$, €, UYU…)
      currencyDisplay: currency === 'ARS' ? 'narrowSymbol' : 'symbol',
      minimumFractionDigits: compact ? 0 : 2,
      maximumFractionDigits: compact ? 1 : 2,
      notation: compact ? 'compact' : 'standard',
    });
    formatters.set(key, f);
  }
  return f;
}

/** Formatea un monto con la moneda del libro, p. ej. "$ 12.345,50". */
export function formatMoney(amount: number, currency: string = DEFAULT_CURRENCY, opts?: { compact?: boolean; signed?: boolean }) {
  const value = Number.isFinite(amount) ? amount : 0;
  const text = getFormatter(currency, !!opts?.compact).format(Math.abs(value));
  if (opts?.signed) return `${value < 0 ? '−' : '+'}${text}`;
  return value < 0 ? `−${text}` : text;
}

/** Fecha local de hoy en formato YYYY-MM-DD (evita el desfase de toISOString en UTC). */
export function todayISO() {
  return format(new Date(), 'yyyy-MM-dd');
}

export function safeParse(date: string | undefined | null) {
  if (!date) return null;
  const d = parseISO(date);
  return isValid(d) ? d : null;
}

/** "12 mar 2026" */
export function formatDate(date: string | undefined | null, pattern = "d MMM yyyy") {
  const d = safeParse(date);
  return d ? format(d, pattern, { locale: es }) : '—';
}

/** Días desde hoy hasta la fecha (negativo si ya pasó). */
export function daysUntil(date: string) {
  const d = safeParse(date);
  if (!d) return 0;
  return differenceInCalendarDays(d, new Date());
}

export function relativeDays(days: number) {
  if (days === 0) return 'Vence hoy';
  if (days === 1) return 'Vence mañana';
  if (days === -1) return 'Venció ayer';
  if (days < 0) return `Venció hace ${Math.abs(days)} días`;
  return `Vence en ${days} días`;
}

export function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Convierte "12.345,67" o "12345.67" a número. */
export function parseAmount(input: string): number {
  const raw = String(input ?? '').trim().replace(/\s|\$/g, '');
  if (!raw) return NaN;
  const lastComma = raw.lastIndexOf(',');
  const lastDot = raw.lastIndexOf('.');
  let normalized = raw;
  if (lastComma > -1 && lastDot > -1) {
    // El separador que aparece último es el decimal
    normalized = lastComma > lastDot ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
  } else if (lastComma > -1) {
    normalized = raw.replace(',', '.');
  } else if (lastDot > -1 && /^\d{1,3}(\.\d{3})+$/.test(raw)) {
    // "12.345" estilo argentino = doce mil
    normalized = raw.replace(/\./g, '');
  }
  return Number(normalized);
}
