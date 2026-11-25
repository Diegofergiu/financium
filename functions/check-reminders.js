/**
 * Avisos de cheques (servidor). Copia de src/lib/check-reminders.ts:
 * si se cambia uno, cambiar el otro (los ids de aviso deben coincidir).
 */
const DEFAULT_CHECK_REMINDERS = {
  toCollect: { days: [7, 3, 1, 0], overdueEvery: 2 },
  issued: { days: [7, 3, 1, 0], overdueEvery: 1 },
  hour: 9,
};

const cleanDays = (d) =>
  Array.isArray(d)
    ? Array.from(new Set(d.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 90))).sort((a, b) => b - a)
    : [];

function cleanRule(raw, fallback) {
  const days = raw && Array.isArray(raw.days) ? cleanDays(raw.days) : fallback.days;
  const every = Number(raw && raw.overdueEvery);
  return { days, overdueEvery: Number.isInteger(every) && every >= -1 && every <= 30 ? every : fallback.overdueEvery };
}

function normalizeCheckReminders(raw, legacyNotifyDays) {
  let base = DEFAULT_CHECK_REMINDERS;
  if (!raw && legacyNotifyDays && legacyNotifyDays > 0) {
    const days = cleanDays([legacyNotifyDays, 3, 1, 0].filter((d) => d <= legacyNotifyDays));
    base = { ...base, toCollect: { ...base.toCollect, days }, issued: { ...base.issued, days } };
  }
  const hour = Number(raw && raw.hour);
  return {
    toCollect: cleanRule(raw && raw.toCollect, base.toCollect),
    issued: cleanRule(raw && raw.issued, base.issued),
    hour: Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : base.hour,
  };
}

function ruleForCheck(check, settings) {
  const general = check.type === 'issued' ? settings.issued : settings.toCollect;
  return Array.isArray(check.reminderDays) ? { ...general, days: cleanDays(check.reminderDays) } : general;
}

function checkReminderStage(daysUntil, rule) {
  if (daysUntil >= 0) {
    const reached = rule.days.filter((o) => o >= daysUntil);
    if (!reached.length) return null;
    return `d${Math.min(...reached)}`;
  }
  if (rule.overdueEvery < 0) return null;
  if (rule.overdueEvery === 0) return 'overdue';
  return `overdue-${Math.floor((-daysUntil - 1) / rule.overdueEvery)}`;
}

module.exports = { DEFAULT_CHECK_REMINDERS, normalizeCheckReminders, ruleForCheck, checkReminderStage };
