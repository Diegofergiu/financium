'use client';

import { useUser, useAuth, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Settings, User, LogOut, Save, ShieldCheck, CreditCard } from "lucide-react";
import { signOut, updateProfile } from "firebase/auth";
import { useRouter } from "next/navigation";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { user } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user?.displayName) setDisplayName(user.displayName);
  }, [user]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await updateProfile(user, { displayName });
      await updateDoc(doc(db, "users", user.uid), {
        displayName,
        updatedAt: serverTimestamp(),
      });
      toast({ title: "Perfil actualizado con éxito" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al actualizar perfil" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 pt-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center text-white shrink-0">
          <Settings className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Configuración</h2>
          <p className="text-muted-foreground">Administra tu perfil y preferencias de la cuenta.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <CardTitle>Perfil de Usuario</CardTitle>
            </div>
            <CardDescription>Información básica de tu identidad en Financium.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico (No modificable)</Label>
              <Input id="email" value={user?.email || ""} disabled className="bg-slate-50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Nombre Público</Label>
              <Input 
                id="name" 
                value={displayName} 
                onChange={(e) => setDisplayName(e.target.value)} 
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-between border-t p-6 mt-4">
            <Button variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar Sesión
            </Button>
            <Button onClick={handleSaveProfile} disabled={isSaving}>
              {isSaving ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </CardFooter>
        </Card>

        <div className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <CardTitle>Seguridad</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">La autenticación de doble factor y cambios de contraseña se gestionan externamente para tu seguridad.</p>
              <Button variant="outline" className="w-full">Gestionar Seguridad</Button>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <CardTitle>Suscripción</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                <p className="text-sm font-bold text-primary mb-1">Plan Premium</p>
                <p className="text-xs text-muted-foreground">Acceso total a módulos de cheques e IA ilimitada.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
