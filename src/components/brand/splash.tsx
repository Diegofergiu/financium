import { LogoMark } from './logo';

export function SplashScreen() {
  return (
    <div className="flex min-h-[100dvh] w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <LogoMark className="h-16 w-16 animate-pulse" />
        <p className="text-sm font-medium text-muted-foreground">Abriendo Mi Bolsillo…</p>
      </div>
    </div>
  );
}
