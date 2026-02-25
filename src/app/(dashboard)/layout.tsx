'use client';

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { useWalletStore } from "@/store/use-wallet-store";
import { collection, query, where, orderBy } from "firebase/firestore";
import { Loader2 } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const db = useFirestore();
  const { activeWallet, setActiveWallet } = useWalletStore();

  const walletsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(db, "wallets"),
      where("ownerId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
  }, [db, user]);

  const { data: wallets, isLoading: isWalletsLoading } = useCollection(walletsQuery);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push("/login");
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    if (wallets && wallets.length > 0 && !activeWallet) {
      setActiveWallet(wallets[0]);
    }
  }, [wallets, activeWallet, setActiveWallet]);

  if (isUserLoading || (user && isWalletsLoading)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 sticky top-0 bg-background/80 backdrop-blur-sm z-10">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex-1">
            <h1 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Financium App</h1>
          </div>
          <div className="flex items-center gap-4">
             {activeWallet && (
               <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold">
                 <span>Libro: {activeWallet.name}</span>
               </div>
             )}
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-8 pt-4 overflow-auto bg-[#F7F9FB] dark:bg-background">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
