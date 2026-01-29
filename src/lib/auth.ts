import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { validateCredentials } from "./auth-utils"

export { validateCredentials } from "./auth-utils"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        return validateCredentials(
          credentials?.username as string | undefined,
          credentials?.password as string | undefined
        )
      }
    })
  ],
  pages: {
    signIn: "/login"
  }
})
