'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleAuthProvider, getRedirectResult, signInWithPopup, signInWithRedirect, type Auth } from 'firebase/auth';
import { useAuth, useUser } from '@/firebase';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldCheck, Bell, PieChart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function authErrorMessage(error: any): string {
  const code: string = error?.code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-credential': 'El correo o la contraseña no son correctos.',
    'auth/wrong-password': 'La contraseña no es correcta.',
    'auth/user-not-found': 'No existe una cuenta con ese correo.',
    'auth/invalid-email': 'El correo no tiene un formato válido.',
    'auth/email-already-in-use': 'Ya existe una cuenta con ese correo. Probá iniciar sesión.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/too-many-requests': 'Demasiados intentos. Esperá unos minutos y volvé a probar.',
    'auth/network-request-failed': 'Sin conexión a internet. Revisá tu red.',
    'auth/popup-closed-by-user': 'Cerraste la ventana de Google antes de terminar.',
    'auth/cancelled-popup-request': 'Se canceló el inicio con Google.',
    'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase (Authentication → Settings → Authorized domains).',
    'auth/operation-not-allowed': 'Este método de acceso no está habilitado en Firebase.',
    'auth/missing-email': 'Ingresá tu correo.',
  };
  return map[code] ?? 'Ocurrió un error inesperado. Probá de nuevo.';
}

export async function signInWithGoogle(auth: Auth) {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
  } catch (e: any) {
    // En algunos celulares (o apps instaladas) las ventanas emergentes están bloqueadas: usamos redirección
    if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw e;
  }
}

export const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

export function GoogleButton({ disabled, onBusy }: { disabled?: boolean; onBusy?: (b: boolean) => void }) {
  const auth = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setLoading(true);
    onBusy?.(true);
    try {
      await signInWithGoogle(auth);
    } catch (e) {
      toast({ variant: 'destructive', title: 'No se pudo entrar con Google', description: authErrorMessage(e) });
    } finally {
      setLoading(false);
      onBusy?.(false);
    }
  };

  return (
    <Button type="button" variant="outline" size="lg" className="h-12 w-full gap-3 text-base" onClick={handle} disabled={disabled || loading}>
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon />}
      Continuar con Google
    </Button>
  );
}

export function OrDivider() {
  return (
    <div className="relative my-1 flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
      <span className="h-px flex-1 bg-border" />o<span className="h-px flex-1 bg-border" />
    </div>
  );
}

/** Contenedor visual de las pantallas de acceso. Redirige al panel si ya hay sesión. */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!isUserLoading && user) router.replace('/dashboard');
  }, [user, isUserLoading, router]);

  // Resultado del acceso con Google por redirección (celulares)
  useEffect(() => {
    getRedirectResult(auth).catch((e) => {
      toast({ variant: 'destructive', title: 'No se pudo entrar con Google', description: authErrorMessage(e) });
    });
  }, [auth, toast]);

  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-[#0B3B35] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[#1F8A76]/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-[#E9A23B]/20 blur-3xl" />
        <Logo className="relative [&_span]:text-white" subtitle={false} />
        <div className="relative max-w-md space-y-6">
          <h2 className="font-headline text-4xl font-extrabold leading-tight">
            Tu plata, ordenada.
            <br />
            <span className="text-[#FFD27A]">Sin planillas ni papelitos.</span>
          </h2>
          <ul className="space-y-4 text-white/85">
            <li className="flex gap-3"><PieChart className="mt-0.5 h-5 w-5 shrink-0 text-[#FFD27A]" />Mirá en qué se va cada peso, mes a mes.</li>
            <li className="flex gap-3"><Bell className="mt-0.5 h-5 w-5 shrink-0 text-[#FFD27A]" />Avisos antes de que venza un cheque o te pases del presupuesto.</li>
            <li className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#FFD27A]" />Tus datos son privados y quedan guardados en la nube.</li>
          </ul>
        </div>
        <p className="relative text-sm text-white/50">© {new Date().getFullYear()} Mi Bolsillo</p>
      </aside>

      <main className="flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-6">
            <Logo className="lg:hidden" />
            <div className="space-y-1.5">
              <h1 className="font-headline text-3xl font-extrabold">{title}</h1>
              <p className="text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          {children}
          <div className="text-center text-sm text-muted-foreground">{footer}</div>
        </div>
      </main>
    </div>
  );
}
