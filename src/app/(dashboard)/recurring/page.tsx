'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { CheckCircle2, Loader2, MoreVertical, Pause, Pencil, Play, Plus, Repeat, Trash2, Zap, BellRing } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useWallet } from '@/components/providers/wallet-provider';
import { PageHeader, EmptyState, CategoryDot, Segmented } from '@/components/shared/ui-bits';
import { deleteWithUndo } from '@/components/shared/undo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { formatDate, formatMoney, parseAmount } from '@/lib/format';
import { recurringDate } from '@/lib/recurring';
import { guessCategory } from '@/lib/auto-category';
import { useMarkRecurringPaid } from '@/components/recurring/use-mark-paid';
import { safeWrite } from '@/lib/write';
import { cn } from '@/lib/utils';
import type { Recurring } from '@/types';

function RecurringDialog({ open, onOpenChange, item }: { open: boolean; onOpenChange: (o: boolean) => void; item: Recurring | null }) {
  const db = useFirestore();
  const { toast } = useToast();
  const { activeWallet, authFields, categories, accounts, defaultAccountId, currency } = useWallet();
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [day, setDay] = useState('10');
  const [autoCreate, setAutoCreate] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType(item?.type ?? 'expense');
    setDescription(item?.description ?? '');
    setAmount(item ? String(item.amount).replace('.', ',') : '');
    setCategoryId(item?.categoryId ?? '');
    setAccountId(item?.accountId || defaultAccountId || '');
    setDay(String(item?.dayOfMonth ?? 10));
    setAutoCreate(item?.autoCreate ?? false);
  }, [open, item, defaultAccountId]);

  const cats = categories.filter((c) => !c.kind || c.kind === 'both' || c.kind === type);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWallet || !authFields) return;
    const value = parseAmount(amount);
    const d = Math.min(31, Math.max(1, Number(day) || 1));
    if (!description.trim() || !Number.isFinite(value) || value <= 0) {
      toast({ variant: 'destructive', title: 'Completá descripción y monto' });
      return;
    }
    const data = {
      type,
      description: description.trim(),
      amount: Math.round(value * 100) / 100,
      categoryId: categoryId || guessCategory(description, cats)?.id || '',
      accountId: accountId || defaultAccountId || '',
      paymentMethod: '',
      dayOfMonth: d,
      autoCreate,
    };
    setSaving(true);
    try {
      if (item) await safeWrite(updateDoc(doc(db, 'wallets', activeWallet.id, 'recurring', item.id), { ...data, updatedAt: serverTimestamp() }));
      else
        await safeWrite(
          setDoc(doc(collection(db, 'wallets', activeWallet.id, 'recurring')), {
            ...data,
            active: true,
            // Si el día de este mes ya pasó, arranca el mes que viene (no anota retroactivo)
            lastCreatedMonth: recurringDate(d, format(new Date(), 'yyyy-MM')) < format(new Date(), 'yyyy-MM-dd') ? format(new Date(), 'yyyy-MM') : null,
            ...authFields,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      toast({ title: item ? 'Gasto fijo actualizado' : 'Gasto fijo creado' });
      onOpenChange(false);
    } catch {
      toast({ variant: 'destructive', title: 'No se pudo guardar' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? 'Editar gasto fijo' : 'Nuevo gasto fijo'}</DialogTitle>
          <DialogDescription>Algo que se repite todos los meses: alquiler, luz, prepaga, sueldo…</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <Segmented
            value={type}
            onChange={setType}
            options={[
              { value: 'expense', label: 'Gasto', activeClass: 'text-expense' },
              { value: 'income', label: 'Ingreso', activeClass: 'text-income' },
            ]}
          />
          <div className="space-y-2">
            <Label htmlFor="r-desc">Descripción</Label>
            <Input id="r-desc" className="h-11" placeholder="Ej.: Alquiler" value={description} onChange={(e) => setDescription(e.target.value)} required autoFocus />
          </div>
          <div className="grid grid-cols-[1fr_110px] gap-3">
            <div className="space-y-2">
              <Label htmlFor="r-amount">Monto ({currency})</Label>
              <Input id="r-amount" inputMode="decimal" className="tabular h-11" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-day">Día del mes</Label>
              <Input id="r-day" type="number" min={1} max={31} inputMode="numeric" className="h-11" value={day} onChange={(e) => setDay(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select value={categoryId || undefined} onValueChange={setCategoryId}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Elegir" />
                </SelectTrigger>
                <SelectContent>
                  {cats.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <CategoryDot color={c.colorHex} /> {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cuenta</Label>
              <Select value={accountId || defaultAccountId || undefined} onValueChange={setAccountId}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accounts
                    .filter((a) => !a.archived && a.currency === currency)
                    .map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-start justify-between gap-4 rounded-xl border p-3">
            <div>
              <p className="text-sm font-semibold">Anotarlo solo</p>
              <p className="text-xs text-muted-foreground">
                {autoCreate ? 'Ese día se anota automáticamente (ideal para débitos automáticos).' : 'Te recordamos ese día y lo anotás con un toque cuando lo pagues.'}
              </p>
            </div>
            <Switch checked={autoCreate} onCheckedChange={setAutoCreate} aria-label="Anotar automáticamente" />
          </div>
          <DialogFooter>
            <Button type="submit" size="lg" className="h-12 w-full sm:w-auto" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />} Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function RecurringPage() {
  const db = useFirestore();
  const { toast } = useToast();
  const { recurring, categories, currency, activeWallet, canEdit } = useWallet();
  const markPaid = useMarkRecurringPaid();
  const [dialog, setDialog] = useState<{ open: boolean; item: Recurring | null }>({ open: false, item: null });
  const month = format(new Date(), 'yyyy-MM');
  const today = format(new Date(), 'yyyy-MM-dd');

  const totals = useMemo(() => {
    const act = recurring.filter((r) => r.active);
    return {
      expense: act.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amount, 0),
      income: act.filter((r) => r.type === 'income').reduce((s, r) => s + r.amount, 0),
      pending: act.filter((r) => (r.lastCreatedMonth ?? '') < month).length,
    };
  }, [recurring, month]);

  const toggle = async (r: Recurring) => {
    if (!activeWallet) return;
    await safeWrite(updateDoc(doc(db, 'wallets', activeWallet.id, 'recurring', r.id), { active: !r.active, updatedAt: serverTimestamp() }));
    toast({ title: r.active ? 'Pausado' : 'Reactivado' });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Repeat}
        title="Gastos fijos"
        description="Lo que se paga o se cobra todos los meses. Te avisamos o lo anotamos solo."
        actions={
          canEdit && (
            <Button onClick={() => setDialog({ open: true, item: null })}>
              <Plus /> Nuevo gasto fijo
            </Button>
          )
        }
      />

      {recurring.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div className="rounded-2xl border bg-card p-3 sm:p-4">
            <p className="text-[11px] text-muted-foreground sm:text-xs">Gastos por mes</p>
            <p className="tabular truncate text-sm font-bold sm:text-xl">{formatMoney(totals.expense, currency)}</p>
          </div>
          <div className="rounded-2xl border bg-card p-3 sm:p-4">
            <p className="text-[11px] text-muted-foreground sm:text-xs">Ingresos por mes</p>
            <p className="tabular truncate text-sm font-bold text-income sm:text-xl">{formatMoney(totals.income, currency)}</p>
          </div>
          <div className="rounded-2xl border bg-card p-3 sm:p-4">
            <p className="text-[11px] text-muted-foreground sm:text-xs">Faltan este mes</p>
            <p className="tabular text-sm font-bold sm:text-xl">{totals.pending}</p>
          </div>
        </div>
      )}

      {recurring.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="Sin gastos fijos"
          description="Cargá el alquiler, los servicios o la prepaga una sola vez y la app te los recuerda (o los anota sola) cada mes."
          action={
            canEdit && (
              <Button onClick={() => setDialog({ open: true, item: null })}>
                <Plus /> Crear el primero
              </Button>
            )
          }
        />
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {recurring.map((r) => {
              const cat = categories.find((c) => c.id === r.categoryId);
              const done = (r.lastCreatedMonth ?? '') >= month;
              const date = recurringDate(r.dayOfMonth, month);
              const late = !done && date < today;
              return (
                <div key={r.id} className={cn('flex items-center gap-3 p-4', !r.active && 'opacity-50')}>
                  <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-secondary text-secondary-foreground leading-none">
                    <span className="text-[10px] font-semibold uppercase">día</span>
                    <span className="text-base font-bold">{r.dayOfMonth}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate font-semibold">
                      {r.description}
                      {r.autoCreate ? <Zap className="h-3.5 w-3.5 text-accent" aria-label="Se anota solo" /> : <BellRing className="h-3.5 w-3.5 text-muted-foreground" aria-label="Recordatorio" />}
                    </p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CategoryDot color={cat?.colorHex} className="h-2 w-2" /> {cat?.name ?? 'Sin categoría'} ·{' '}
                      {!r.active ? 'Pausado' : done ? <span className="text-income">Anotado este mes</span> : late ? <span className="text-destructive">Venció el {formatDate(date, 'd/M')}</span> : `Próximo: ${formatDate(date, "d 'de' MMM")}`}
                    </p>
                  </div>
                  <span className={cn('tabular font-semibold', r.type === 'income' && 'text-income')}>
                    {r.type === 'income' ? '+' : '−'}
                    {formatMoney(r.amount, currency)}
                  </span>
                  {canEdit && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="-mr-2 h-9 w-9 rounded-full" aria-label={`Opciones de ${r.description}`}>
                          <MoreVertical />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl">
                        {r.active && !done && (
                          <DropdownMenuItem className="gap-2" onClick={() => markPaid(r)}>
                            <CheckCircle2 className="h-4 w-4" /> {r.type === 'income' ? 'Ya lo cobré' : 'Ya lo pagué'}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="gap-2" onClick={() => setDialog({ open: true, item: r })}>
                          <Pencil className="h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2" onClick={() => toggle(r)}>
                          {r.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />} {r.active ? 'Pausar' : 'Reactivar'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="gap-2 text-destructive focus:text-destructive"
                          onClick={() => activeWallet && deleteWithUndo(db, [{ ref: doc(db, 'wallets', activeWallet.id, 'recurring', r.id), data: r }], 'Gasto fijo eliminado')}
                        >
                          <Trash2 className="h-4 w-4" /> Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
      <p className="text-xs text-muted-foreground">
        <Zap className="inline h-3 w-3 text-accent" /> se anota solo · <BellRing className="inline h-3 w-3" /> te avisa para que lo anotes. Eliminar un gasto fijo no borra los movimientos ya anotados.
      </p>
      <RecurringDialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} item={dialog.item} />
    </div>
  );
}
