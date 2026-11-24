'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { doc } from 'firebase/firestore';
import { deleteWithUndo } from '@/components/shared/undo';
import { MoreVertical, Pencil, Plus, Target, Trash2 } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useWallet } from '@/components/providers/wallet-provider';
import { BudgetDialog } from '@/components/budgets/budget-dialog';
import { PageHeader, EmptyState, CategoryDot } from '@/components/shared/ui-bits';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMoney } from '@/lib/format';
import { monthSpentByCategory } from '@/lib/alerts';
import { cn } from '@/lib/utils';
import type { Budget } from '@/types';

export default function BudgetsPage() {
  const db = useFirestore();
  const { budgets, bookTransactions: transactions, categories, currency, activeWallet, isDataLoading, canEdit } = useWallet();
  const [dialog, setDialog] = useState<{ open: boolean; budget: Budget | null }>({ open: false, budget: null });

  const spent = useMemo(() => monthSpentByCategory(transactions), [transactions]);
  const totalLimit = budgets.reduce((s, b) => s + b.limitAmount, 0);
  const totalUsed = budgets.reduce((s, b) => s + (spent.get(b.categoryId) ?? 0), 0);
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const dayOfMonth = new Date().getDate();

  const remove = async (b: Budget) => {
    if (!activeWallet) return;
    await deleteWithUndo(db, [{ ref: doc(db, 'wallets', activeWallet.id, 'budgets', b.id), data: b }], 'Presupuesto eliminado');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Target}
        title="Presupuestos"
        description={<span className="first-letter:uppercase">Topes de gasto para {format(new Date(), 'MMMM', { locale: es })}. Se reinician cada mes.</span>}
        actions={
          <Button onClick={() => setDialog({ open: true, budget: null })}>
            <Plus /> Nuevo presupuesto
          </Button>
        }
      />

      {budgets.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Gastado en categorías con presupuesto</p>
                <p className="tabular font-headline text-2xl font-extrabold">
                  {formatMoney(totalUsed, currency)} <span className="text-base font-semibold text-muted-foreground">de {formatMoney(totalLimit, currency)}</span>
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                Día {dayOfMonth} de {daysInMonth}
              </p>
            </div>
            <div className="relative mt-4 h-3 overflow-hidden rounded-full bg-muted">
              <div className={cn('h-full rounded-full', totalUsed > totalLimit ? 'bg-destructive' : 'bg-primary')} style={{ width: `${Math.min(100, (totalUsed / (totalLimit || 1)) * 100)}%` }} />
              {/* Marca de "dónde debería ir" según el día del mes */}
              <div className="absolute inset-y-0 w-0.5 bg-foreground/40" style={{ left: `${(dayOfMonth / daysInMonth) * 100}%` }} title="Ritmo ideal según el día del mes" />
            </div>
          </CardContent>
        </Card>
      )}

      {isDataLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : budgets.length ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {budgets.map((b) => {
            const used = spent.get(b.categoryId) ?? 0;
            const pct = b.limitAmount ? used / b.limitAmount : 0;
            const cat = categories.find((c) => c.id === b.categoryId);
            const left = b.limitAmount - used;
            const state = pct >= 1 ? 'over' : pct >= 0.8 ? 'near' : 'ok';
            return (
              <Card key={b.id} className={cn(state === 'over' && 'border-destructive/40', state === 'near' && 'border-warning/50')}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate font-headline text-lg font-bold">
                        {cat?.name === b.name && <CategoryDot color={cat?.colorHex} className="h-3 w-3" />}
                        {b.name}
                      </p>
                      {(!cat || cat.name !== b.name) && (
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CategoryDot color={cat?.colorHex} /> {cat?.name ?? 'Categoría eliminada'}
                        </p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="-mr-2 -mt-2 h-9 w-9 rounded-full" aria-label="Opciones">
                          <MoreVertical />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl">
                        <DropdownMenuItem className="gap-2" onClick={() => setDialog({ open: true, budget: b })}>
                          <Pencil className="h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive" onClick={() => remove(b)}>
                          <Trash2 className="h-4 w-4" /> Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <p className="tabular mt-4 text-2xl font-extrabold">
                    {formatMoney(used, currency)}
                    <span className="ml-1 text-sm font-medium text-muted-foreground">/ {formatMoney(b.limitAmount, currency)}</span>
                  </p>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn('h-full rounded-full transition-all', state === 'over' ? 'bg-destructive' : state === 'near' ? 'bg-warning' : 'bg-primary')}
                      style={{ width: `${Math.min(100, pct * 100)}%` }}
                    />
                  </div>
                  <p className={cn('mt-2 text-sm font-medium', state === 'over' ? 'text-destructive' : state === 'near' ? 'text-warning' : 'text-muted-foreground')}>
                    {state === 'over' ? `Te pasaste por ${formatMoney(-left, currency)}` : `Te quedan ${formatMoney(left, currency)} (${Math.round(pct * 100)}% usado)`}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Target}
          title="Sin presupuestos todavía"
          description="Definí cuánto querés gastar por mes en cada categoría (por ejemplo, Supermercado) y te avisamos cuando estés cerca del límite."
          action={
            <Button onClick={() => setDialog({ open: true, budget: null })}>
              <Plus /> Crear el primero
            </Button>
          }
        />
      )}

      <BudgetDialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} budget={dialog.budget} />
    </div>
  );
}
