'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AuthShell, GoogleButton, OrDivider, authErrorMessage } from '@/components/auth/auth-shell';

export default function LoginPage() {
  const auth = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      toast({ variant: 'destructive', title: 'No pudimos iniciar sesión', description: authErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email.trim()) {
      toast({ title: 'Escribí tu correo arriba', description: 'Te enviaremos un enlace para crear una nueva contraseña.' });
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      toast({ title: 'Revisá tu correo', description: `Si existe una cuenta con ${email.trim()}, te llegará un enlace para cambiar la contraseña.` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'No se pudo enviar el correo', description: authErrorMessage(error) });
    }
  };

  return (
    <AuthShell
      title="¡Hola de nuevo!"
      subtitle="Entrá para ver cómo vienen tus cuentas."
      footer={
        <>
          ¿Primera vez acá?{' '}
          <Link href="/register" className="font-semibold text-primary hover:underline">
            Creá tu cuenta
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        <GoogleButton disabled={loading} onBusy={setBusy} />
        <OrDivider />
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input id="email" type="email" autoComplete="email" inputMode="email" placeholder="nombre@ejemplo.com" className="h-12" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Contraseña</Label>
              <button type="button" onClick={handleReset} className="text-sm font-medium text-primary hover:underline">
                ¿La olvidaste?
              </button>
            </div>
            <div className="relative">
              <Input id="password" type={showPass ? 'text' : 'password'} autoComplete="current-password" className="h-12 pr-12" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button type="button" onClick={() => setShowPass((v) => !v)} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted-foreground hover:text-foreground" aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                {showPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={loading || busy}>
            {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            Entrar
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
