const { normalizeCheckReminders, ruleForCheck, checkReminderStage } = require('./check-reminders');
/**
 * Lógica de avisos de Mi Bolsillo (servidor).
 *
 * Los identificadores de aviso usan el MISMO formato que la app (src/lib/alerts.ts),
 * así la notificación del servidor y la que muestra la app abierta comparten "tag"
 * y el celular las reemplaza en lugar de duplicarlas.
 */

const TZ = 'America/Argentina/Buenos_Aires';
const SENT_TTL_DAYS = 60;

/** Fecha YYYY-MM-DD en la zona horaria de Argentina. */
function localISO(date = new Date(), timeZone = TZ) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function daysBetween(fromISO, toISO) {
  const a = Date.UTC(+fromISO.slice(0, 4), +fromISO.slice(5, 7) - 1, +fromISO.slice(8, 10));
  const b = Date.UTC(+toISO.slice(0, 4), +toISO.slice(5, 7) - 1, +toISO.slice(8, 10));
  return Math.round((b - a) / 86400000);
}

function money(amount, currency = 'ARS') {
  try {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).format(amount);
  } catch {
    return `$ ${amount}`;
  }
}

function relativeDays(days) {
  if (days === 0) return 'Vence hoy';
  if (days === 1) return 'Vence mañana';
  if (days === -1) return 'Venció ayer';
  if (days < 0) return `Venció hace ${Math.abs(days)} días`;
  return `Vence en ${days} días`;
}

/**
 * Calcula los avisos de un libro.
 * @returns {{id:string,title:string,body:string,url:string,severity:string}[]}
 */
function computeWalletAlerts({ wallet, checks, budgets, transactions, categories, reminders, today, recurring = [] }) {
  const currency = wallet.currency || 'ARS';
  const multi = !!wallet.__multi;
  const suffix = multi ? ` · ${wallet.name}` : '';
  const alerts = [];

  for (const c of checks) {
    if (c.status !== 'pending' || !c.dueDate) continue;
    const days = daysBetween(today, c.dueDate);
    const stage = checkReminderStage(days, ruleForCheck(c, reminders));
    if (!stage) continue;
    alerts.push({
      id: `check-${c.id}-${c.dueDate}-${stage}`,
      severity: days < 0 ? 'critical' : days <= 2 ? 'warning' : 'info',
      title: `Cheque ${c.type === 'issued' ? 'a pagar' : 'a cobrar'}: ${money(c.amount, currency)}`,
      body: `${relativeDays(days)} · ${c.issuerRecipient || 'Sin nombre'}${c.bank ? ` · ${c.bank}` : ''}${suffix}`,
      url: '/checks',
    });
  }

  const month = today.slice(0, 7);
  const spent = new Map();
  for (const t of transactions) {
    if (t.type !== 'expense' || !String(t.date || '').startsWith(month)) continue;
    spent.set(t.categoryId, (spent.get(t.categoryId) || 0) + (Number(t.amount) || 0));
  }
  for (const b of budgets) {
    if (!b.limitAmount) continue;
    const used = spent.get(b.categoryId) || 0;
    const pct = used / b.limitAmount;
    if (pct < 0.8) continue;
    const over = pct >= 1;
    const cat = (categories.find((c) => c.id === b.categoryId) || {}).name || 'Categoría';
    alerts.push({
      id: `budget-${b.id}-${month}-${over ? 'over' : 'near'}`,
      severity: over ? 'critical' : 'warning',
      title: over ? `Presupuesto superado: ${b.name}` : `Presupuesto casi agotado: ${b.name}`,
      body: `${cat}: gastaste ${money(used, currency)} de ${money(b.limitAmount, currency)} (${Math.round(pct * 100)}%)${suffix}`,
      url: '/budgets',
    });
  }
  for (const r of recurring) {
    if (r.active && r.autoCreate && r.lastCreatedMonth === month && recurringDate(r.dayOfMonth, month) === today) {
      alerts.push({
        id: `recurring-auto-${r.id}-${month}`,
        severity: 'info',
        title: `Se anotó solo: ${r.description}`,
        body: `${r.type === 'income' ? 'Ingreso' : 'Gasto'} de ${money(r.amount, currency)}${suffix}.`,
        url: '/transactions',
      });
    }
  }
  for (const r of recurring) {
    if (!r.active || r.autoCreate || (r.lastCreatedMonth || '') >= month) continue;
    const date = recurringDate(r.dayOfMonth, month);
    const days = daysBetween(today, date);
    if (days > 3) continue;
    alerts.push({
      id: `recurring-${r.id}-${month}-${days < 0 ? 'overdue' : days === 0 ? 'today' : 'soon'}`,
      severity: days < 0 ? 'critical' : days === 0 ? 'warning' : 'info',
      title: `${r.type === 'income' ? 'Cobrar' : 'Pagar'} ${r.description}: ${money(r.amount, currency)}`,
      body: (days < 0 ? `Era el día ${r.dayOfMonth}. Si ya lo hiciste, marcalo como hecho.` : days === 0 ? 'Es hoy.' : `En ${days} día${days > 1 ? 's' : ''} (día ${r.dayOfMonth}).`) + suffix,
      url: '/recurring',
    });
  }
  return alerts;
}

