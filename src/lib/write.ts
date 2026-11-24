import { toast } from '@/hooks/use-toast';

/**
 * Espera una escritura de Firestore sin colgar la interfaz cuando no hay señal.
 * Con la caché local, la escritura queda guardada en el dispositivo y se sube sola
 * al volver la conexión; la promesa recién se resuelve cuando el servidor confirma.
 */
export async function safeWrite(p: Promise<unknown>, errorTitle = 'No se pudo guardar'): Promise<'ok' | 'queued'> {
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;
  let settled = false;
  const guarded = p.then(
    () => {
      settled = true;
      return 'ok' as const;
    },
    (e) => {
      settled = true;
      throw e;
    }
  );
  const timeout = new Promise<'queued'>((resolve) => setTimeout(() => resolve('queued'), offline ? 400 : 8000));
  const result = await Promise.race([guarded, timeout]);
  if (result === 'queued' && !settled) {
    guarded.catch((e) => {
      console.error(e);
      toast({ variant: 'destructive', title: errorTitle, description: 'El cambio no se pudo sincronizar con el servidor.' });
    });
    return 'queued';
  }
  return result;
}

export const OFFLINE_NOTE = 'Sin conexión: quedó guardado en el teléfono y se sube solo cuando vuelva la señal.';
