import { parseAmount } from './format';

/** Divide un CSV respetando comillas. Detecta el separador (; , o tabulación). */
export function parseCSV(text: string): string[][] {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.split(/\r?\n/)[0] ?? '';
  const counts = { ';': (firstLine.match(/;/g) || []).length, ',': (firstLine.match(/,/g) || []).length, '\t': (firstLine.match(/\t/g) || []).length };
  const sep = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ';') as string;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && clean[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows.map((r) => r.map((x) => x.trim()));
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

export type ColumnKey = 'date' | 'description' | 'amount' | 'debit' | 'credit' | 'type' | 'category' | 'account' | 'notes';

const HINTS: Record<ColumnKey, RegExp> = {
  date: /^(fecha|date|dia|f\. ?operacion|fecha operacion)/,
  description: /(descripcion|detalle|concepto|description|movimiento|referencia)/,
  amount: /^(monto|importe|amount|valor|total)/,
  debit: /(debito|debe|egreso|salida|cargo)/,
  credit: /(credito|haber|ingreso|entrada|abono)/,
  type: /^(tipo|type)$/,
  category: /(categoria|rubro|category)/,
  account: /^(cuenta|account)$/,
  notes: /^(nota|notas|observacion|observaciones|comentario)/,
};

/** Adivina qué columna es cada cosa a partir del encabezado. */
export function guessColumns(header: string[]): Partial<Record<ColumnKey, number>> {
  const map: Partial<Record<ColumnKey, number>> = {};
  header.forEach((h, i) => {
    const n = norm(h);
    for (const key of Object.keys(HINTS) as ColumnKey[]) {
      if (map[key] === undefined && HINTS[key].test(n)) {
        // "monto" tiene prioridad sobre débito/crédito si aparece
        map[key] = i;
        break;
      }
    }
  });
  return map;
}

/** Acepta 31/12/2024, 31-12-24, 2024-12-31 y 31.12.2024. */
export function parseDateFlexible(s: string): string | null {
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    const d = Number(m[1]);
    const mo = Number(m[2]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return null;
}

/** Monto con signo: "-1.234,56", "$ 1.234,56-", "(1.234,56)". */
export function parseSignedAmount(s: string): number {
  let t = String(s ?? '').trim();
  if (!t) return NaN;
  let neg = false;
  if (/^\(.*\)$/.test(t)) {
    neg = true;
    t = t.slice(1, -1);
  }
  if (t.startsWith('-') || t.startsWith('−')) {
    neg = true;
    t = t.slice(1);
  } else if (t.endsWith('-')) {
    neg = true;
    t = t.slice(0, -1);
  }
  t = t.replace(/^(U\$S|US\$|ARS|USD|\$)\s*/i, '').trim();
  if (t.startsWith('-')) {
    neg = true;
    t = t.slice(1);
  }
  const v = parseAmount(t);
  return neg ? -v : v;
}

export interface ParsedRow {
  line: number;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category?: string;
  account?: string;
  notes?: string;
  error?: string;
}

export function buildRows(rows: string[][], cols: Partial<Record<ColumnKey, number>>, positiveIs: 'income' | 'expense'): ParsedRow[] {
  return rows.map((r, idx) => {
    const get = (k: ColumnKey) => (cols[k] !== undefined ? r[cols[k]!] ?? '' : '');
    const date = parseDateFlexible(get('date'));
    let amount = NaN;
    let type: 'income' | 'expense' = positiveIs;
    if (cols.amount !== undefined) {
      amount = parseSignedAmount(get('amount'));
      if (Number.isFinite(amount) && amount < 0) type = positiveIs === 'income' ? 'expense' : 'income';
    } else {
      const d = parseSignedAmount(get('debit'));
      const c = parseSignedAmount(get('credit'));
      if (Number.isFinite(d) && d !== 0) {
        amount = d;
        type = 'expense';
      } else if (Number.isFinite(c) && c !== 0) {
        amount = c;
        type = 'income';
      }
    }
    const t = norm(get('type'));
    if (/^(ingreso|income|entrada|credito|cobro)/.test(t)) type = 'income';
    else if (/^(gasto|egreso|expense|salida|debito|pago)/.test(t)) type = 'expense';
    const description = get('description') || '(sin descripción)';
    const row: ParsedRow = {
      line: idx + 2,
      date: date ?? '',
      description: description.slice(0, 200),
      amount: Math.abs(amount),
      type,
      category: get('category') || undefined,
      account: get('account') || undefined,
      notes: get('notes') || undefined,
    };
    if (!date) row.error = 'Fecha no reconocida';
    else if (!Number.isFinite(amount) || amount === 0) row.error = 'Monto no reconocido';
    return row;
  });
}
