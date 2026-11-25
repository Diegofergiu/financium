'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Copy } from 'lucide-react';
import { getFirebaseStorage, useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { checkRules, DEPLOY_COMMAND, type RulesState } from '@/lib/rules-check';

/** Aviso visible si las reglas de seguridad publicadas en Firebase son de una versión anterior. */
export function RulesStatusBanner() {
  const db = useFirestore();
  const { toast } = useToast();
  const [state, setState] = useState<{ firestore: RulesState; storage: RulesState } | null>(null);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    checkRules(db, getFirebaseStorage()).then(setState).catch(() => {});
  }, [db]);

  if (!state || (state.firestore !== 'outdated' && state.storage !== 'outdated')) return null;
  const what = [state.firestore === 'outdated' && 'Firestore', state.storage === 'outdated' && 'Storage'].filter(Boolean).join(' y ');

  return (
    <div className="space-y-3 rounded-2xl border border-warning/50 bg-warning/10 p-4 text-sm">
      <p className="flex items-start gap-2 font-semibold">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        Las reglas de seguridad de {what} publicadas en Firebase son de una versión anterior.
      </p>
      <p className="text-muted-foreground">
        Por eso algunas funciones (invitar personas, fotos) no andan. La app web se publica sola desde GitHub, pero las reglas y las
        funciones no: hay que correr este comando una vez en la terminal de Firebase Studio (después de <code>git pull origin main</code>):
      </p>
      <div className="flex items-center gap-2 rounded-lg bg-background/70 p-2 font-mono text-xs">
        <span className="min-w-0 flex-1 break-all">{DEPLOY_COMMAND}</span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigator.clipboard.writeText(DEPLOY_COMMAND).then(() => toast({ title: 'Comando copiado' }))}
        >
          <Copy /> Copiar
        </Button>
      </div>
    </div>
  );
}
