'use client';

import { writeBatch, type DocumentReference, type Firestore } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { safeWrite } from '@/lib/write';

const UNDO_MS = 8000;

/**
 * Borra uno o varios documentos y muestra un aviso con "Deshacer" durante 8 segundos.
 * `data` debe ser el documento completo (con sus campos de autorización) para poder restaurarlo.
 * `onFinal` corre sólo si no se deshizo (p. ej. borrar fotos de Storage).
 */
export async function deleteWithUndo(
  db: Firestore,
  docs: { ref: DocumentReference; data: Record<string, any> }[],
  title: string,
  onFinal?: () => void
) {
  const batch = writeBatch(db);
  docs.forEach((d) => batch.delete(d.ref));
  await safeWrite(batch.commit(), 'No se pudo eliminar');

  let undone = false;
  const timer = setTimeout(() => {
    if (!undone) onFinal?.();
  }, UNDO_MS + 500);

  const restore = async () => {
    undone = true;
    clearTimeout(timer);
    const b = writeBatch(db);
    docs.forEach(({ ref, data }) => {
      const { id: _id, ...rest } = data;
      b.set(ref, rest);
    });
    await safeWrite(b.commit(), 'No se pudo restaurar');
    toast({ title: 'Listo, se restauró' });
  };

  toast({
    title,
    duration: UNDO_MS,
    action: (
      <ToastAction altText="Deshacer" onClick={restore} className="rounded-lg font-semibold">
        Deshacer
      </ToastAction>
    ),
  });
}
