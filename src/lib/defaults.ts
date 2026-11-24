import type { CategoryKind } from '@/types';

export const DEFAULT_CATEGORIES: { name: string; colorHex: string; kind: CategoryKind }[] = [
  { name: 'Sueldo', colorHex: '#16a34a', kind: 'income' },
  { name: 'Ventas', colorHex: '#0d9488', kind: 'income' },
  { name: 'Otros ingresos', colorHex: '#65a30d', kind: 'income' },
  { name: 'Supermercado', colorHex: '#f59e0b', kind: 'expense' },
  { name: 'Servicios', colorHex: '#0ea5e9', kind: 'expense' },
  { name: 'Alquiler / Vivienda', colorHex: '#8b5cf6', kind: 'expense' },
  { name: 'Salud', colorHex: '#ef4444', kind: 'expense' },
  { name: 'Transporte', colorHex: '#3b82f6', kind: 'expense' },
  { name: 'Impuestos', colorHex: '#64748b', kind: 'expense' },
  { name: 'Ocio', colorHex: '#ec4899', kind: 'expense' },
  { name: 'Varios', colorHex: '#a8a29e', kind: 'both' },
];

export const PAYMENT_METHODS = [
  'Efectivo',
  'Débito',
  'Crédito',
  'Transferencia',
  'Mercado Pago',
  'Cheque',
  'Otro',
];

export const CATEGORY_COLORS = [
  '#16a34a', '#0d9488', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6',
  '#ec4899', '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#64748b',
];

export const BANKS = [
  'Banco Nación', 'Banco Provincia', 'Banco Galicia', 'Santander', 'BBVA',
  'Macro', 'ICBC', 'Credicoop', 'Banco Ciudad', 'HSBC', 'Supervielle', 'Patagonia',
];
