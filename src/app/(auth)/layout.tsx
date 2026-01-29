import { SessionProvider } from "next-auth/react"
import { auth } from "@/lib/auth"
import { Header } from "@/components/shared/Header"

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  return (
    <SessionProvider session={session}>
      <Header />
      <main className="container mx-auto py-6">
        {children}
      </main>
    </SessionProvider>
  )
}
