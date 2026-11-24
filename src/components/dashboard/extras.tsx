'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Check, ChevronRight, Loader2, Repeat, UserPlus, X } from 'lucide-react';
import { useWallet } from '@/components/providers/wallet-provider';
import { useMarkRecurringPaid } from '@/components/recurring/use-mark-paid';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { daysUntil, formatMoney } from '@/lib/format';
import { recurringDate } from '@/lib/recurring';
import { cn } from '@/lib/utils';

/** Gastos fijos "a mano" que faltan anotar este mes. */
export function PendingRecurringCard() {
  const { recurring, currency, canEdit } = useWallet();
  const markPaid = useMarkRecurringPaid();
  const [busy, setBusy] = useState<string | null>(null);
  const month = format(new Date(), 'yyyy-MM');

  const pending = useMemo(
    () =>
      recurring
        .filter((r) => r.active && !r.autoCreate && (r.lastCreatedMonth ?? '') < month)
        .map((r) => ({ ...r, days: daysUntil(recurringDate(r.dayOfMonth, month)) }))
        .filter((r) => r.days <= 10)
        .sort((a, b) => a.days - b.days),
    [recurring, month]
  );

  if (!pending.length) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2">
          <Repeat className="h-4 w-4" /> Gastos fijos por pagar
        </CardTitle>
        <Button asChild variant="ghost" size="sm" className="text-primary">
          <Link href="/recurring">
            Ver <ChevronRight />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {pending.slice(0, 5).map((r) => (
          <div key={r.id} className="flex items-center gap-3 rounded-xl border p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{r.description}</p>
              <p className={cn('text-xs', r.days < 0 ? 'text-destructive' : r.days === 0 ? 'text-warning' : 'text-muted-foreground')}>
                {r.days < 0 ? `Era el día ${r.dayOfMonth}` : r.days === 0 ? 'Es hoy' : `Día ${r.dayOfMonth} · en ${r.days} días`}
              </p>
            </div>
            <span className="tabular text-sm font-semibold">{formatMoney(r.amount, currency)}</span>
            {canEdit && (
              <Button
                size="sm"
                variant="secondary"
                disabled={busy === r.id}
                onClick={async () => {
                  setBusy(r.id);
                  await markPaid(r);
                  setBusy(null);
                }}
              >
                {busy === r.id ? <Loader2 className="animate-spin" /> : <Check />} {r.type === 'income' ? 'Cobrado' : 'Pagado'}
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function InvitesBanner() {
  const { invites, acceptInvite, declineInvite } = useWallet();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  if (!invites.length) return null;
  return (
    <div className="space-y-2">
      {invites.map((inv) => (
        <div key={inv.id} className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-secondary/60 p-4 sm:flex-row sm:items-center">
          <UserPlus className="hidden h-5 w-5 shrink-0 text-primary sm:block" />
          <p className="flex-1 text-sm">
            <strong>{inv.invitedByName || 'Alguien'}</strong> te invitó a su libro <strong>“{inv.walletName}”</strong>
            {inv.role === 'reader' ? ' (sólo para ver)' : ' (podés anotar y editar)'}.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={busy === inv.id}
              onClick={async () => {
                setBusy(inv.id);
                try {
                  await acceptInvite(inv);
                  toast({ title: 'Invitación aceptada', description: `Ahora ves el libro “${inv.walletName}”.` });
                } catch (e) {
                  console.error(e);
                  toast({ variant: 'destructive', title: 'No se pudo aceptar la invitación' });
                } finally {
                  setBusy(null);
                }
              }}
            >
              <Check /> Aceptar
            </Button>
            <Button size="sm" variant="ghost" disabled={busy === inv.id} onClick={() => declineInvite(inv).catch(() => {})}>
              <X /> Rechazar
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
