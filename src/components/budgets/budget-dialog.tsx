'use client';

import { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useWallet } from '@/components/providers/wallet-provider';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CategoryDot } from '@/components/shared/ui-bits';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { safeWrite } from '@/lib/write';
import { parseAmount } from '@/lib/format';
import type { Budget } from '@/types';

export function BudgetDialog({ open, onOpenChange, budget }: { open: boolean; onOpenChange: (o: boolean) => void; budget?: Budget | null }) {
  const db = useFirestore();
  const { toast } = useToast();
  const { activeWallet, authFields, categories, budgets } = useWallet();
  const isEdit = !!budget;
  const [categoryId, setCategoryId] = useState('');
  const [name, setName] = useState('');
  const [limit, setLimit] = useState('');
  const [saving, setSaving] = useState(false);

  const expenseCats = useMemo(() => categories.filter((c) => c.kind !== 'income'), [categories]);
  const usedIds = new Set(budgets.filter((b) => b.id !== budget?.id).map((b) => b.categoryId));

  useEffect(() => {
    if (!open) return;
    setCategoryId(budget?.categoryId ?? '');
    setName(budget?.name ?? '');
    setLimit(budget ? String(budget.limitAmount).replace('.', ',') : '');
  }, [open, budget]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWallet || !authFields) return;
    const value = parseAmount(limit);
    if (!categoryId) {
      toast({ variant: 'destructive', title: 'Elegí una categoría' });
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      toast({ variant: 'destructive', title: 'Revisá el límite', description: 'Tiene que ser un número mayor a cero.' });
      return;
    }
    const catName = categories.find((c) => c.id === categoryId)?.name ?? 'Presupuesto';
    const data = { categoryId, name: name.trim() || catName, limitAmount: Math.round(value * 100) / 100, periodType: 'monthly' as const };
    setSaving(true);
    try {
      if (isEdit) {
        await safeWrite(updateDoc(doc(db, 'wallets', activeWallet.id, 'budgets', budget!.id), { ...data, updatedAt: serverTimestamp() }));
        toast({ title: 'Presupuesto actualizado' });
      } else {
        await safeWrite(addDoc(collection(db, 'wallets', activeWallet.id, 'budgets'), {
          ...data,
          walletId: activeWallet.id,
          ...authFields,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }));
        toast({ title: 'Presupuesto creado', description: 'Te avisaremos cuando llegues al 80%.' });
      }
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'No se pudo guardar el presupuesto' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar presupuesto' : 'Nuevo presupuesto'}</DialogTitle>
          <DialogDescription>Un tope mensual de gasto para una categoría.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Categoría</Label>
            <Select value={categoryId || undefined} onValueChange={setCategoryId}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Elegí una categoría" />
              </SelectTrigger>
              <SelectContent>
                {expenseCats.map((c) => (
                  <SelectItem key={c.id} value={c.id} disabled={usedIds.has(c.id)}>
                    <span className="flex items-center gap-2">
                      <CategoryDot color={c.colorHex} />
                      {c.name}
                      {usedIds.has(c.id) && <span className="text-xs text-muted-foreground">(ya tiene)</span>}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="b-limit">Límite por mes</Label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-xl font-semibold text-muted-foreground">$</span>
              <Input id="b-limit" inputMode="decimal" placeholder="0,00" className="tabular h-14 pl-9 text-2xl font-bold md:text-2xl" value={limit} onChange={(e) => setLimit(e.target.value.replace(/[^\d.,]/g, ''))} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="b-name">
              Nombre <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input id="b-name" placeholder="Ej.: Súper del mes" className="h-11" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <DialogFooter className="pt-2">
            <Button type="submit" size="lg" className="h-12 w-full sm:w-auto" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              {isEdit ? 'Guardar cambios' : 'Crear presupuesto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
