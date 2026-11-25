/**
 * Configuración de avisos de cheques: varios recordatorios antes del vencimiento,
 * repetición si queda vencido y hora del aviso.
 *
 * IMPORTANTE: la misma lógica está en functions/check-reminders.js (servidor).
 * Si se cambia acá, cambiarla también allá (los ids de aviso deben coincidir).
 */
import type { Check } from '@/types';

export interface ReminderRule {
  /** Días antes del vencimiento en que se avisa (0 = el mismo día). */
  days: number[];
  /** Si queda vencido y pendiente: -1 no avisar, 0 una vez, N = cada N días. */
  overdueEvery: number;
}

export interface CheckReminderSettings {
  toCollect: ReminderRule;
  issued: ReminderRule;
  /** Hora (0-23, Argentina) de las notificaciones con la app cerrada. */
  hour: number;
}

export const REMINDER_DAY_OPTIONS = [30, 15, 10, 7, 5, 3, 2, 1, 0];
export const OVERDUE_OPTIONS = [
  { value: -1, label: 'No volver a avisar' },
  { value: 0, label: 'Avisar una vez' },
  { value: 1, label: 'Todos los días' },
  { value: 2, label: 'Cada 2 días' },
  { value: 3, label: 'Cada 3 días' },
  { value: 7, label: 'Una vez por semana' },
];

export const DEFAULT_CHECK_REMINDERS: CheckReminderSettings = {
  toCollect: { days: [7, 3, 1, 0], overdueEvery: 2 },
  issued: { days: [7, 3, 1, 0], overdueEvery: 1 },
  hour: 9,
};

const cleanDays = (d: unknown): number[] =>
  Array.isArray(d)
    ? Array.from(new Set(d.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 90))).sort((a, b) => b - a)
    : [];

function cleanRule(raw: any, fallback: ReminderRule): ReminderRule {
  const days = raw && Array.isArray(raw.days) ? cleanDays(raw.days) : fallback.days;
  const every = Number(raw?.overdueEvery);
  return { days, overdueEvery: Number.isInteger(every) && every >= -1 && every <= 30 ? every : fallback.overdueEvery };
}

/** Lee la configuración guardada (o la arma a partir del viejo "avisar con N días"). */
export function normalizeCheckReminders(raw: any, legacyNotifyDays?: number): CheckReminderSettings {
  let base = DEFAULT_CHECK_REMINDERS;
  if (!raw && legacyNotifyDays && legacyNotifyDays > 0) {
    const days = cleanDays([legacyNotifyDays, 3, 1, 0].filter((d) => d <= legacyNotifyDays));
    base = { ...base, toCollect: { ...base.toCollect, days }, issued: { ...base.issued, days } };
  }
  const hour = Number(raw?.hour);
  return {
    toCollect: cleanRule(raw?.toCollect, base.toCollect),
    issued: cleanRule(raw?.issued, base.issued),
    hour: Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : base.hour,
  };
}

/** Regla efectiva de un cheque (la propia, si la personalizaste, o la general según su tipo). */
export function ruleForCheck(check: Pick<Check, 'type'> & { reminderDays?: number[] | null }, settings: CheckReminderSettings): ReminderRule {
  const general = check.type === 'issued' ? settings.issued : settings.toCollect;
  return Array.isArray(check.reminderDays) ? { ...general, days: cleanDays(check.reminderDays) } : general;
}

/**
 * Etapa de aviso en la que está un cheque según los días que faltan.
 * Cada etapa genera UN aviso (el id incluye la etapa), así se avisa varias veces.
 * Devuelve null si todavía no corresponde avisar.
 */
export function checkReminderStage(daysUntil: number, rule: ReminderRule): string | null {
  if (daysUntil >= 0) {
    const reached = rule.days.filter((o) => o >= daysUntil);
    if (!reached.length) return null;
    return `d${Math.min(...reached)}`;
  }
  if (rule.overdueEvery < 0) return null;
  if (rule.overdueEvery === 0) return 'overdue';
  return `overdue-${Math.floor((-daysUntil - 1) / rule.overdueEvery)}`;
}

export function describeRule(rule: ReminderRule) {
  const parts = rule.days.map((d) => (d === 0 ? 'el día' : d === 1 ? '1 día antes' : `${d} días antes`));
  const over = OVERDUE_OPTIONS.find((o) => o.value === rule.overdueEvery)?.label.toLowerCase();
  return `${parts.length ? parts.join(', ') : 'sin avisos previos'}${rule.overdueEvery >= 0 && over ? `; si vence: ${over}` : ''}`;
}