function recurringDate(dayOfMonth, month) {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const day = Math.min(Math.max(1, Number(dayOfMonth) || 1), last);
  return `${month}-${String(day).padStart(2, '0')}`;
}

const docs = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

/** Junta los avisos de todos los libros de un usuario. */
const ROLES = ['owner', 'editor', 'reader'];

async function userWallets(db, uid) {
  const { FieldPath } = require('firebase-admin/firestore');
  return docs(await db.collection('wallets').where(new FieldPath('members', uid), 'in', ROLES).get());
}

async function collectUserAlerts(db, uid, reminders, today) {
  const wallets = await userWallets(db, uid);
  const monthStart = `${today.slice(0, 7)}-01`;
  const all = [];
  for (const wallet of wallets) {
    wallet.__multi = wallets.length > 1;
    const ref = db.collection('wallets').doc(wallet.id);
    const [checks, budgets, categories, recurring, accounts] = await Promise.all([
      ref.collection('checks').where('status', '==', 'pending').get().then(docs),
      ref.collection('budgets').get().then(docs),
      ref.collection('categories').get().then(docs),
      ref.collection('recurring').get().then(docs),
      ref.collection('accounts').get().then(docs),
    ]);
    const transactions = budgets.length
      ? bookOnly(docs(await ref.collection('transactions').where('date', '>=', monthStart).get()), accounts, wallet.currency || 'ARS')
      : [];
    all.push(...computeWalletAlerts({ wallet, checks, budgets, transactions, categories, reminders, today, recurring }));
  }
  const rank = { critical: 0, warning: 1, info: 2 };
  return all.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/** Sólo ingresos/gastos de cuentas en la moneda del libro (igual que la app). */
function bookOnly(transactions, accounts, bookCurrency) {
  const sorted = accounts.slice().sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  const def = (sorted.find((a) => !a.archived) || {}).id || '';
  const foreign = new Set(accounts.filter((a) => a.currency && a.currency !== bookCurrency).map((a) => a.id));
  return transactions.filter((t) => t.type !== 'transfer' && !foreign.has(t.accountId || def));
}

/**
 * Anota los gastos fijos automáticos que tocan hoy en TODOS los libros.
 * El id del movimiento es fijo por mes (rec-{id}-{mes}), igual que en la app: nunca se duplica.
 * @returns lista de {walletId, members, recurring} creados
 */
async function processRecurring({ db, FieldValue, today }) {
  const month = today.slice(0, 7);
  const created = [];
  const wallets = await db.collection('wallets').get();
  for (const w of wallets.docs) {
    const wallet = w.data();
    const recs = docs(await w.ref.collection('recurring').get()).filter(
      (r) => r.active && r.autoCreate && (r.lastCreatedMonth || '') < month && recurringDate(r.dayOfMonth, month) <= today
    );
    if (!recs.length) continue;
    const batch = db.batch();
    for (const r of recs) {
      const date = recurringDate(r.dayOfMonth, month);
      batch.set(w.ref.collection('transactions').doc(`rec-${r.id}-${month}`), {
        walletId: w.id,
        type: r.type,
        amount: r.amount,
        description: r.description,
        categoryId: r.categoryId || '',
        paymentMethod: r.paymentMethod || '',
        accountId: r.accountId || '',
        notes: 'Gasto fijo anotado automáticamente',
        date,
        recurringId: r.id,
        walletOwnerId: wallet.ownerId,
        walletMembersMap: wallet.members || {},
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      batch.update(w.ref.collection('recurring').doc(r.id), { lastCreatedMonth: month, updatedAt: FieldValue.serverTimestamp() });
      created.push({ walletId: w.id, walletName: wallet.name, currency: wallet.currency || 'ARS', members: Object.keys(wallet.members || {}), recurring: r });
    }
    await batch.commit();
  }
  return created;
}

/** Arma los mensajes a enviar: uno por aviso, o un resumen si son más de 3. */
function buildMessages(alerts) {
  if (alerts.length > 3) {
    return [
      {
        tag: 'mibolsillo-resumen',
        title: `Tenés ${alerts.length} avisos nuevos`,
        body: alerts.slice(0, 3).map((a) => a.title).join(' · '),
        url: '/dashboard',
      },
    ];
  }
  return alerts.map((a) => ({ tag: a.id, title: a.title, body: a.body, url: a.url }));
}

function toFcmMessage(token, m) {
  return {
    token,
    // Mensaje sólo de datos: lo dibuja nuestro service worker (public/sw.js)
    data: { title: m.title, body: m.body, url: m.url, tag: m.tag },
    webpush: { headers: { Urgency: 'high', TTL: String(60 * 60 * 24) } },
  };
}

const INVALID_TOKEN = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

/** Envía mensajes a todos los dispositivos del usuario; devuelve los tokens inválidos. */
async function sendToUser(messaging, tokens, messages) {
  const invalid = new Set();
  let sent = 0;
  for (const m of messages) {
    if (!tokens.length) break;
    const res = await messaging.sendEach(tokens.map((t) => toFcmMessage(t, m)));
    res.responses.forEach((r, i) => {
      if (r.success) sent++;
      else if (r.error && INVALID_TOKEN.has(r.error.code)) invalid.add(tokens[i]);
    });
  }
  return { sent, invalid: [...invalid] };
}

/**
 * Tarea diaria: revisa a cada usuario con notificaciones activas y le envía
 * sólo los avisos que todavía no recibió.
 */
/** Hora local (0-23) en Argentina. */
function localHour(date = new Date(), timeZone = TZ) {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(date));
}

/**
 * Corre cada hora: anota gastos fijos automáticos y, a cada usuario, le envía los avisos
 * nuevos sólo en la hora que eligió (por defecto 9:00). `ignoreHour` es para pruebas.
 */
async function runDailyReminders({ db, messaging, FieldValue, FieldPath, now = new Date(), log = console, ignoreHour = false }) {
  const today = localISO(now);
  const hour = localHour(now);
  const createdRecurring = await processRecurring({ db, FieldValue, today });
  const users = await db.collection('users').where('pushEnabled', '==', true).get();
  const summary = { users: 0, notified: 0, messages: 0, removedTokens: 0, recurringCreated: createdRecurring.length };

  for (const userDoc of users.docs) {
    summary.users++;
    const u = userDoc.data();
    const tokens = Object.keys(u.fcmTokens || {});
    if (!tokens.length) continue;
    try {
      const reminders = normalizeCheckReminders(u.checkReminders, Number(u.notifyDays) || undefined);
      if (!ignoreHour && reminders.hour !== hour) continue;
      const sentAlerts = u.sentAlerts || {};
      const alerts = (await collectUserAlerts(db, userDoc.id, reminders, today)).filter((a) => !sentAlerts[a.id]);

      // Pares [campo, valor]; FieldPath evita problemas con caracteres especiales de los tokens
      const update = [];
      const set = (map, key, value) => update.push(new FieldPath(map, key), value);
      // Limpieza de avisos enviados hace mucho
      for (const [id, date] of Object.entries(sentAlerts)) {
        if (typeof date !== 'string' || daysBetween(date, today) > SENT_TTL_DAYS) set('sentAlerts', id, FieldValue.delete());
      }

      if (alerts.length) {
        const { sent, invalid } = await sendToUser(messaging, tokens, buildMessages(alerts));
        summary.messages += sent;
        if (sent) summary.notified++;
        for (const t of invalid) set('fcmTokens', t, FieldValue.delete());
        summary.removedTokens += invalid.length;
        if (sent) for (const a of alerts) set('sentAlerts', a.id, today);
      }
      if (update.length) await userDoc.ref.update(...update);
    } catch (e) {
      log.error(`Error procesando usuario ${userDoc.id}`, e);
    }
  }
  return summary;
}

/** Resumen de la semana anterior (lunes a domingo) para cada usuario con avisos activos. */
async function runWeeklySummary({ db, messaging, FieldValue, FieldPath, now = new Date(), log = console }) {
  const today = localISO(now);
  const from = addDaysISO(today, -7);
  const to = addDaysISO(today, -1);
  const users = await db.collection('users').where('pushEnabled', '==', true).get();
  let sentTotal = 0;
  for (const userDoc of users.docs) {
    const u = userDoc.data();
    if (u.weeklySummary === false) continue;
    const tokens = Object.keys(u.fcmTokens || {});
    if (!tokens.length) continue;
    try {
      const wallets = await userWallets(db, userDoc.id);
      const lines = [];
      for (const wallet of wallets) {
        const ref = db.collection('wallets').doc(wallet.id);
        const currency = wallet.currency || 'ARS';
        const [accounts, categories, txs, checks] = await Promise.all([
          ref.collection('accounts').get().then(docs),
          ref.collection('categories').get().then(docs),
          ref.collection('transactions').where('date', '>=', from).get().then(docs),
          ref.collection('checks').where('status', '==', 'pending').get().then(docs),
        ]);
        const week = bookOnly(txs.filter((t) => t.date <= to), accounts, currency);
        let inc = 0;
        let exp = 0;
        const byCat = new Map();
        for (const t of week) {
          if (t.type === 'income') inc += t.amount;
          else {
            exp += t.amount;
            byCat.set(t.categoryId, (byCat.get(t.categoryId) || 0) + t.amount);
          }
        }
        const nextChecks = checks.filter((c) => c.dueDate >= today && c.dueDate <= addDaysISO(today, 6)).length;
        if (!week.length && !nextChecks) continue;
        const top = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0];
        const topName = top ? (categories.find((c) => c.id === top[0]) || {}).name || 'Sin categoría' : null;
        let line = `${wallets.length > 1 ? `${wallet.name}: ` : ''}entraron ${money(inc, currency)} y salieron ${money(exp, currency)}`;
        if (topName) line += `. Lo que más: ${topName} (${money(top[1], currency)})`;
        if (nextChecks) line += `. Esta semana vencen ${nextChecks} cheque${nextChecks > 1 ? 's' : ''}`;
        lines.push(line + '.');
      }
      if (!lines.length) continue;
      const { sent, invalid } = await sendToUser(messaging, tokens, [
        { tag: `semanal-${today}`, title: 'Tu semana en Mi Bolsillo', body: lines.join(' '), url: '/reports' },
      ]);
      sentTotal += sent;
      if (invalid.length) await userDoc.ref.update(...invalid.flatMap((t) => [new FieldPath('fcmTokens', t), FieldValue.delete()]));
    } catch (e) {
      log.error(`Error en resumen semanal de ${userDoc.id}`, e);
    }
  }
  return { sent: sentTotal };
}

function addDaysISO(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

module.exports = {
  localHour,
  recurringDate,
  processRecurring,
  runWeeklySummary,
  localISO,
  daysBetween,
  computeWalletAlerts,
  collectUserAlerts,
  buildMessages,
  sendToUser,
  runDailyReminders,
};
