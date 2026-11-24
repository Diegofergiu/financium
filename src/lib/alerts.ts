import type { Budget, Category, Check, Transaction } from '@/types';
import { daysUntil, formatMoney, relativeDays } from './format';
import { format } from 'date-fns';

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface AppAlert {
  /** Identificador estable (sirve para no repetir la notificación del navegador). */
  id: string;
  severity: AlertSeverity;
  title: string;
  body: string;
  href: string;
  kind: 'check' | 'budget';
}

export const NOTIFY_DAYS_KEY = 'mibolsillo:notify-days';
export const DEFAULT_NOTIFY_DAYS = 7;

export function getNotifyDays(): number {
  if (typeof window === 'undefined') return DEFAULT_NOTIFY_DAYS;
  try {
    const v = Number(window.localStorage.getItem(NOTIFY_DAYS_KEY));
    return Number.isFinite(v) && v > 0 ? v : DEFAULT_NOTIFY_DAYS;
  } catch {
    return DEFAULT_NOTIFY_DAYS;
  }
}

export function monthSpentByCategory(transactions: Transaction[], monthKey = format(new Date(), 'yyyy-MM')) {
  const map = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== 'expense' || !t.date?.startsWith(monthKey)) continue;
    map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + (Number(t.amount) || 0));
  }
  return map;
}

export function computeAlerts(params: {
  checks: Check[];
  budgets: Budget[];
  transactions: Transaction[];
  categories: Category[];
  currency: string;
  notifyDays: number;
}): AppAlert[] {
  const { checks, budgets, transactions, categories, currency, notifyDays } = params;
  const alerts: AppAlert[] = [];

  for (const c of checks) {
    if (c.status !== 'pending') continue;
    const days = daysUntil(c.dueDate);
    if (days > notifyDays) continue;
    const isIssued = c.type === 'issued';
    const verb = isIssued ? 'a pagar' : 'a cobrar';
    alerts.push({
      id: `check-${c.id}-${c.dueDate}-${days < 0 ? 'overdue' : days === 0 ? 'today' : 'soon'}`,
      kind: 'check',
      severity: days < 0 ? 'critical' : days <= 2 ? 'warning' : 'info',
      title: `Cheque ${verb}: ${formatMoney(c.amount, currency)}`,
      body: `${relativeDays(days)} · ${c.issuerRecipient || 'Sin nombre'}${c.bank ? ` · ${c.bank}` : ''}`,
      href: '/checks',
    });
  }

  const spent = monthSpentByCategory(transactions);
  const month = format(new Date(), 'yyyy-MM');
  for (const b of budgets) {
    const used = spent.get(b.categoryId) ?? 0;
    if (!b.limitAmount) continue;
    const pct = used / b.limitAmount;
    if (pct < 0.8) continue;
    const cat = categories.find((c) => c.id === b.categoryId)?.name ?? 'Categoría';
    const over = pct >= 1;
    alerts.push({
      id: `budget-${b.id}-${month}-${over ? 'over' : 'near'}`,
      kind: 'budget',
      severity: over ? 'critical' : 'warning',
      title: over ? `Presupuesto superado: ${b.name}` : `Presupuesto casi agotado: ${b.name}`,
      body: `${cat}: gastaste ${formatMoney(used, currency)} de ${formatMoney(b.limitAmount, currency)} (${Math.round(pct * 100)}%)`,
      href: '/budgets',
    });
  }

  const rank = { critical: 0, warning: 1, info: 2 } as const;
  return alerts.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
