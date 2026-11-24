'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useWallet } from './wallet-provider';
import { useFirebaseApp, useFirestore, useUser } from '@/firebase';
import { registerPush, unregisterPush, sendServerTestPush, saveNotifyDays, pushSupported } from '@/firebase/push';
import { computeAlerts, getNotifyDays, NOTIFY_DAYS_KEY, type AppAlert } from '@/lib/alerts';

const SEEN_KEY = 'mibolsillo:seen-alerts';
const NOTIFIED_KEY = 'mibolsillo:notified-alerts';
const ENABLED_KEY = 'mibolsillo:push-enabled';

type PermissionState = NotificationPermission | 'unsupported';
/** Estado de los avisos con la app cerrada (enviados por el servidor). */
export type ServerPushState = 'off' | 'registering' | 'active' | 'unavailable';

interface NotificationsContextValue {
  alerts: AppAlert[];
  unreadCount: number;
  markAllRead: () => void;
  permission: PermissionState;
  enabled: boolean;
  enable: () => Promise<boolean>;
  disable: () => void;
  sendTest: () => Promise<'server' | 'local' | false>;
  serverPush: ServerPushState;
  notifyDays: number;
  setNotifyDays: (d: number) => void;
}

const Ctx = createContext<NotificationsContextValue | null>(null);

function readSet(key: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || '[]'));
  } catch {
    return new Set();
  }
}
function writeSet(key: string, set: Set<string>) {
  try {
    // Se guardan sólo los últimos 300 para no crecer indefinidamente
    localStorage.setItem(key, JSON.stringify(Array.from(set).slice(-300)));
  } catch {}
}

async function getRegistration() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js'));
  } catch {
    return null;
  }
}

async function showSystemNotification(title: string, body: string, url: string, tag: string) {
  const options: NotificationOptions & { renotify?: boolean } = {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    tag,
    data: { url },
    lang: 'es',
  };
  const reg = await getRegistration();
  if (reg) {
    await reg.showNotification(title, options);
    return true;
  }
  if ('Notification' in window) {
    const n = new Notification(title, options);
    n.onclick = () => {
      window.focus();
      window.location.href = url;
    };
    return true;
  }
  return false;
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { checks, budgets, transactions, categories, currency, isDataLoading } = useWallet();
  const [notifyDays, setNotifyDaysState] = useState(7);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [permission, setPermission] = useState<PermissionState>('default');
  const [enabled, setEnabled] = useState(false);
  const [serverPush, setServerPush] = useState<ServerPushState>('off');
  const app = useFirebaseApp();
  const db = useFirestore();
  const { user } = useUser();

  const registerServerPush = useCallback(
    async (days: number) => {
      if (!user) return;
      if (!(await pushSupported())) {
        setServerPush('unavailable');
        return;
      }
      setServerPush('registering');
      try {
        const token = await registerPush(app, db, user.uid, days);
        setServerPush(token ? 'active' : 'unavailable');
      } catch (e) {
        console.warn('No se pudo registrar el dispositivo para avisos push', e);
        setServerPush('unavailable');
      }
    },
    [app, db, user]
  );

  useEffect(() => {
    setNotifyDaysState(getNotifyDays());
    setSeen(readSet(SEEN_KEY));
    if (!('Notification' in window)) setPermission('unsupported');
    else setPermission(Notification.permission);
    try {
      setEnabled(localStorage.getItem(ENABLED_KEY) === '1');
    } catch {}
    // Registrar el service worker (app instalable + clics en notificaciones)
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);

  // Si ya estaban activadas, renovar el registro del dispositivo (los tokens pueden cambiar)
  useEffect(() => {
    if (enabled && permission === 'granted') registerServerPush(getNotifyDays());
  }, [enabled, permission, registerServerPush]);

  const alerts = useMemo(
    () => (isDataLoading ? [] : computeAlerts({ checks, budgets, transactions, categories, currency, notifyDays })),
    [checks, budgets, transactions, categories, currency, notifyDays, isDataLoading]
  );

  const unreadCount = alerts.filter((a) => !seen.has(a.id)).length;

  const markAllRead = useCallback(() => {
    setSeen((prev) => {
      const next = new Set(prev);
      alerts.forEach((a) => next.add(a.id));
      writeSet(SEEN_KEY, next);
      return next;
    });
  }, [alerts]);

  // Envía una notificación del sistema por cada alerta nueva (una sola vez por alerta)
  useEffect(() => {
    if (!enabled || permission !== 'granted' || alerts.length === 0) return;
    const notified = readSet(NOTIFIED_KEY);
    const fresh = alerts.filter((a) => !notified.has(a.id));
    if (fresh.length === 0) return;
    (async () => {
      if (fresh.length > 3) {
        await showSystemNotification(
          `Tenés ${fresh.length} avisos nuevos`,
          fresh.slice(0, 3).map((a) => a.title).join(' · '),
          '/dashboard',
          'mibolsillo-resumen'
        );
      } else {
        for (const a of fresh) await showSystemNotification(a.title, a.body, a.href, a.id);
      }
      fresh.forEach((a) => notified.add(a.id));
      writeSet(NOTIFIED_KEY, notified);
    })().catch(console.error);
  }, [alerts, enabled, permission]);

  const enable = useCallback(async () => {
    if (!('Notification' in window)) return false;
    const result = await Notification.requestPermission();
    setPermission(result);
    const ok = result === 'granted';
    setEnabled(ok);
    if (ok) await registerServerPush(getNotifyDays());
    try {
      localStorage.setItem(ENABLED_KEY, ok ? '1' : '0');
    } catch {}
    return ok;
  }, [registerServerPush]);

  const disable = useCallback(() => {
    setEnabled(false);
    setServerPush('off');
    if (user) unregisterPush(app, db, user.uid).catch(() => {});
    try {
      localStorage.setItem(ENABLED_KEY, '0');
    } catch {}
  }, [app, db, user]);

  const sendTest = useCallback(async (): Promise<'server' | 'local' | false> => {
    if (permission !== 'granted') return false;
    // Primero por el servidor (prueba el circuito completo); si no está disponible, local
    if (serverPush === 'active') {
      try {
        const r = await sendServerTestPush(app);
        if (r.sent > 0) return 'server';
      } catch (e) {
        console.warn('Prueba desde el servidor no disponible', e);
      }
    }
    const ok = await showSystemNotification('¡Las notificaciones funcionan! 🎉', 'Te vamos a avisar de cheques por vencer y presupuestos.', '/dashboard', 'mibolsillo-test');
    return ok ? 'local' : false;
  }, [permission, serverPush, app]);

  const setNotifyDays = useCallback((d: number) => {
    setNotifyDaysState(d);
    try {
      localStorage.setItem(NOTIFY_DAYS_KEY, String(d));
    } catch {}
    if (user) saveNotifyDays(db, user.uid, d).catch(() => {});
  }, [db, user]);

  return (
    <Ctx.Provider
      value={{ alerts, unreadCount, markAllRead, permission, enabled, enable, disable, sendTest, serverPush, notifyDays, setNotifyDays }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useNotifications debe usarse dentro de NotificationsProvider');
  return ctx;
}
