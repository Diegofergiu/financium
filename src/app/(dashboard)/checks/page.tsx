'use client';

import { useMemo, useState } from 'react';
import { Plus, ScanLine, Ticket } from 'lucide-react';
import { useScan } from '@/components/scan/scan-provider';
import { useWallet } from '@/components/providers/wallet-provider';
import { CheckDialog } from '@/components/checks/check-dialog';
import { CheckCard } from '@/components/checks/check-card';
import { PageHeader, EmptyState, Segmented } from '@/components/shared/ui-bits';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMoney } from '@/lib/format';
import type { Check, CheckType } from '@/types';

type Tab = 'all' | CheckType;
type StatusFilter = 'pending' | 'done';

export default function ChecksPage() {
  const { checks, currency, isDataLoading, canEdit } = useWallet();
  const { scan } = useScan();
  const [tab, setTab] = useState<Tab>('all');
  const [status, setStatus] = useState<StatusFilter>('pending');
  const [dialog, setDialog] = useState<{ open: boolean; check: Check | null }>({ open: false, check: null });

  const totals = useMemo(() => {
    const pending = checks.filter((c) => c.status === 'pending');
    return {
      toCollect: pending.filter((c) => c.type === 'toCollect').reduce((s, c) => s + c.amount, 0),
      toPay: pending.filter((c) => c.type === 'issued').reduce((s, c) => s + c.amount, 0),
      countCollect: pending.filter((c) => c.type === 'toCollect').length,
      countPay: pending.filter((c) => c.type === 'issued').length,
    };
  }, [checks]);

  const list = useMemo(() => {
    const filtered = checks.filter((c) => (tab === 'all' || c.type === tab) && (status === 'pending' ? c.status === 'pending' : c.status !== 'pending'));
    // Pendientes: el más próximo primero. Historial: el más reciente primero.
    return status === 'pending' ? filtered : filtered.slice().reverse();
  }, [checks, tab, status]);

  const openNew = () => setDialog({ open: true, check: null });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Ticket}
        title="Cheques"
        description="Los que tenés que cobrar y los que tenés que pagar, con aviso antes del vencimiento."
        actions={
          canEdit && (
            <>
              <Button variant="outline" onClick={scan}>
                <ScanLine /> Escanear cheque
              </Button>
              <Button onClick={openNew}>
                <Plus /> Nuevo cheque
              </Button>
            </>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">A cobrar · {totals.countCollect}</p>
          <p className="tabular mt-1 text-lg font-bold text-income sm:text-2xl">{formatMoney(totals.toCollect, currency)}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">A pagar · {totals.countPay}</p>
          <p className="tabular mt-1 text-lg font-bold sm:text-2xl">{formatMoney(totals.toPay, currency)}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Segmented
          className="sm:w-80"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'all', label: 'Todos' },
            { value: 'toCollect', label: 'A cobrar' },
            { value: 'issued', label: 'A pagar' },
          ]}
        />
        <Segmented
          className="sm:w-64"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'pending', label: 'Pendientes' },
            { value: 'done', label: 'Historial' },
          ]}
        />
      </div>

      {isDataLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : list.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((c) => (
            <CheckCard key={c.id} check={c} onEdit={(check) => setDialog({ open: true, check })} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Ticket}
          title={status === 'pending' ? 'No hay cheques pendientes' : 'Todavía no hay historial'}
          description={
            status === 'pending'
              ? 'Registrá los cheques que recibís o entregás y te avisamos antes de que venzan.'
              : 'Cuando marques un cheque como cobrado, pagado, rechazado o anulado, aparecerá acá.'
          }
          action={
            status === 'pending' ? (
              <Button onClick={openNew}>
                <Plus /> Registrar cheque
              </Button>
            ) : undefined
          }
        />
      )}

      <CheckDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        check={dialog.check}
        defaultType={tab === 'issued' ? 'issued' : 'toCollect'}
      />
    </div>
  );
}
