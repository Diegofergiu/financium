'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteDoc, deleteField, doc, FieldPath, query, collection, where, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { sendEmailVerification } from 'firebase/auth';
import { Copy, Crown, Eye, Loader2, LogOut, MailCheck, Pencil, Send, UserMinus, X } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useWallet, inviteId } from '@/components/providers/wallet-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/shared/ui-bits';
import { useToast } from '@/hooks/use-toast';
import type { Invite, UserRole } from '@/types';

const ROLE_LABEL: Record<UserRole, string> = { owner: 'Dueño', editor: 'Puede anotar y editar', reader: 'Sólo ver' };

export function MembersManager() {
  const db = useFirestore();
  const router = useRouter();
  const { user } = useUser();
  const { toast } = useToast();
  const { activeWallet, isOwner, wallets, setActiveWalletId } = useWallet();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'reader'>('editor');
  const [sending, setSending] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [toRemove, setToRemove] = useState<string | null>(null);

  const invitesQuery = useMemoFirebase(
    () => (user && activeWallet && isOwner ? query(collection(db, 'invites'), where('invitedBy', '==', user.uid), where('walletId', '==', activeWallet.id)) : null),
    [db, user, activeWallet?.id, isOwner]
  );
  const { data: invites } = useCollection<Omit<Invite, 'id'>>(invitesQuery);
  const pending = (invites ?? []).filter((i) => i.status === 'pending');

  if (!activeWallet || !user) return null;
  const members = Object.entries(activeWallet.members ?? {}).sort(([, a], [, b]) => (a === 'owner' ? -1 : b === 'owner' ? 1 : 0));
  const info = activeWallet.memberInfo ?? {};
  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    const mail = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) {
      toast({ variant: 'destructive', title: 'El correo no parece válido' });
      return;
    }
    if (mail === user.email?.toLowerCase()) {
      toast({ title: 'Ese es tu propio correo' });
      return;
    }
    setSending(true);
    try {
      await setDoc(doc(db, 'invites', inviteId(activeWallet.id, mail)), {
        walletId: activeWallet.id,
        walletName: activeWallet.name,
        email: mail,
        role,
        status: 'pending',
        invitedBy: user.uid,
        invitedByName: user.displayName || user.email || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setEmail('');
      toast({ title: 'Invitación creada', description: `Cuando ${mail} entre a Mi Bolsillo con ese correo, va a ver la invitación.` });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'No se pudo invitar', description: 'Si ya la habías invitado y rechazó, cancelá la invitación anterior primero.' });
    } finally {
      setSending(false);
    }
  };

  const shareText = (mail: string) =>
    `Te invité a ver mis cuentas en Mi Bolsillo. Entrá a ${appUrl} con tu correo ${mail} (podés usar “Continuar con Google”) y aceptá la invitación.`;

  const copy = async (mail: string) => {
    const text = shareText(mail);
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast({ title: 'Mensaje copiado', description: 'Pegalo en WhatsApp o en un correo.' });
      }
    } catch {}
  };

  const removeMember = async (uid: string) => {
    try {
      await updateDoc(doc(db, 'wallets', activeWallet.id), new FieldPath('members', uid), deleteField(), new FieldPath('memberInfo', uid), deleteField(), 'updatedAt', serverTimestamp());
      toast({ title: 'Acceso quitado' });
    } catch {
      toast({ variant: 'destructive', title: 'No se pudo quitar el acceso' });
    }
    setToRemove(null);
  };

  const leave = async () => {
    try {
      await updateDoc(doc(db, 'wallets', activeWallet.id), new FieldPath('members', user.uid), deleteField(), new FieldPath('memberInfo', user.uid), deleteField(), 'updatedAt', serverTimestamp());
      const other = wallets.find((w) => w.id !== activeWallet.id);
      if (other) setActiveWalletId(other.id);
      toast({ title: `Saliste de “${activeWallet.name}”` });
      router.replace('/dashboard');
    } catch {
      toast({ variant: 'destructive', title: 'No se pudo salir del libro' });
    }
  };

  return (
    <div className="space-y-4">
      {!user.emailVerified && user.providerData.some((p) => p.providerId === 'password') && (
        <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
          <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div className="flex-1">
            <p>Para recibir invitaciones a libros de otras personas, verificá tu correo.</p>
            <button
              className="mt-1 text-xs font-semibold text-primary hover:underline"
              onClick={() =>
                sendEmailVerification(user)
                  .then(() => toast({ title: 'Te enviamos un correo', description: 'Abrí el enlace y después volvé a entrar a la app.' }))
                  .catch(() => toast({ variant: 'destructive', title: 'No se pudo enviar el correo' }))
              }
            >
              Enviar correo de verificación
            </button>
          </div>
        </div>
      )}

      <ul className="divide-y rounded-xl border">
        {members.map(([uid, r]) => (
          <li key={uid} className="flex items-center gap-3 px-3 py-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              {r === 'owner' ? <Crown className="h-4 w-4" /> : r === 'reader' ? <Eye className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {uid === user.uid ? 'Vos' : info[uid]?.name || info[uid]?.email || 'Persona invitada'}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {ROLE_LABEL[r]}
                {uid !== user.uid && info[uid]?.email ? ` · ${info[uid].email}` : ''}
              </span>
            </span>
            {isOwner && r !== 'owner' && (
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-muted-foreground hover:text-destructive" onClick={() => setToRemove(uid)} aria-label="Quitar acceso">
                <UserMinus />
              </Button>
            )}
          </li>
        ))}
      </ul>

      {isOwner ? (
        <>
          <form onSubmit={invite} className="space-y-2">
            <Label htmlFor="inv-email">Invitar a alguien</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input id="inv-email" type="email" inputMode="email" placeholder="correo@ejemplo.com" className="h-11 flex-1" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Select value={role} onValueChange={(v) => setRole(v as 'editor' | 'reader')}>
                <SelectTrigger className="h-11 sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="editor">Puede editar</SelectItem>
                  <SelectItem value="reader">Sólo ver</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" className="h-11" disabled={sending || !email.trim()}>
                {sending ? <Loader2 className="animate-spin" /> : <Send />} Invitar
              </Button>
            </div>
          </form>
          {pending.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Invitaciones pendientes</p>
              {pending.map((i) => (
                <div key={i.id} className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    {i.email} <span className="text-xs text-muted-foreground">· {ROLE_LABEL[i.role]}</span>
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => copy(i.email)}>
                    <Copy /> Avisarle
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteDoc(doc(db, 'invites', i.id))} aria-label="Cancelar invitación">
                    <X />
                  </Button>
                </div>
              ))}
            </div>
          )}
          {(invites ?? []).some((i) => i.status === 'declined') && (
            <p className="text-xs text-muted-foreground">
              Rechazaron: {(invites ?? []).filter((i) => i.status === 'declined').map((i) => i.email).join(', ')}.{' '}
              <button className="font-semibold text-primary hover:underline" onClick={() => (invites ?? []).filter((i) => i.status === 'declined').forEach((i) => deleteDoc(doc(db, 'invites', i.id)))}>
                Limpiar
              </button>
            </p>
          )}
        </>
      ) : (
        <Button variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirmLeave(true)}>
          <LogOut /> Salir de este libro
        </Button>
      )}

      <ConfirmDialog
        open={!!toRemove}
        onOpenChange={(o) => !o && setToRemove(null)}
        title="¿Quitarle el acceso?"
        description="Va a dejar de ver este libro. Los movimientos que anotó se mantienen."
        confirmLabel="Quitar acceso"
        onConfirm={async () => { if (toRemove) await removeMember(toRemove); }}
      />
      <ConfirmDialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        title={`¿Salir de “${activeWallet.name}”?`}
        description="Vas a dejar de verlo. El dueño puede volver a invitarte."
        confirmLabel="Salir"
        onConfirm={leave}
      />
    </div>
  );
}
