'use client';

import { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Pencil, Plus, Trash2, Loader2, Check as CheckIcon } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useWallet } from '@/components/providers/wallet-provider';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CategoryDot, ConfirmDialog, Segmented } from '@/components/shared/ui-bits';
import { useToast } from '@/hooks/use-toast';
import { CATEGORY_COLORS } from '@/lib/defaults';
import { cn } from '@/lib/utils';
import type { Category, CategoryKind } from '@/types';

const KIND_LABEL: Record<CategoryKind, string> = { expense: 'Gasto', income: 'Ingreso', both: 'Ambos' };

function CategoryDialog({ open, onOpenChange, category }: { open: boolean; onOpenChange: (o: boolean) => void; category: Category | null }) {
  const db = useFirestore();
  const { toast } = useToast();
  const { activeWallet, authFields } = useWallet();
  const [name, setName] = useState('');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [kind, setKind] = useState<CategoryKind>('expense');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? '');
    setColor(category?.colorHex ?? CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)]);
    setKind(category?.kind ?? 'expense');
  }, [open, category]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWallet || !authFields || !name.trim()) return;
    setSaving(true);
    const data = { name: name.trim(), colorHex: color, kind };
    try {
      if (category) await updateDoc(doc(db, 'wallets', activeWallet.id, 'categories', category.id), { ...data, updatedAt: serverTimestamp() });
      else
        await addDoc(collection(db, 'wallets', activeWallet.id, 'categories'), {
          ...data,
          walletId: activeWallet.id,
          ...authFields,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      toast({ title: category ? 'Categoría actualizada' : 'Categoría creada' });
      onOpenChange(false);
    } catch {
      toast({ variant: 'destructive', title: 'No se pudo guardar la categoría' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{category ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
          <DialogDescription>Las categorías te ayudan a ver en qué se va la plata.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cat-name">Nombre</Label>
            <Input id="cat-name" className="h-11" placeholder="Ej.: Mascotas" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div className="space-y-2">
            <Label>Se usa para</Label>
            <Segmented
              value={kind}
              onChange={setKind}
              options={[
                { value: 'expense', label: 'Gastos' },
                { value: 'income', label: 'Ingresos' },
                { value: 'both', label: 'Ambos' },
              ]}
            />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="grid grid-cols-6 gap-2">
              {CATEGORY_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn('flex h-10 items-center justify-center rounded-xl ring-offset-2 ring-offset-card transition', color === c && 'ring-2 ring-foreground')}
                  style={{ backgroundColor: c }}
                  aria-label={`Color ${c}`}
                >
                  {color === c && <CheckIcon className="h-4 w-4 text-white" />}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" size="lg" className="h-12 w-full sm:w-auto" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CategoryManager() {
  const db = useFirestore();
  const { toast } = useToast();
  const { categories, transactions, budgets, activeWallet } = useWallet();
  const [dialog, setDialog] = useState<{ open: boolean; category: Category | null }>({ open: false, category: null });
  const [toDelete, setToDelete] = useState<Category | null>(null);

  const usage = (id: string) => transactions.filter((t) => t.categoryId === id).length;

  const remove = async () => {
    if (!toDelete || !activeWallet) return;
    try {
      await deleteDoc(doc(db, 'wallets', activeWallet.id, 'categories', toDelete.id));
      toast({ title: 'Categoría eliminada' });
    } catch {
      toast({ variant: 'destructive', title: 'No se pudo eliminar' });
    }
    setToDelete(null);
  };

  return (
    <div className="space-y-3">
      <ul className="divide-y rounded-xl border">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
            <CategoryDot color={c.colorHex} className="h-3.5 w-3.5" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{c.name}</span>
              <span className="block text-xs text-muted-foreground">
                {KIND_LABEL[c.kind ?? 'both']} · {usage(c.id)} movimientos
              </span>
            </span>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => setDialog({ open: true, category: c })} aria-label={`Editar ${c.name}`}>
              <Pencil />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-muted-foreground hover:text-destructive" onClick={() => setToDelete(c)} aria-label={`Eliminar ${c.name}`}>
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
      <Button variant="outline" onClick={() => setDialog({ open: true, category: null })}>
        <Plus /> Agregar categoría
      </Button>
      <CategoryDialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} category={dialog.category} />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`¿Eliminar "${toDelete?.name}"?`}
        description={
          toDelete && (usage(toDelete.id) || budgets.some((b) => b.categoryId === toDelete.id))
            ? `Hay ${usage(toDelete.id)} movimiento(s) con esta categoría: quedarán como "Sin categoría". Los presupuestos asociados dejarán de contar.`
            : 'No hay movimientos con esta categoría.'
        }
        onConfirm={remove}
      />
    </div>
  );
}
