'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { toast } from '@/hooks/use-toast';

/**
 * Escucha errores de permisos de Firestore emitidos globalmente y los muestra
 * como aviso, sin tumbar la aplicación entera (antes se lanzaba el error y
 * cualquier fallo de una consulta dejaba la app en una pantalla de error).
 */
export function FirebaseErrorListener() {
  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'No se pudo acceder a los datos',
        description: 'Revisá tu conexión o volvé a iniciar sesión.',
      });
    };
    errorEmitter.on('permission-error', handleError);
    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  return null;
}
