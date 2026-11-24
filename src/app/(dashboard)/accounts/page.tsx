'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { Archive, ArchiveRestore, ArrowLeftRight, Banknote, CreditCard, DollarSign, Landmark, Loader2, MoreVertical, Pencil, PiggyBank, Plus, Smartphone, Trash2, Wallet as WalletIcon } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useWallet } from '@/components/providers/wallet-provider';
import { useTransactionDialog } from '@/components/transactions/transaction-dialog';
import { PageHeader } from '@/components/shared/ui-bits';
import { deleteWithUndo } from '@/components/shared/undo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { CATEGORY_COLORS } from '@/lib/defaults';
import { CURRENCIES, formatMoney, parseAmount } from '@/lib/format';
import { ACCOUNT_KINDS, accountIdOf } from '@/lib/finance';
import { getManualRate, getPreferredCasa, setManualRate, setPreferredCasa, useDollarQuotes } from '@/lib/dollar';
import { safeWrite } from '@/lib/write';
import { cn } from '@/lib/utils';
import type { Account } from '@/types';

const KIND_ICON = { cash: Banknote, bank: Landmark, wallet: Smartphone, savings: PiggyBank, card: CreditCard } as const;

function AccountDialog({ open, onOpenChange, account }: { open: boolean; onOpenChange: (o: boolean) => void; account: Account | null }) {
  const db = useFirestore();
  const { toast } = useToast();
  const { activeWallet, authFields, currency, accounts } = useWallet();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<Account['kind']>('cash');
  const [cur, setCur] = useState(currency);
  const [initial, setInitial] = useState('');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(account?.name ?? '');
    setKind(account?.kind ?? 'cash');
    setCur(account?.currency ?? currency);
    setInitial(account ? String(account.initialBalance ?? 0).replace('.', ',') : '');
    setColor(account?.colorHex ?? CATEGORY_COLORS[accounts.length % CATEGORY_COLORS.length]);
  }, [open, account, currency, accounts.length]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWallet || !authFields || !name.trim()) return;
    const init = initial.trim() ? parseAmount(initial.replace(/^-/, '')) * (initial.trim().startsWith('-') ? -1 : 1) : 0;
    if (!Number.isFinite(init)) {
      toast({ variant: 'destructive', title: 'Revisá el saldo inicial' });
      return;
    }
    const data = { name: name.trim(), kind, currency: cur, initialBalance: Math.round(init * 100) / 100, colorHex: color };
    setSaving(true);
    try {
      if (account) await safeWrite(updateDoc(doc(db, 'wallets', activeWallet.id, 'accounts', account.id), { ...data, updatedAt: serverTimestamp() }));
      else
        await safeWrite(
          setDoc(doc(collection(db, 'wallets', activeWallet.id, 'accounts')), {
            ...data,
            order: accounts.length,
            archived: false,
            ...authFields,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      toast({ title: account ? 'Cuenta actualizada' : 'Cuenta creada' });
      onOpenChange(false);
    } catch {
      toast({ variant: 'destructive', title: 'No se pudo guardar la cuenta' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{account ? 'Editar cuenta' : 'Nueva cuenta'}</DialogTitle>
          <DialogDescription>Dónde está la plata: efectivo, banco, Mercado Pago, ahorros en dólares…</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="acc-name">Nombre</Label>
            <Input id="acc-name" className="h-11" placeholder="Ej.: Mercado Pago" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as Account['kind'])}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Moneda</Label>
              <Select value={cur} onValueChange={setCur}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="acc-init">Saldo con el que empieza</Label>
            <Input id="acc-init" inputMode="decimal" className="tabular h-11" placeholder="0,00" value={initial} onChange={(e) => setInitial(e.target.value.replace(/[^\d.,-]/g, ''))} />
            <p className="text-xs text-muted-foreground">Lo que había en esta cuenta antes de empezar a usar la app.</p>
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="grid grid-cols-6 gap-2">
              {CATEGORY_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} className={cn('h-9 rounded-xl ring-offset-2 ring-offset-card', color === c && 'ring-2 ring-foreground')} style={{ backgroundColor: c }} aria-label={`Color ${c}`} />
              ))}
            </div>
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

function DollarCard() {
  const { quotes, error } = useDollarQuotes(true);
  const [manual, setManual] = useState<string>('');
  useEffect(() => setManual(getManualRate() ? String(getManualRate()).replace('.', ',') : ''), []);
  const main = ['oficial', 'blue', 'bolsa', 'tarjeta'];
  const list = (quotes ?? []).filter((q) => main.includes(q.casa));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <DollarSign className="h-4 w-4" /> Dólar hoy
        </CardTitle>
        <CardDescription>{error && !quotes ? 'No pudimos traer la cotización. Podés cargarla a mano.' : 'Fuente: dolarapi.com'}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {list.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {list.map((q) => (
              <div key={q.casa} className="rounded-xl border p-3">
                <p className="text-xs font-medium text-muted-foreground">{q.nombre}</p>
                <p className="tabular text-sm">
                  <span className="text-muted-foreground">C</span> <span className="font-semibold">{q.compra ? formatMoney(q.compra, 'ARS') : '—'}</span>
                </p>
                <p className="tabular text-sm">
                  <span className="text-muted-foreground">V</span> <span className="font-semibold">{q.venta ? formatMoney(q.venta, 'ARS') : '—'}</span>
                </p>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="manual-rate" className="text-xs">
              Cotización propia <span className="font-normal text-muted-foreground">(opcional, pisa la de internet)</span>
            </Label>
            <Input id="manual-rate" inputMode="decimal" className="tabular h-10" placeholder="Ej.: 1250" value={manual} onChange={(e) => setManual(e.target.value.replace(/[^\d.,]/g, ''))} />
          </div>
          <Button
            variant="outline"
            onClick={() => {
              const v = parseAmount(manual);
              setManualRate(Number.isFinite(v) && v > 0 ? v : null);
              window.dispatchEvent(new Event('mibolsillo:rate'));
            }}
          >
            Usar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AccountsPage() {
  const db = useFirestore();
  const { toast } = useToast();
  const { accounts, balances, currency, transactions, defaultAccountId, activeWallet, canEdit } = useWallet();
  const { openTransaction } = useTransactionDialog();
  const [dialog, setDialog] = useState<{ open: boolean; account: Account | null }>({ open: false, account: null });
  const [casa, setCasa] = useState('blue');
  const [rateTick, setRateTick] = useState(0);
  const hasUsd = accounts.some((a) => a.currency === 'USD') && currency === 'ARS';
  const { quotes } = useDollarQuotes(hasUsd || currency === 'ARS');

  useEffect(() => {
    setCasa(getPreferredCasa());
    const h = () => setRateTick((t) => t + 1);
    window.addEventListener('mibolsillo:rate', h);
    return () => window.removeEventListener('mibolsillo:rate', h);
  }, []);

  const usdRate = useMemo(() => {
    void rateTick;
    const manual = getManualRate();
    if (manual) return manual;
    const q = quotes?.find((x) => x.casa === casa);
    return q?.compra ?? q?.venta ?? null;
  }, [quotes, casa, rateTick]);

  const visible = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);
  const totalBook = visible.filter((a) => a.currency === currency).reduce((s, a) => s + (balances.get(a.id) ?? 0), 0);
  const totalUsd = visible.filter((a) => a.currency === 'USD').reduce((s, a) => s + (balances.get(a.id) ?? 0), 0);
  const usage = (id: string) => transactions.filter((t) => accountIdOf(t, defaultAccountId) === id || t.toAccountId === id).length;

  const archive = async (a: Account, value: boolean) => {
    if (!activeWallet) return;
    if (value && visible.length <= 1) {
      toast({ title: 'Tiene que quedar al menos una cuenta activa' });
      return;
    }
    await safeWrite(updateDoc(doc(db, 'wallets', activeWallet.id, 'accounts', a.id), { archived: value, updatedAt: serverTimestamp() }));
    toast({ title: value ? 'Cuenta archivada' : 'Cuenta restaurada' });
  };

  const remove = async (a: Account) => {
    if (!activeWallet) return;
    if (usage(a.id) > 0) {
      toast({ title: 'La cuenta tiene movimientos', description: 'Archivala en lugar de borrarla para no perder el historial.' });
      return;
    }
    if (accounts.length <= 1) return;
    await deleteWithUndo(db, [{ ref: doc(db, 'wallets', activeWallet.id, 'accounts', a.id), data: a }], 'Cuenta eliminada');
  };

  const AccountCard = ({ a }: { a: Account }) => {
    const Icon = KIND_ICON[a.kind] ?? WalletIcon;
    const bal = balances.get(a.id) ?? 0;
    return (
      <div className={cn('flex items-center gap-3 rounded-2xl border bg-card p-4', a.archived && 'opacity-60')}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${a.colorHex}1f`, color: a.colorHex }}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{a.name}</p>
          <p className="text-xs text-muted-foreground">
            {ACCOUNT_KINDS.find((k) => k.value === a.kind)?.label}
            {a.id === defaultAccountId && ' · principal'}
          </p>
        </div>
        <div className="text-right">
          <p className={cn('tabular font-bold', bal < 0 && 'text-destructive')}>{formatMoney(bal, a.currency)}</p>
          {a.currency === 'USD' && currency === 'ARS' && usdRate && <p className="tabular text-xs text-muted-foreground">≈ {formatMoney(bal * usdRate, 'ARS')}</p>}
        </div>
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="-mr-2 h-9 w-9 rounded-full" aria-label={`Opciones de ${a.name}`}>
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              <DropdownMenuItem className="gap-2" onClick={() => setDialog({ open: true, account: a })}>
                <Pencil className="h-4 w-4" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onClick={() => archive(a, !a.archived)}>
                {a.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />} {a.archived ? 'Restaurar' : 'Archivar'}
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive" onClick={() => remove(a)}>
                <Trash2 className="h-4 w-4" /> Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={WalletIcon}
        title="Cuentas"
        description="Cuánto hay en cada lugar: efectivo, banco, billeteras y ahorros."
        actions={
          canEdit && (
            <>
              <Button variant="outline" onClick={() => openTransaction({ type: 'transfer' })} disabled={visible.length < 2}>
                <ArrowLeftRight /> Transferir
              </Button>
              <Button onClick={() => setDialog({ open: true, account: null })}>
                <Plus /> Nueva cuenta
              </Button>
            </>
          )
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-gradient-to-br from-[#1F8A76] to-[#0B3B35] p-5 text-white">
          <p className="text-sm text-white/75">Total en {currency}</p>
          <p className="tabular font-headline text-3xl font-extrabold">{formatMoney(totalBook, currency)}</p>
        </div>
        {(totalUsd !== 0 || hasUsd) && (
          <div className="rounded-2xl border bg-card p-5">
            <p className="text-sm text-muted-foreground">Ahorros en dólares</p>
            <p className="tabular font-headline text-3xl font-extrabold">{formatMoney(totalUsd, 'USD')}</p>
            {currency === 'ARS' && usdRate ? (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                ≈ {formatMoney(totalUsd * usdRate, 'ARS')} al
                <Select
                  value={casa}
                  onValueChange={(v) => {
                    setCasa(v);
                    setPreferredCasa(v);
                  }}
                >
                  <SelectTrigger className="h-8 w-auto gap-1 px-2 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="oficial">oficial</SelectItem>
                    <SelectItem value="blue">blue</SelectItem>
                    <SelectItem value="bolsa">MEP</SelectItem>
                  </SelectContent>
                </Select>
                {getManualRate() && <span className="text-xs">(cotización propia)</span>}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          {visible.map((a) => (
            <AccountCard key={a.id} a={a} />
          ))}
          {archived.length > 0 && (
            <>
              <p className="pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Archivadas</p>
              {archived.map((a) => (
                <AccountCard key={a.id} a={a} />
              ))}
            </>
          )}
          <p className="text-xs text-muted-foreground">
            Consejo: para comprar dólares usá <strong>Transferir</strong> desde una cuenta en pesos a una cuenta en USD; te pide cuánto salió y cuánto entró.
          </p>
        </div>
        {currency === 'ARS' && <DollarCard />}
      </div>

      <AccountDialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} account={dialog.account} />
    </div>
  );
}


