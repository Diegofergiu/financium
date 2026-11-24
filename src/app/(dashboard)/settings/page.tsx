'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { Bell, BookOpen, Download, KeyRound, LogOut, Palette, Smartphone, Tags, User, Loader2, Settings, Plus } from 'lucide-react';
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
  const { theme, setTheme } = useTheme();
  const { activeWallet, wallets, deleteWallet, setActiveWalletId } = useWallet();
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
                      {notif.permission === 'denied' ? 'Bloqueadas por el navegador. Habilitalas desde la configuración del sitio.' : 'Te avisamos aunque estés en otra pestaña.'}
                    </p>
                  </div>
                  <Switch checked={notif.enabled && notif.permission === 'granted'} onCheckedChange={toggleNotifications} disabled={notif.permission === 'denied'} aria-label="Activar notificaciones" />
                </div>
                {notif.enabled && notif.permission === 'granted' && (
                  <Button variant="outline" size="sm" onClick={() => notif.sendTest()}>
                    Enviar notificación de prueba
                  </Button>
                )}
              </>
            )}
            <div className="space-y-2">
              <Label>Avisarme de cheques con</Label>
              <Select value={String(notif.notifyDays)} onValueChange={(v) => notif.setNotifyDays(Number(v))}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 3, 5, 7, 15, 30].map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d === 1 ? '1 día de anticipación' : `${d} días de anticipación`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
              <Button onClick={saveWallet} disabled={savingWallet || !walletName.trim()}>
                {savingWallet && <Loader2 className="animate-spin" />} Guardar libro
              </Button>
              <Button variant="outline" onClick={() => setNewWalletOpen(true)}>
                <Plus /> Nuevo libro
              </Button>
              {wallets.length > 1 && (
                <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirmDeleteWallet(true)} disabled={deletingWallet}>
                  {deletingWallet && <Loader2 className="animate-spin" />} Eliminar libro
                </Button>
              )}
            </div>
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
