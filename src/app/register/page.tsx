'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuth, useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AuthShell, GoogleButton, OrDivider, authErrorMessage } from '@/components/auth/auth-shell';

export default function RegisterPage() {
  const auth = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ variant: 'destructive', title: 'Contraseña muy corta', description: 'Usá al menos 6 caracteres.' });
      return;
    }
    setLoading(true);
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(user, { displayName: name.trim() });
      await setDoc(doc(db, 'users', user.uid), {
        id: user.uid,
        email: user.email,
        displayName: name.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      toast({ title: `¡Bienvenida/o, ${name.trim().split(' ')[0]}!`, description: 'Ya preparamos tu primer libro con categorías listas para usar.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'No pudimos crear la cuenta', description: authErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Creá tu cuenta"
      subtitle="Lleva un minuto. Después empezás a anotar."
      footer={
        <>
          ¿Ya tenés cuenta?{' '}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Iniciá sesión
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        <GoogleButton disabled={loading} onBusy={setBusy} />
        <OrDivider />
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Tu nombre</Label>
            <Input id="name" autoComplete="name" placeholder="Ej.: María" className="h-12" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input id="email" type="email" autoComplete="email" inputMode="email" placeholder="nombre@ejemplo.com" className="h-12" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <div className="relative">
              <Input id="password" type={showPass ? 'text' : 'password'} autoComplete="new-password" minLength={6} placeholder="Mínimo 6 caracteres" className="h-12 pr-12" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button type="button" onClick={() => setShowPass((v) => !v)} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted-foreground hover:text-foreground" aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                {showPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={loading || busy}>
            {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            Crear cuenta
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
