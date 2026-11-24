'use client';

import Link from 'next/link';
import { Bell, BellRing, AlertTriangle, Ticket, Target, CheckCheck } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/components/providers/notifications-provider';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export function NotificationBell() {
  const { alerts, unreadCount, markAllRead, permission, enabled, enable } = useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o && unreadCount) markAllRead();
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full" aria-label={`Avisos${unreadCount ? ` (${unreadCount} nuevos)` : ''}`}>
          {unreadCount ? <BellRing className="!size-5" /> : <Bell className="!size-5" />}
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground ring-2 ring-background">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,380px)] rounded-2xl p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="font-headline font-bold">Avisos</p>
          {alerts.length > 0 && (
            <button onClick={markAllRead} className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              <CheckCheck className="h-3.5 w-3.5" /> Marcar leídos
            </button>
          )}
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {alerts.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              <Bell className="mx-auto mb-2 h-8 w-8 opacity-40" />
              Todo en orden. No hay vencimientos cerca.
            </div>
          ) : (
            <ul className="divide-y">
              {alerts.map((a) => {
                const Icon = a.kind === 'check' ? Ticket : Target;
                return (
                  <li key={a.id}>
                    <Link href={a.href} onClick={() => setOpen(false)} className="flex gap-3 px-4 py-3 transition-colors hover:bg-muted/60">
                      <div
                        className={cn(
                          'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                          a.severity === 'critical' && 'bg-destructive/10 text-destructive',
                          a.severity === 'warning' && 'bg-warning/15 text-warning',
                          a.severity === 'info' && 'bg-secondary text-secondary-foreground'
                        )}
                      >
                        {a.severity === 'critical' ? <AlertTriangle className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-snug">{a.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{a.body}</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {permission !== 'unsupported' && !(enabled && permission === 'granted') && (
          <div className="border-t bg-muted/40 p-3">
            {permission === 'denied' ? (
              <p className="text-xs text-muted-foreground">Las notificaciones están bloqueadas en este navegador. Podés habilitarlas desde la configuración del sitio.</p>
            ) : (
              <Button size="sm" className="w-full" onClick={() => enable()}>
                <BellRing /> Avisarme también en el celular
              </Button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
