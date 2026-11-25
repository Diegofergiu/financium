'use client';

import { doc, getDocFromServer, type Firestore } from 'firebase/firestore';
import { getMetadata, ref, type FirebaseStorage } from 'firebase/storage';

/** Debe coincidir con la marca de versión de firestore.rules y storage.rules. */
export const RULES_VERSION = 'v3';

export type RulesState = 'ok' | 'outdated' | 'unknown';

export const DEPLOY_COMMAND = 'npx firebase-tools deploy --only functions,firestore:rules,storage --project mi-bolsillo-2-22650111-8373c';

/**
 * Comprueba si las reglas publicadas en Firebase son las de esta versión de la app.
 * Las reglas nuevas permiten leer /_rules/v3 (aunque no exista); las viejas lo rechazan.
 */
export async function checkRules(db: Firestore, storage: FirebaseStorage): Promise<{ firestore: RulesState; storage: RulesState }> {
  const fs = await getDocFromServer(doc(db, '_rules', RULES_VERSION))
    .then((): RulesState => 'ok')
    .catch((e): RulesState => (e?.code === 'permission-denied' ? 'outdated' : 'unknown'));
  const st = await getMetadata(ref(storage, `_rules/${RULES_VERSION}`))
    .then((): RulesState => 'ok')
    .catch((e): RulesState => (e?.code === 'storage/object-not-found' ? 'ok' : e?.code === 'storage/unauthorized' ? 'outdated' : 'unknown'));
  return { firestore: fs, storage: st };
}
