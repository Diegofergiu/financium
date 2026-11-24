import type { Category } from '@/types';

/** Reglas simples (sin IA) para sugerir una categoría a partir de la descripción. */
const RULES: { match: RegExp; names: string[] }[] = [
  { match: /super|coto|carrefour|d[ií]a\b|jumbo|disco|chango|almac[eé]n|verduler|carnicer|panader|kiosco|mercado\b/i, names: ['Supermercado', 'Comida'] },
  { match: /luz|edenor|edesur|gas|metrogas|agua|aysa|internet|fibertel|telecentro|movistar|claro|personal|celular|cable|netflix|spotify|expensas/i, names: ['Servicios'] },
  { match: /alquiler|inmobiliaria|hipoteca|arreglo|plomer|electricista|pintur/i, names: ['Alquiler / Vivienda'] },
  { match: /farmacia|m[eé]dic|doctor|obra social|prepaga|osde|swiss|dentist|an[aá]lisis|cl[ií]nica|hospital/i, names: ['Salud'] },
  { match: /nafta|combustible|ypf|shell|axion|sube|colectivo|tren|subte|taxi|uber|cabify|didi|peaje|estacionamiento|auto|seguro auto/i, names: ['Transporte'] },
  { match: /afip|arca|monotributo|ingresos brutos|abl|patente|impuesto|rentas|municipal/i, names: ['Impuestos'] },
  { match: /cine|restaurant|resto|bar\b|salida|vacacion|viaje|regalo|cumple/i, names: ['Ocio'] },
  { match: /sueldo|salario|aguinaldo|jubilaci[oó]n|haber|pensi[oó]n/i, names: ['Sueldo'] },
  { match: /venta|cobro|factura|cliente/i, names: ['Ventas'] },
];

export function guessCategory(description: string, categories: Category[]): Category | null {
  const text = description.trim();
  if (!text) return null;
  // 1) Coincidencia directa con el nombre de una categoría propia
  const lower = text.toLowerCase();
  const direct = categories.find((c) => lower.includes(c.name.toLowerCase()));
  if (direct) return direct;
  // 2) Reglas por palabras clave
  for (const rule of RULES) {
    if (rule.match.test(text)) {
      const found = categories.find((c) => rule.names.some((n) => c.name.toLowerCase() === n.toLowerCase()));
      if (found) return found;
    }
  }
  return null;
}
