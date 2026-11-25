'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { toast } from '@/hooks/use-toast';

/**
 * Muestra un aviso cuando una lectura importante de Firestore falla, sin tumbar la app.
 * Agrupa los errores (un solo aviso cada 30 s) e indica qué dato no se pudo leer.
 */
export function FirebaseErrorListener() {
  useEffect(() => {
    let last = 0;
    const handleError = (error: FirestorePermissionError) => {
      const code = (error as any).code as string | undefined;
      const label = (error as any).label as string | undefined;
      // Sin conexión o sesión que se está renovando: Firestore se recupera solo
      if (code === 'unavailable' || code === 'cancelled' || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
      const now = Date.now();
      if (now - last < 30000) return;
      last = now;
      toast({
        variant: 'destructive',
        title: label ? `No se pudieron cargar ${label}` : 'No se pudo acceder a los datos',
        description:
          code === 'permission-denied'
            ? 'La base de datos rechazó el acceso. Si recién se actualizó la app, falta publicar las reglas nuevas de Firestore.'
            : 'Revisá tu conexión. Si sigue pasando, cerrá sesión y volvé a entrar.',
      });
    };
    errorEmitter.on('permission-error', handleError);
    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  return null;
}
