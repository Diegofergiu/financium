import { redirect } from "next/navigation"

export default function Home() {
  // In a real app, we'd check auth state here
  redirect("/dashboard")
}