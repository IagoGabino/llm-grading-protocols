import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/server/db";
import { verifyPassword } from "./password";
import { getEnv } from "@/server/config/env";
import type { Adapter } from "next-auth/adapters";

const env = getEnv();

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: PrismaAdapter(prisma) as Adapter,
    providers: [
        GoogleProvider({
            clientId: env.GOOGLE_CLIENT_ID ?? "",
            clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
        }),
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email", placeholder: "seu@email.com" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                const email = credentials?.email as string | undefined;
                const password = credentials?.password as string | undefined;

                if (!email || !password) {
                    return null;
                }

                try {
                    // Find user by email
                    const user = await prisma.user.findUnique({
                        where: { email },
                    });

                    if (!user || !user.hashedPassword) {
                        return null;
                    }

                    // Verify password
                    const isPasswordValid = await verifyPassword(password, user.hashedPassword);

                    if (!isPasswordValid) {
                        return null;
                    }

                    // Return user object for session
                    return {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        image: user.image,
                    };
                } catch (error) {
                    console.error("Error in credentials authorization:", error);
                    return null;
                }
            },
        }),
    ],
    session: {
        strategy: "jwt",
    },
    pages: {
        signIn: "/login",
    },
    callbacks: {
        async jwt({ token, user }) {
            // Persist user id to token on sign in
            if (user) {
                token.sub = user.id;
            }
            return token;
        },
        async session({ session, token }) {
            // Add user id to session
            if (session.user && token.sub) {
                session.user.id = token.sub;
            }
            return session;
        },
    },
});
