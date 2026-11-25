'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, Auth } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  connectFirestoreEmulator,
  persistentLocalCache,
  persistentMultipleTabManager,
  Firestore,
} from 'firebase/firestore';
import { getStorage, connectStorageEmulator, FirebaseStorage } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator, type Functions } from 'firebase/functions';

const USE_EMULATORS = process.env.NEXT_PUBLIC_USE_EMULATORS === 'true';
let emulatorsConnected = false;

function maybeConnectEmulators(auth: Auth, firestore: Firestore, storage: FirebaseStorage) {
  if (!USE_EMULATORS || emulatorsConnected) return;
  emulatorsConnected = true;
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
}

/** Firestore con caché local: la app abre y permite anotar aunque no haya señal. */
function createFirestore(app: FirebaseApp): Firestore {
  try {
    return initializeFirestore(app, {
      localCache: typeof window === 'undefined' ? undefined : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    // Ya inicializado (recarga en caliente) o el navegador no permite IndexedDB
    return getFirestore(app);
  }
}

let cached: { firebaseApp: FirebaseApp; auth: Auth; firestore: Firestore; storage: FirebaseStorage } | null = null;

export function initializeFirebase() {
  if (!getApps().length) {
    // Important! initializeApp() is called without any arguments because Firebase App Hosting
    // integrates with the initializeApp() function to provide the environment variables needed to
    // populate the FirebaseOptions in production. It is critical that we attempt to call initializeApp()
    // without arguments.
    let firebaseApp;
    try {
      // Attempt to initialize via Firebase App Hosting environment variables
      if (USE_EMULATORS) throw new Error('emulators');
      firebaseApp = initializeApp();
    } catch (e) {
      // Only warn in production because it's normal to use the firebaseConfig to initialize
      // during development
      if (process.env.NODE_ENV === "production") {
        console.warn('Automatic initialization failed. Falling back to firebase config object.', e);
      }
      firebaseApp = initializeApp(firebaseConfig);
    }

    return getSdks(firebaseApp);
  }

  // If already initialized, return the SDKs with the already initialized App
  return getSdks(getApp());
}

export function getSdks(firebaseApp: FirebaseApp) {
  if (cached && cached.firebaseApp === firebaseApp) return cached;
  const auth = getAuth(firebaseApp);
  const firestore = createFirestore(firebaseApp);
  const bucket = firebaseApp.options.storageBucket || `${firebaseApp.options.projectId}.firebasestorage.app`;
  const storage = getStorage(firebaseApp, `gs://${bucket}`);
  maybeConnectEmulators(auth, firestore, storage);
  cached = { firebaseApp, auth, firestore, storage };
  return cached;
}

let functionsInstance: Functions | null = null;
/** Cloud Functions (región us-central1), conectado al emulador en desarrollo. */
export function getAppFunctions(app: FirebaseApp) {
  if (!functionsInstance) {
    functionsInstance = getFunctions(app, 'us-central1');
    if (USE_EMULATORS) connectFunctionsEmulator(functionsInstance, '127.0.0.1', 5001);
  }
  return functionsInstance;
}

export function getFirebaseStorage() {
  if (!cached) throw new Error('Firebase no inicializado');
  return cached.storage;
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
