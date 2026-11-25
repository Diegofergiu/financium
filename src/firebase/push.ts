'use client';

import type { FirebaseApp } from 'firebase/app';
import { deleteField, doc, FieldPath, serverTimestamp, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
import { deleteToken, getMessaging, getToken, isSupported } from 'firebase/messaging';
import { getFunctions, httpsCallable } from 'firebase/functions';

const TOKEN_KEY = 'mibolsillo:fcm-token';

async function getSwRegistration() {
  await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready;
}

/** ¿Este navegador puede recibir avisos con la app cerrada? */
export async function pushSupported() {
  try {
    return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && (await isSupported());
  } catch {
    return false;
  }
}

/**
 * Registra este dispositivo en Firebase Cloud Messaging y guarda el token en el perfil,
 * para que la función diaria del servidor pueda enviarle avisos aunque la app esté cerrada.
 */
export async function registerPush(app: FirebaseApp, db: Firestore, uid: string): Promise<string | null> {
  if (!(await pushSupported())) return null;
  const registration = await getSwRegistration();
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || undefined;
  const token = await getToken(getMessaging(app), { serviceWorkerRegistration: registration, vapidKey });
  if (!token) return null;
  await setDoc(
    doc(db, 'users', uid),
    {
      id: uid,
      pushEnabled: true,
      fcmTokens: { [token]: { updatedAt: serverTimestamp(), ua: navigator.userAgent.slice(0, 160) } },
    },
    { merge: true }
  );
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {}
  return token;
}

/** Quita este dispositivo de los avisos del servidor. */
export async function unregisterPush(app: FirebaseApp, db: Firestore, uid: string) {
  let token: string | null = null;
  try {
    token = localStorage.getItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
  if (token) await updateDoc(doc(db, 'users', uid), new FieldPath('fcmTokens', token), deleteField()).catch(() => {});
  if (await pushSupported()) await deleteToken(getMessaging(app)).catch(() => {});
}

export function hasLocalPushToken() {
  try {
    return !!localStorage.getItem(TOKEN_KEY);
  } catch {
    return false;
  }
}

/** Pide al servidor que mande una notificación de prueba a todos los dispositivos del usuario. */
export async function sendServerTestPush(app: FirebaseApp) {
  const fn = httpsCallable<unknown, { sent: number; devices: number }>(getFunctions(app, 'us-central1'), 'enviarPruebaPush');
  const res = await fn({});
  return res.data;
}

/** Guarda la configuración de avisos de cheques en el perfil (la usa también el servidor). */
export async function saveCheckReminders(db: Firestore, uid: string, settings: unknown) {
  await setDoc(doc(db, 'users', uid), { id: uid, checkReminders: settings }, { merge: true });
}
