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
  User
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
import { useWalletStore } from "@/store/use-wallet-store"
import Link from "next/link"
import { usePathname } from "next/navigation"

const navigationItems = [
  { name: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { name: "Transactions", icon: ArrowLeftRight, href: "/transactions" },
  { name: "Checks", icon: Ticket, href: "/checks" },
  { name: "Budgets", icon: Target, href: "/budgets" },
]

export function AppSidebar() {
  const { activeWallet } = useWalletStore()
  const pathname = usePathname()

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2 px-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div className="flex flex-col gap-0.5 leading-none group-data-[collapsible=icon]:hidden">
            <span className="font-bold text-lg">Financium</span>
            <span className="text-xs text-muted-foreground italic">Premium Banking Suite</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
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
          <SidebarGroupLabel>Active Book</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton className="h-12" tooltip="Switch Book">
                  <WalletIcon className="h-4 w-4 text-accent" />
                  <div className="flex flex-col items-start text-xs overflow-hidden group-data-[collapsible=icon]:hidden">
                    <span className="font-semibold truncate w-full">
                      {activeWallet?.name || "Personal Wallet"}
                    </span>
                    <span className="text-muted-foreground">Main Account</span>
                  </div>
                  <ChevronRight className="ml-auto h-4 w-4 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton className="text-primary hover:text-primary/90 group-data-[collapsible=icon]:hidden">
                  <PlusCircle className="h-4 w-4" />
                  <span>Create New Book</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Account Settings">
              <Link href="/settings">
                <Settings />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
             <SidebarMenuButton className="h-12">
               <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                 <User className="h-5 w-5" />
               </div>
               <div className="flex flex-col gap-0.5 leading-none group-data-[collapsible=icon]:hidden overflow-hidden">
                 <span className="font-medium truncate">Julian Rossi</span>
                 <span className="text-[10px] text-muted-foreground truncate">julian@example.com</span>
               </div>
             </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}