'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { Bell, BookOpen, Download, KeyRound, LogOut, Palette, Smartphone, Tags, User, Loader2, Settings, Plus, Users, Ticket } from 'lucide-react';
import { CheckRemindersEditor } from '@/components/settings/check-reminders-editor';
import { MembersManager } from '@/components/settings/members-manager';
import { useAuth, useFirestore, useUser } from '@/firebase';
import { useWallet } from '@/components/providers/wallet-provider';
import { useNotifications } from '@/components/providers/notifications-provider';
import { useTheme } from '@/components/providers/theme-provider';
import { CategoryManager } from '@/components/settings/category-manager';
import { NewWalletDialog } from '@/components/layout/wallet-switcher';
import { PageHeader, ConfirmDialog, Segmented } from '@/components/shared/ui-bits';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { CURRENCIES, DEFAULT_CURRENCY } from '@/lib/format';
import { authErrorMessage } from '@/components/auth/auth-shell';

function Section({ icon: Icon, title, description, children }: { icon: typeof User; title: string; description?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {description && <CardDescription className="mt-0.5">{description}</CardDescription>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export default function SettingsPage() {
  const { user } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { theme, setTheme, textSize, setTextSize } = useTheme();
  const { activeWallet, wallets, deleteWallet, setActiveWalletId, isOwner, canEdit } = useWallet();
  const [weekly, setWeekly] = useState(true);
  const notif = useNotifications();

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [walletName, setWalletName] = useState(activeWallet?.name ?? '');
  const [walletCurrency, setWalletCurrency] = useState(activeWallet?.currency ?? DEFAULT_CURRENCY);
  const [savingWallet, setSavingWallet] = useState(false);
  const [confirmDeleteWallet, setConfirmDeleteWallet] = useState(false);
  const [deletingWallet, setDeletingWallet] = useState(false);
  const [newWalletOpen, setNewWalletOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => setDisplayName(user?.displayName ?? ''), [user]);
  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, 'users', user.uid))
      .then((d) => setWeekly(d.data()?.weeklySummary !== false))
      .catch(() => {});
  }, [db, user]);
  useEffect(() => {
    setWalletName(activeWallet?.name ?? '');
    setWalletCurrency(activeWallet?.currency ?? DEFAULT_CURRENCY);
  }, [activeWallet]);

  useEffect(() => {
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true);
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as InstallPrompt);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const hasPassword = user?.providerData.some((p) => p.providerId === 'password');

  const saveProfile = async () => {
    if (!user || !displayName.trim()) return;
    setSavingProfile(true);
    try {
      await updateProfile(user, { displayName: displayName.trim() });
      await setDoc(doc(db, 'users', user.uid), { id: user.uid, email: user.email ?? '', displayName: displayName.trim(), updatedAt: serverTimestamp() }, { merge: true });
      toast({ title: 'Perfil actualizado' });
    } catch {
      toast({ variant: 'destructive', title: 'No se pudo actualizar el perfil' });
    } finally {
      setSavingProfile(false);
    }
  };

  const resetPassword = async () => {
    if (!user?.email) return;
    try {
      await sendPasswordResetEmail(auth, user.email);
      toast({ title: 'Te enviamos un correo', description: `Revisá ${user.email} para cambiar tu contraseña.` });
    } catch (e) {
      toast({ variant: 'destructive', title: 'No se pudo enviar', description: authErrorMessage(e) });
    }
  };

  const saveWallet = async () => {
    if (!activeWallet || !walletName.trim()) return;
    setSavingWallet(true);
    try {
      await updateDoc(doc(db, 'wallets', activeWallet.id), { name: walletName.trim(), currency: walletCurrency, updatedAt: serverTimestamp() });
      toast({ title: 'Libro actualizado' });
    } catch {
      toast({ variant: 'destructive', title: 'No se pudo actualizar el libro' });
    } finally {
      setSavingWallet(false);
    }
  };

  const removeWallet = async () => {
    if (!activeWallet) return;
    setDeletingWallet(true);
    try {
      const other = wallets.find((w) => w.id !== activeWallet.id);
      await deleteWallet(activeWallet.id);
      if (other) setActiveWalletId(other.id);
      toast({ title: 'Libro eliminado' });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'No se pudo eliminar el libro' });
    } finally {
      setDeletingWallet(false);
      setConfirmDeleteWallet(false);
    }
  };

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const logout = async () => {
    await signOut(auth);
    router.replace('/login');
  };

  const toggleNotifications = async (on: boolean) => {
    if (!on) {
      notif.disable();
      return;
    }
    const ok = await notif.enable();
    if (ok) toast({ title: 'Notificaciones activadas', description: 'Te avisaremos de vencimientos y presupuestos.' });
    else toast({ variant: 'destructive', title: 'Permiso denegado', description: 'Habilitá las notificaciones desde la configuración del navegador.' });
  };

  return (
    <div className="space-y-6">
      <PageHeader icon={Settings} title="Ajustes" description="Tu cuenta, tus libros y cómo querés que te avisemos." />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Section icon={User} title="Tu perfil">
            <div className="space-y-2">
              <Label htmlFor="s-name">Nombre</Label>
              <Input id="s-name" className="h-11" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-email">Correo</Label>
              <Input id="s-email" className="h-11" value={user?.email ?? ''} disabled />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={saveProfile} disabled={savingProfile || !displayName.trim() || displayName.trim() === user?.displayName}>
                {savingProfile && <Loader2 className="animate-spin" />} Guardar
              </Button>
              {hasPassword && (
                <Button variant="outline" onClick={resetPassword}>
                  <KeyRound /> Cambiar contraseña
                </Button>
              )}
            </div>
          </Section>

          <Section icon={Bell} title="Notificaciones" description="Avisos de cheques por vencer y presupuestos al límite.">
            {notif.permission === 'unsupported' ? (
              <p className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
                {isIOS
                  ? 'En iPhone, primero agregá Mi Bolsillo a la pantalla de inicio (botón Compartir → “Agregar a inicio”) y abrila desde ahí para activar las notificaciones.'
                  : 'Este navegador no permite notificaciones. Igual vas a ver los avisos en la campanita de arriba.'}
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-4 rounded-xl border p-3">
                  <div>
                    <p className="text-sm font-semibold">Notificaciones en este dispositivo</p>
                    <p className="text-xs text-muted-foreground">
                      {notif.permission === 'denied' ? 'Bloqueadas por el navegador. Habilitalas desde la configuración del sitio.' : 'Te avisamos todos los días a las 9, aunque la app esté cerrada.'}
                    </p>
                  </div>
                  <Switch checked={notif.enabled && notif.permission === 'granted'} onCheckedChange={toggleNotifications} disabled={notif.permission === 'denied'} aria-label="Activar notificaciones" />
                </div>
                {notif.enabled && notif.permission === 'granted' && (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-xs">
                      <span
                        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${notif.serverPush === 'active' ? 'bg-income' : notif.serverPush === 'registering' ? 'animate-pulse bg-warning' : 'bg-muted-foreground'}`}
                      />
                      <span className="text-muted-foreground">
                        {notif.serverPush === 'active' && 'Avisos con la app cerrada: activos en este dispositivo.'}
                        {notif.serverPush === 'registering' && 'Registrando este dispositivo…'}
                        {(notif.serverPush === 'unavailable' || notif.serverPush === 'off') &&
                          (isIOS
                            ? 'Para recibir avisos con la app cerrada en iPhone, abrila desde el ícono de la pantalla de inicio.'
                            : 'Este navegador sólo muestra avisos con la app abierta.')}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const r = await notif.sendTest();
                        if (r === 'server') toast({ title: 'Prueba enviada', description: 'En unos segundos te llega la notificación desde el servidor.' });
                        else if (r === 'local') toast({ title: 'Prueba mostrada', description: 'Los avisos del servidor todavía no están disponibles; con la app abierta funcionan igual.' });
                        else toast({ variant: 'destructive', title: 'No se pudo mostrar la notificación' });
                      }}
                    >
                      Enviar notificación de prueba
                    </Button>
                  </div>
                )}
              </>
            )}
            {notif.enabled && notif.permission === 'granted' && (
              <div className="flex items-center justify-between gap-4 rounded-xl border p-3">
                <div>
                  <p className="text-sm font-semibold">Resumen semanal</p>
                  <p className="text-xs text-muted-foreground">Los lunes: cuánto entró y salió la semana pasada.</p>
                </div>
                <Switch
                  checked={weekly}
                  aria-label="Resumen semanal"
                  onCheckedChange={(v) => {
                    setWeekly(v);
                    if (user) setDoc(doc(db, 'users', user.uid), { id: user.uid, weeklySummary: v }, { merge: true }).catch(() => {});
                  }}
                />
              </div>
            )}
          </Section>

          <Section icon={Ticket} title="Avisos de cheques" description="Cuántas veces y cuándo querés que te avise antes de cobrar o pagar.">
            <CheckRemindersEditor />
          </Section>

          <Section icon={Palette} title="Apariencia">
            <Segmented
              value={theme}
              onChange={setTheme}
              options={[
                { value: 'light', label: 'Claro' },
                { value: 'dark', label: 'Oscuro' },
                { value: 'system', label: 'Automático' },
              ]}
            />
            <div className="space-y-2">
              <Label>Tamaño de la letra</Label>
              <Segmented
                value={textSize}
                onChange={setTextSize}
                options={[
                  { value: 'normal', label: 'Normal' },
                  { value: 'large', label: 'Grande' },
                  { value: 'xl', label: 'Muy grande' },
                ]}
              />
            </div>
          </Section>

          {!isStandalone && (
            <Section icon={Smartphone} title="Instalar en el celular" description="Usala como una app más, con su ícono en la pantalla de inicio.">
              {installPrompt ? (
                <Button onClick={install}>
                  <Download /> Instalar Mi Bolsillo
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {isIOS
                    ? 'En Safari tocá el botón Compartir y elegí “Agregar a inicio”.'
                    : 'En Chrome abrí el menú (⋮) y elegí “Instalar app” o “Agregar a la pantalla principal”.'}
                </p>
              )}
            </Section>
          )}
        </div>

        <div className="space-y-4">
          <Section icon={BookOpen} title="Libro actual" description="Cada libro tiene sus propios movimientos, cheques y categorías.">
            <div className="space-y-2">
              <Label htmlFor="s-wname">Nombre del libro</Label>
              <Input id="s-wname" className="h-11" value={walletName} onChange={(e) => setWalletName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Moneda</Label>
              <Select value={walletCurrency} onValueChange={setWalletCurrency}>
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
            <div className="flex flex-wrap gap-2">
              <Button onClick={saveWallet} disabled={savingWallet || !walletName.trim() || !canEdit}>
                {savingWallet && <Loader2 className="animate-spin" />} Guardar libro
              </Button>
              <Button variant="outline" onClick={() => setNewWalletOpen(true)}>
                <Plus /> Nuevo libro
              </Button>
              {wallets.length > 1 && isOwner && (
                <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirmDeleteWallet(true)} disabled={deletingWallet}>
                  {deletingWallet && <Loader2 className="animate-spin" />} Eliminar libro
                </Button>
              )}
            </div>
          </Section>

          <Section icon={Users} title="Personas con acceso" description="Compartí este libro para ver o anotar en las mismas cuentas.">
            <MembersManager />
          </Section>

          <Section icon={Tags} title="Categorías" description={`Del libro “${activeWallet?.name}”.`}>
            <CategoryManager />
          </Section>

          <Card>
            <CardContent className="p-4">
              <Button variant="ghost" className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={logout}>
                <LogOut /> Cerrar sesión
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <NewWalletDialog open={newWalletOpen} onOpenChange={setNewWalletOpen} />
      <ConfirmDialog
        open={confirmDeleteWallet}
        onOpenChange={setConfirmDeleteWallet}
        title={`¿Eliminar el libro “${activeWallet?.name}”?`}
        description="Se borran para siempre todos sus movimientos, cheques, presupuestos y categorías. Esta acción no se puede deshacer."
        confirmLabel="Eliminar todo"
        onConfirm={removeWallet}
      />
    </div>
  );
}
