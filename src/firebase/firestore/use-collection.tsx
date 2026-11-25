'use client';

import { useState, useEffect } from 'react';
import {
  Query,
  onSnapshot,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/** Utility type to add an 'id' field to a given type T. */
export type WithId<T> = T & { id: string };

/**
 * Interface for the return value of the useCollection hook.
 * @template T Type of the document data.
 */
export interface UseCollectionResult<T> {
  data: WithId<T>[] | null; // Document data with ID, or null.
  isLoading: boolean;       // True if loading.
  error: FirestoreError | Error | null; // Error object, or null.
}

/* Internal implementation of Query:
  https://github.com/firebase/firebase-js-sdk/blob/c5f08a9bc5da0d2b0207802c972d53724ccef055/packages/firestore/src/lite-api/reference.ts#L143
*/
export interface InternalQuery extends Query<DocumentData> {
  _query: {
    path: {
      canonicalString(): string;
      toString(): string;
    }
  }
}

/**
 * React hook to subscribe to a Firestore collection or query in real-time.
 * Handles nullable references/queries.
 * 
 *
 * IMPORTANT! YOU MUST MEMOIZE the inputted memoizedTargetRefOrQuery or BAD THINGS WILL HAPPEN
 * use useMemo to memoize it per React guidence.  Also make sure that it's dependencies are stable
 * references
 *  
 * @template T Optional type for document data. Defaults to any.
 * @param {CollectionReference<DocumentData> | Query<DocumentData> | null | undefined} targetRefOrQuery -
 * The Firestore CollectionReference or Query. Waits if null/undefined.
 * @returns {UseCollectionResult<T>} Object with data, isLoading, error.
 */
export function useCollection<T = any>(
    memoizedTargetRefOrQuery: ((CollectionReference<DocumentData> | Query<DocumentData>) & {__memo?: boolean})  | null | undefined,
    options?: {
      /** Consultas secundarias (p. ej. invitaciones): si fallan no se avisa al usuario. */
      silent?: boolean;
      /** Nombre amigable para el aviso de error ("los cheques", "las categorías"…). */
      label?: string;
    },
): UseCollectionResult<T> {
  const silent = !!options?.silent;
  const label = options?.label;
  type ResultItemType = WithId<T>;
  type StateDataType = ResultItemType[] | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  useEffect(() => {
    if (!memoizedTargetRefOrQuery) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    // Al cambiar de consulta no mostrar datos de la anterior (p. ej. de otro libro)
    setData(null);

    let unsubscribe: () => void = () => {};
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let cancelled = false;

    const subscribe = () => {
      unsubscribe = onSnapshot(
        memoizedTargetRefOrQuery,
        (snapshot: QuerySnapshot<DocumentData>) => {
          attempt = 0;
          const results: ResultItemType[] = [];
          for (const doc of snapshot.docs) {
            results.push({ ...(doc.data() as T), id: doc.id });
          }
          setData(results);
          setError(null);
          setIsLoading(false);
        },
        (error: FirestoreError) => {
          // Recién creado un libro (o aceptada una invitación), el servidor puede tardar un instante
          // en reflejar el acceso: se reintenta antes de dar el error por definitivo.
          if (!cancelled && attempt < 4 && ['permission-denied', 'unavailable', 'resource-exhausted'].includes(error.code)) {
            attempt++;
            retryTimer = setTimeout(() => !cancelled && subscribe(), 600 * attempt);
            return;
          }
          const path: string =
            memoizedTargetRefOrQuery.type === 'collection'
              ? (memoizedTargetRefOrQuery as CollectionReference).path
              : (memoizedTargetRefOrQuery as unknown as InternalQuery)._query.path.canonicalString();

          const contextualError = new FirestorePermissionError({ operation: 'list', path });
          // Conservar el código original (permission-denied, failed-precondition, unavailable…)
          (contextualError as any).code = error.code;
          setError(contextualError);
          setData(null);
          setIsLoading(false);
          (contextualError as any).label = label;
          console.error(`[Mi Bolsillo] No se pudo leer ${label ?? path}`, error.code, error.message);
          if (!silent) errorEmitter.emit('permission-error', contextualError);
        }
      );
    };
    subscribe();

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memoizedTargetRefOrQuery]); // Re-run if the target query/reference changes.
  if(memoizedTargetRefOrQuery && !memoizedTargetRefOrQuery.__memo) {
    throw new Error(memoizedTargetRefOrQuery + ' was not properly memoized using useMemoFirebase');
  }
  return { data, isLoading, error };
}