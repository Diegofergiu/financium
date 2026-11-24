import { format } from 'date-fns';
import type { Recurring } from '@/types';

/** Fecha (YYYY-MM-DD) que le toca a un gasto fijo en un mes dado; ajusta al último día si el mes es corto. */
export function recurringDate(dayOfMonth: number, month: string) {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  const day = Math.min(Math.max(1, dayOfMonth), last);
  return `${month}-${String(day).padStart(2, '0')}`;
}

export const recurringTransactionId = (recurringId: string, month: string) => `rec-${recurringId}-${month}`;

/** Gastos fijos activos que todavía no se anotaron este mes y cuyo día ya llegó (o llega dentro de `aheadDays`). */
export function dueRecurring(list: Recurring[], today = new Date(), aheadDays = 0) {
  const month = format(today, 'yyyy-MM');
  const todayISO = format(today, 'yyyy-MM-dd');
  const limit = format(new Date(today.getTime() + aheadDays * 864e5), 'yyyy-MM-dd');
  return list
    .filter((r) => r.active && (r.lastCreatedMonth ?? '') < month)
    .map((r) => ({ ...r, month, date: recurringDate(r.dayOfMonth, month) }))
    .filter((r) => r.date <= (aheadDays ? limit : todayISO));
}
