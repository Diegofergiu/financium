'use client';

import { useMemo, useRef, useState } from 'react';
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useWallet } from '@/components/providers/wallet-provider';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Segmented } from '@/components/shared/ui-bits';
import { useToast } from '@/hooks/use-toast';
import { buildRows, guessColumns, parseCSV, type ColumnKey } from '@/lib/csv-import';
import { guessCategory } from '@/lib/auto-category';
import { CATEGORY_COLORS } from '@/lib/defaults';
import { formatDate, formatMoney } from '@/lib/format';
import { safeWrite } from '@/lib/write';
import { cn } from '@/lib/utils';

const FIELD_LABELS: { key: ColumnKey; label: string; required?: boolean }[] = [
  { key: 'date', label: 'Fecha', required: true },
  { key: 'description', label: 'Descripción' },
  { key: 'amount', label: 'Monto' },
  { key: 'debit', label: 'Débito (gastos)' },
  { key: 'credit', label: 'Crédito (ingresos)' },
  { key: 'type', label: 'Tipo' },
  { key: 'category', label: 'Categoría' },
  { key: 'notes', label: 'Nota' },
];

export function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const db = useFirestore();
  const { toast } = useToast();
  const { activeWallet, authFields, categories, accounts, defaultAccountId, transactions, currency } = useWallet();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [table, setTable] = useState<string[][]>([]);
  const [cols, setCols] = useState<Partial<Record<ColumnKey, number>>>({});
  const [positiveIs, setPositiveIs] = useState<'income' | 'expense'>('income');
  const [accountId, setAccountId] = useState('');
  const [saving, setSaving] = useState(false);

  const header = table[0] ?? [];
  const body = table.slice(1);
  const rows = useMemo(() => buildRows(body, cols, positiveIs), [body, cols, positiveIs]);

  const existing = useMemo(() => new Set(transactions.map((t) => `${t.date}|${t.amount}|${t.description.toLowerCase()}`)), [transactions]);
  const valid = rows.filter((r) => !r.error);
  const fresh = valid.filter((r) => !existing.has(`${r.date}|${r.amount}|${r.description.toLowerCase()}`));
  const dupes = valid.length - fresh.length;
  const newCategoryNames = useMemo(() => {
    const known = new Set(categories.map((c) => c.name.toLowerCase()));
    return Array.from(new Set(fresh.map((r) => r.category?.trim()).filter((n): n is string => !!n && !known.has(n.toLowerCase()))));
  }, [fresh, categories]);

  const reset = () => {
    setTable([]);
    setFileName('');
    setCols({});
    if (fileRef.current) fileRef.current.value = '';
  };

  const onFile = async (f?: File) => {
    if (!f) return;
    let text = await f.text();
    // Excel en Windows a veces guarda en Latin-1: si aparecen caracteres raros, releer
    if (text.includes('�')) text = new TextDecoder('windows-1252').decode(await f.arrayBuffer());
    const parsed = parseCSV(text);
    if (parsed.length < 2) {
      toast({ variant: 'destructive', title: 'El archivo está vacío o no es un CSV' });
      return;
    }
    setFileName(f.name);
    setTable(parsed);
    setCols(guessColumns(parsed[0]));
    setAccountId(defaultAccountId ?? '');
  };

  const doImport = async () => {
    if (!activeWallet || !authFields || !fresh.length) return;
    setSaving(true);
    try {
      const wid = activeWallet.id;
      const catByName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
      const base = { ...authFields, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
      const ops: ((b: ReturnType<typeof writeBatch>) => void)[] = [];
      newCategoryNames.forEach((name, i) => {
        const ref = doc(collection(db, 'wallets', wid, 'categories'));
        catByName.set(name.toLowerCase(), ref.id);
        ops.push((b) => b.set(ref, { name, colorHex: CATEGORY_COLORS[i % CATEGORY_COLORS.length], kind: 'both', ...base }));
      });
      const fallback = categories.find((c) => c.name.toLowerCase() === 'varios')?.id ?? '';
      for (const r of fresh) {
        const catId = (r.category && catByName.get(r.category.toLowerCase())) || guessCategory(r.description, categories)?.id || fallback;
        const ref = doc(collection(db, 'wallets', wid, 'transactions'));
        ops.push((b) =>
          b.set(ref, {
            walletId: wid,
            type: r.type,
            amount: Math.round(r.amount * 100) / 100,
            description: r.description,
            categoryId: catId,
            date: r.date,
            accountId: accountId || defaultAccountId || '',
            paymentMethod: '',
            notes: r.notes ?? '',
            imported: true,
            ...base,
          })
        );
      }
      for (let i = 0; i < ops.length; i += 400) {
        const b = writeBatch(db);
        ops.slice(i, i + 400).forEach((op) => op(b));
        await safeWrite(b.commit(), 'No se pudo importar');
      }
      toast({ title: `Se importaron ${fresh.length} movimientos`, description: dupes ? `${dupes} ya existían y se saltearon.` : undefined });
      reset();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'No se pudo importar' });
    } finally {
      setSaving(false);
    }
  };

  const hasAmount = cols.amount !== undefined || cols.debit !== undefined || cols.credit !== undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar movimientos</DialogTitle>
          <DialogDescription>Desde Excel (guardado como CSV), el resumen del banco o una exportación de Mi Bolsillo.</DialogDescription>
        </DialogHeader>

        {!table.length ? (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition-colors hover:border-primary hover:bg-secondary/40"
            >
              <FileSpreadsheet className="h-10 w-10 text-primary" />
              <span className="font-semibold">Elegí el archivo .csv</span>
              <span className="text-xs text-muted-foreground">En Excel: Archivo → Guardar como → “CSV (delimitado por comas)”.</span>
            </button>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>• Columnas que reconocemos: Fecha, Descripción, Monto (o Débito/Crédito), Tipo, Categoría, Nota.</li>
              <li>• Fechas tipo 31/12/2024 y montos tipo 1.234,56. Los negativos se toman como gastos.</li>
              <li>• Los movimientos repetidos (misma fecha, monto y descripción) se saltean.</li>
            </ul>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="flex items-center gap-2 text-sm">
              <FileSpreadsheet className="h-4 w-4" /> <strong className="truncate">{fileName}</strong> · {body.length} filas
              <button className="ml-auto text-xs font-semibold text-primary hover:underline" onClick={reset}>
                Cambiar archivo
              </button>
            </p>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {FIELD_LABELS.map((f) => (
                <div key={f.key} className="space-y-1">
                  <Label className="text-xs">{f.label}</Label>
                  <Select value={cols[f.key] !== undefined ? String(cols[f.key]) : 'none'} onValueChange={(v) => setCols((c) => ({ ...c, [f.key]: v === 'none' ? undefined : Number(v) }))}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {header.map((h, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {h || `Columna ${i + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {cols.amount !== undefined && cols.type === undefined && (
                <div className="space-y-1">
                  <Label className="text-xs">Los montos positivos son</Label>
                  <Segmented
                    value={positiveIs}
                    onChange={setPositiveIs}
                    options={[
                      { value: 'income', label: 'Ingresos' },
                      { value: 'expense', label: 'Gastos' },
                    ]}
                  />
                </div>
              )}
              {accounts.length > 1 && (
                <div className="space-y-1">
                  <Label className="text-xs">Cuenta</Label>
                  <Select value={accountId || defaultAccountId || undefined} onValueChange={setAccountId}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts
                        .filter((a) => !a.archived)
                        .map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="max-h-64 overflow-auto rounded-xl border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr className="text-left">
                    <th className="p-2">Fecha</th>
                    <th className="p-2">Descripción</th>
                    <th className="p-2 text-right">Monto</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.slice(0, 50).map((r) => {
                    const dup = !r.error && existing.has(`${r.date}|${r.amount}|${r.description.toLowerCase()}`);
                    return (
                      <tr key={r.line} className={cn((r.error || dup) && 'text-muted-foreground')}>
                        <td className="whitespace-nowrap p-2">{r.date ? formatDate(r.date, 'dd/MM/yy') : '—'}</td>
                        <td className="max-w-[220px] truncate p-2">{r.description}</td>
                        <td className={cn('tabular whitespace-nowrap p-2 text-right font-medium', !r.error && r.type === 'income' && 'text-income')}>
                          {Number.isFinite(r.amount) && r.amount ? `${r.type === 'income' ? '+' : '−'}${formatMoney(r.amount, currency)}` : '—'}
                        </td>
                        <td className="whitespace-nowrap p-2">{r.error ? <span className="text-destructive">{r.error}</span> : dup ? 'Ya existe' : <CheckCircle2 className="h-4 w-4 text-income" />}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {rows.length > 50 && <p className="text-xs text-muted-foreground">Mostrando las primeras 50 filas.</p>}

            <div className="space-y-1 rounded-xl bg-muted/50 p-3 text-sm">
              <p>
                <strong>{fresh.length}</strong> movimientos para importar
                {dupes > 0 && <span className="text-muted-foreground"> · {dupes} repetidos</span>}
                {rows.length - valid.length > 0 && <span className="text-destructive"> · {rows.length - valid.length} con errores (se saltean)</span>}
              </p>
              {newCategoryNames.length > 0 && <p className="text-xs text-muted-foreground">Se crearán las categorías: {newCategoryNames.join(', ')}.</p>}
              {(cols.date === undefined || !hasAmount) && (
                <p className="flex items-center gap-1.5 text-xs text-warning">
                  <AlertTriangle className="h-3.5 w-3.5" /> Indicá qué columna es la fecha y cuál el monto.
                </p>
              )}
            </div>
          </div>
        )}

        <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />

        {table.length > 0 && (
          <DialogFooter>
            <Button size="lg" className="h-12 w-full sm:w-auto" disabled={saving || !fresh.length} onClick={doImport}>
              {saving ? <Loader2 className="animate-spin" /> : <Upload />} Importar {fresh.length} movimientos
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
