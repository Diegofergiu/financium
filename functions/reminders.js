/**
 * Lógica de avisos de Mi Bolsillo (servidor).
 *
 * Los identificadores de aviso usan el MISMO formato que la app (src/lib/alerts.ts),
 * así la notificación del servidor y la que muestra la app abierta comparten "tag"
 * y el celular las reemplaza en lugar de duplicarlas.
 */

const TZ = 'America/Argentina/Buenos_Aires';
const DEFAULT_NOTIFY_DAYS = 7;
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
function computeWalletAlerts({ wallet, checks, budgets, transactions, categories, notifyDays, today }) {
  const currency = wallet.currency || 'ARS';
  const multi = !!wallet.__multi;
  const suffix = multi ? ` · ${wallet.name}` : '';
  const alerts = [];

  for (const c of checks) {
    if (c.status !== 'pending' || !c.dueDate) continue;
    const days = daysBetween(today, c.dueDate);
    if (days > notifyDays) continue;
    const state = days < 0 ? 'overdue' : days === 0 ? 'today' : 'soon';
    alerts.push({
      id: `check-${c.id}-${c.dueDate}-${state}`,
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
  return alerts;
}

const docs = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

/** Junta los avisos de todos los libros de un usuario. */
async function collectUserAlerts(db, uid, notifyDays, today) {
  const wallets = docs(await db.collection('wallets').where('ownerId', '==', uid).get());
  const monthStart = `${today.slice(0, 7)}-01`;
  const all = [];
  for (const wallet of wallets) {
    wallet.__multi = wallets.length > 1;
    const ref = db.collection('wallets').doc(wallet.id);
    const [checks, budgets, categories] = await Promise.all([
      ref.collection('checks').where('status', '==', 'pending').get().then(docs),
      ref.collection('budgets').get().then(docs),
      ref.collection('categories').get().then(docs),
    ]);
    const transactions = budgets.length
      ? docs(await ref.collection('transactions').where('date', '>=', monthStart).get())
      : [];
    all.push(...computeWalletAlerts({ wallet, checks, budgets, transactions, categories, notifyDays, today }));
  }
  const rank = { critical: 0, warning: 1, info: 2 };
  return all.sort((a, b) => rank[a.severity] - rank[b.severity]);
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
async function runDailyReminders({ db, messaging, FieldValue, FieldPath, now = new Date(), log = console }) {
  const today = localISO(now);
  const users = await db.collection('users').where('pushEnabled', '==', true).get();
  const summary = { users: 0, notified: 0, messages: 0, removedTokens: 0 };

  for (const userDoc of users.docs) {
    summary.users++;
    const u = userDoc.data();
    const tokens = Object.keys(u.fcmTokens || {});
    if (!tokens.length) continue;
    try {
      const notifyDays = Number(u.notifyDays) > 0 ? Number(u.notifyDays) : DEFAULT_NOTIFY_DAYS;
      const sentAlerts = u.sentAlerts || {};
      const alerts = (await collectUserAlerts(db, userDoc.id, notifyDays, today)).filter((a) => !sentAlerts[a.id]);

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

module.exports = {
  localISO,
  daysBetween,
  computeWalletAlerts,
  collectUserAlerts,
  buildMessages,
  sendToUser,
  runDailyReminders,
};
