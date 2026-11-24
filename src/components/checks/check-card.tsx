'use client';

import { useState } from 'react';
import { MoreVertical, CheckCircle2, XCircle, Ban, RotateCcw, Pencil, Trash2, Landmark, CalendarClock } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/ui-bits';
import { useWallet } from '@/components/providers/wallet-provider';
import { useCheckActions } from './check-dialog';
import { daysUntil, formatDate, formatMoney, relativeDays } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Check } from '@/types';

const STATUS: Record<Check['status'], { label: string; className: string }> = {
  pending: { label: 'Pendiente', className: 'bg-secondary text-secondary-foreground' },
  cleared: { label: 'Cobrado', className: 'bg-income/15 text-income' },
  rejected: { label: 'Rechazado', className: 'bg-destructive/10 text-destructive' },
  cancelled: { label: 'Anulado', className: 'bg-muted text-muted-foreground' },
};

export function CheckCard({ check, onEdit, compact }: { check: Check; onEdit?: (c: Check) => void; compact?: boolean }) {
  const { currency } = useWallet();
  const { setStatus, remove } = useCheckActions();
  const [confirm, setConfirm] = useState(false);
  const days = daysUntil(check.dueDate);
  const pending = check.status === 'pending';
  const overdue = pending && days < 0;
  const soon = pending && days >= 0 && days <= 3;
  const toCollect = check.type === 'toCollect';
  const statusInfo = check.status === 'cleared' && !toCollect ? { ...STATUS.cleared, label: 'Pagado' } : STATUS[check.status];

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-2xl border bg-card p-3.5 transition-colors sm:p-4',
        overdue && 'border-destructive/40 bg-destructive/[0.04]',
        soon && 'border-warning/50 bg-warning/[0.05]',
        !pending && 'opacity-80'
      )}
    >
      <div className={cn('flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl text-center leading-none', toCollect ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense')}>
        <span className="text-base font-bold">{formatDate(check.dueDate, 'd')}</span>
        <span className="text-[10px] font-semibold uppercase">{formatDate(check.dueDate, 'MMM').replace('.', '')}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold">{check.issuerRecipient || 'Sin nombre'}</p>
            <p className="text-xs text-muted-foreground">{toCollect ? 'A cobrar' : 'A pagar'}{check.checkNumber ? ` · N° ${check.checkNumber}` : ''}</p>
          </div>
          <span className={cn('tabular shrink-0 text-[15px] font-bold', toCollect ? 'text-income' : 'text-foreground')}>
            {toCollect ? '+' : '−'}
            {formatMoney(check.amount, currency)}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
          <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold', statusInfo.className)}>{statusInfo.label}</span>
          {pending && (
            <span className={cn('inline-flex items-center gap-1 font-medium', overdue && 'text-destructive', soon && 'text-warning')}>
              <CalendarClock className="h-3.5 w-3.5" />
              {relativeDays(days)}
            </span>
          )}
          {!compact && check.bank && (
            <span className="inline-flex items-center gap-1">
              <Landmark className="h-3.5 w-3.5" />
              {check.bank}
            </span>
          )}
        </div>
        {!compact && pending && (
          <Button size="sm" variant="secondary" className="mt-3 h-9" onClick={() => setStatus(check, 'cleared')}>
            <CheckCircle2 /> {toCollect ? 'Marcar como cobrado' : 'Marcar como pagado'}
          </Button>
        )}
      </div>
      {!compact && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="-mr-1 -mt-1 h-9 w-9 shrink-0 rounded-full" aria-label="Opciones del cheque">
              <MoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 rounded-xl">
            {pending ? (
              <>
                <DropdownMenuItem className="gap-2" onClick={() => setStatus(check, 'cleared')}>
                  <CheckCircle2 className="h-4 w-4" /> {toCollect ? 'Cobrado' : 'Pagado'}
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2" onClick={() => setStatus(check, 'rejected')}>
                  <XCircle className="h-4 w-4" /> Rechazado
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2" onClick={() => setStatus(check, 'cancelled')}>
                  <Ban className="h-4 w-4" /> Anulado
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem className="gap-2" onClick={() => setStatus(check, 'pending')}>
                <RotateCcw className="h-4 w-4" /> Volver a pendiente
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {onEdit && (
              <DropdownMenuItem className="gap-2" onClick={() => onEdit(check)}>
                <Pencil className="h-4 w-4" /> Editar
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive" onClick={() => setConfirm(true)}>
              <Trash2 className="h-4 w-4" /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="¿Eliminar este cheque?"
        description={check.transactionId ? 'También se eliminará el movimiento que se generó al cobrarlo/pagarlo.' : 'Esta acción no se puede deshacer.'}
        onConfirm={() => remove(check)}
      />
    </div>
  );
}
