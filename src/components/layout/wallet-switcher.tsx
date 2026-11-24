'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown, BookOpen, Plus, Loader2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWallet } from '@/components/providers/wallet-provider';
import { useToast } from '@/hooks/use-toast';
import { CURRENCIES, DEFAULT_CURRENCY } from '@/lib/format';
import { cn } from '@/lib/utils';

export function NewWalletDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { createWallet } = useWallet();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createWallet(name, currency);
      toast({ title: 'Libro creado', description: `Ahora estás viendo "${name.trim()}".` });
      setName('');
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'No se pudo crear el libro' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo libro</DialogTitle>
          <DialogDescription>Separá tus cuentas: por ejemplo “Casa”, “Negocio” o “Ahorros en dólares”.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="w-name">Nombre</Label>
            <Input id="w-name" className="h-11" placeholder="Ej.: Negocio" value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
          </div>
          <div className="space-y-2">
            <Label>Moneda</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" size="lg" className="h-12 w-full sm:w-auto" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Crear libro
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function WalletSwitcher({ className, compact }: { className?: string; compact?: boolean }) {
  const { wallets, activeWallet, setActiveWalletId } = useWallet();
  const [newOpen, setNewOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              'flex min-w-0 items-center gap-2.5 rounded-xl border bg-card text-left transition-colors hover:bg-muted/60',
              compact ? 'h-10 px-3' : 'w-full p-2.5',
              className
            )}
          >
            {!compact && (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                <BookOpen className="h-4 w-4" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              {!compact && <span className="block text-[11px] font-medium text-muted-foreground">Libro actual</span>}
              <span className="block truncate text-sm font-semibold">{activeWallet?.name ?? 'Cargando…'}</span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64 rounded-xl">
          <DropdownMenuLabel>Tus libros</DropdownMenuLabel>
          {wallets.map((w) => (
            <DropdownMenuItem key={w.id} onClick={() => setActiveWalletId(w.id)} className="gap-2 py-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 truncate">{w.name}</span>
              <span className="text-[10px] text-muted-foreground">{w.currency ?? DEFAULT_CURRENCY}</span>
              {activeWallet?.id === w.id && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setNewOpen(true)} className="gap-2 py-2 font-medium text-primary">
            <Plus className="h-4 w-4" /> Nuevo libro
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <NewWalletDialog open={newOpen} onOpenChange={setNewOpen} />
    </>
  );
}
