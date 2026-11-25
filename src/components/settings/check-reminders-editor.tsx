'use client';

import { useEffect, useState } from 'react';
import { Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNotifications } from '@/components/providers/notifications-provider';
import { useToast } from '@/hooks/use-toast';
import { OVERDUE_OPTIONS, REMINDER_DAY_OPTIONS, describeRule, type CheckReminderSettings, type ReminderRule } from '@/lib/check-reminders';
import { cn } from '@/lib/utils';

export const dayChipLabel = (d: number) => (d === 0 ? 'El día' : d === 1 ? '1 día' : `${d} días`);

/** Fila de "chips" para elegir varios días de aviso. */
export function DayChips({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const toggle = (d: number) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort((a, b) => b - a));
  return (
    <div className="flex flex-wrap gap-1.5" role="group">
      {REMINDER_DAY_OPTIONS.map((d) => {
        const on = value.includes(d);
        return (
          <button
            key={d}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(d)}
            className={cn(
              'h-9 rounded-full border px-3 text-sm font-medium transition-colors',
              on ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground'
            )}
          >
            {dayChipLabel(d)}
          </button>
        );
      })}
    </div>
  );
}

function RuleEditor({ title, hint, rule, onChange }: { title: string; hint: string; rule: ReminderRule; onChange: (r: ReminderRule) => void }) {
  return (
    <div className="space-y-3 rounded-xl border p-3">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Avisarme antes del vencimiento</Label>
        <DayChips value={rule.days} onChange={(days) => onChange({ ...rule, days })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Si se vence y sigue pendiente</Label>
        <Select value={String(rule.overdueEvery)} onValueChange={(v) => onChange({ ...rule, overdueEvery: Number(v) })}>
          <SelectTrigger className="h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OVERDUE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={String(o.value)}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground">Resumen: {describeRule(rule)}.</p>
    </div>
  );
}

export function CheckRemindersEditor() {
  const { reminders, setReminders } = useNotifications();
  const { toast } = useToast();
  const [draft, setDraft] = useState<CheckReminderSettings>(reminders);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(reminders);

  useEffect(() => setDraft(reminders), [reminders]);

  const save = async () => {
    setSaving(true);
    try {
      await setReminders(draft);
      toast({ title: 'Avisos de cheques guardados', description: 'Se aplican en todos tus dispositivos.' });
    } catch {
      toast({ variant: 'destructive', title: 'No se pudo guardar la configuración' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <RuleEditor title="Cheques a cobrar" hint="Los que te dieron: para acordarte de depositarlos." rule={draft.toCollect} onChange={(toCollect) => setDraft({ ...draft, toCollect })} />
      <RuleEditor title="Cheques a pagar" hint="Los que entregaste: para tener fondos en la cuenta." rule={draft.issued} onChange={(issued) => setDraft({ ...draft, issued })} />
      <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Clock className="h-4 w-4" /> Hora de los avisos
          </p>
          <p className="text-xs text-muted-foreground">Cuándo llegan las notificaciones con la app cerrada.</p>
        </div>
        <Select value={String(draft.hour)} onValueChange={(v) => setDraft({ ...draft, hour: Number(v) })}>
          <SelectTrigger className="h-10 w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 17 }, (_, i) => i + 6).map((h) => (
              <SelectItem key={h} value={String(h)}>
                {String(h).padStart(2, '0')}:00
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground">Cada cheque también puede tener sus propios avisos: editalo y tocá “Personalizar avisos”.</p>
      <Button onClick={save} disabled={!dirty || saving}>
        {saving && <Loader2 className="animate-spin" />} Guardar avisos
      </Button>
    </div>
  );
}
