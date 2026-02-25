"use client"

import * as React from "react"
import {
  LayoutDashboard,
  ArrowLeftRight,
  Ticket,
  Target,
  Settings,
  Wallet as WalletIcon,
  PlusCircle,
  TrendingUp,
  ChevronRight,
  User,
  LogOut,
  Plus
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useWalletStore } from "@/store/use-wallet-store"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useUser, useAuth, useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { signOut } from "firebase/auth"
import { collection, query, where, orderBy, addDoc, serverTimestamp } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const navigationItems = [
  { name: "Panel Control", icon: LayoutDashboard, href: "/dashboard" },
  { name: "Transacciones", icon: ArrowLeftRight, href: "/transactions" },
  { name: "Cheques", icon: Ticket, href: "/checks" },
  { name: "Presupuestos", icon: Target, href: "/budgets" },
]

export function AppSidebar() {
  const { activeWallet, setActiveWallet } = useWalletStore()
  const { user } = useUser()
  const auth = useAuth()
  const db = useFirestore()
  const pathname = usePathname()
  const router = useRouter()
  const { toast } = useToast()

  const [newWalletName, setNewWalletName] = React.useState("")
  const [isCreating, setIsCreating] = React.useState(false)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)

  const walletsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(db, "wallets"),
      where("ownerId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
  }, [db, user]);

  const { data: wallets } = useCollection(walletsQuery);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const handleCreateWallet = async () => {
    if (!user || !newWalletName.trim()) return;
    setIsCreating(true);
    try {
      const docRef = await addDoc(collection(db, "wallets"), {
        name: newWalletName,
        ownerId: user.uid,
        members: { [user.uid]: 'owner' },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      // Crear categorías por defecto
      const cats = ["Comida", "Salud", "Transporte", "Ocio", "Varios"];
      for (const cat of cats) {
        await addDoc(collection(db, "wallets", docRef.id, "categories"), {
          name: cat,
          colorHex: "#3b82f6",
          walletOwnerId: user.uid,
          walletMembersMap: { [user.uid]: 'owner' },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      toast({ title: "Libro creado con éxito" });
      setNewWalletName("");
      setIsDialogOpen(false);
    } catch (e) {
      toast({ variant: "destructive", title: "Error al crear libro" });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2 px-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div className="flex flex-col gap-0.5 leading-none group-data-[collapsible=icon]:hidden">
            <span className="font-bold text-lg tracking-tight">Financium</span>
            <span className="text-[10px] text-muted-foreground italic">Suite Bancaria Premium</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menú</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={pathname === item.href}
                    tooltip={item.name}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Libros Contables</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton className="h-12" tooltip="Cambiar Libro">
                      <WalletIcon className="h-4 w-4 text-accent" />
                      <div className="flex flex-col items-start text-xs overflow-hidden group-data-[collapsible=icon]:hidden text-left">
                        <span className="font-semibold truncate w-[140px]">
                          {activeWallet?.name || "Seleccionar Libro"}
                        </span>
                        <span className="text-muted-foreground">Cuenta Activa</span>
                      </div>
                      <ChevronRight className="ml-auto h-4 w-4 group-data-[collapsible=icon]:hidden" />
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="start">
                    <DropdownMenuLabel>Tus Libros</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {wallets?.map((w) => (
                      <DropdownMenuItem key={w.id} onClick={() => setActiveWallet(w)}>
                        <WalletIcon className="mr-2 h-4 w-4" />
                        <span>{w.name}</span>
                        {activeWallet?.id === w.id && <div className="ml-auto h-2 w-2 rounded-full bg-green-500" />}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                      <DialogTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                          <PlusCircle className="mr-2 h-4 w-4" />
                          <span>Nuevo Libro</span>
                        </DropdownMenuItem>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Crear Nuevo Libro Contable</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="name">Nombre del Libro</Label>
                            <Input 
                              id="name" 
                              placeholder="Ej: Finanzas Empresa X" 
                              value={newWalletName}
                              onChange={(e) => setNewWalletName(e.target.value)}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                          <Button onClick={handleCreateWallet} disabled={isCreating}>
                            {isCreating ? "Creando..." : "Crear Libro"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Ajustes">
              <Link href="/settings">
                <Settings />
                <span>Configuración</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
             <SidebarMenuButton className="h-12" onClick={handleLogout}>
               <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                 <User className="h-5 w-5" />
               </div>
               <div className="flex flex-col gap-0.5 leading-none group-data-[collapsible=icon]:hidden overflow-hidden text-left">
                 <span className="font-medium truncate">{user?.displayName || "Usuario"}</span>
                 <span className="text-[10px] text-muted-foreground truncate">{user?.email}</span>
               </div>
               <LogOut className="ml-auto h-4 w-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
             </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
