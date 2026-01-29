import { SessionProvider } from "next-auth/react"
import { auth } from "@/lib/auth"
import { Header } from "@/components/shared/Header"
import { QueryProvider } from "@/components/providers/QueryProvider"

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  return (
    <SessionProvider session={session}>
      <QueryProvider>
        <Header />
        <main className="container mx-auto py-6">
          {children}
        </main>
      </QueryProvider>
    </SessionProvider>
  )
}
