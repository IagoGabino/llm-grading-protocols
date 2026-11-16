"use client";

import { SessionProvider, useSession, signIn, signOut } from "next-auth/react";
import { createContext, useContext, type ReactNode } from "react";

interface AuthContextValue {
    isAuthenticated: boolean;
    user: {
        id: string;
        email: string;
        name: string | null;
        image: string | null;
    } | null;
    login: (provider?: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function AuthProviderInner({ children }: { children: ReactNode }) {
    const { data: session, status } = useSession();

    const login = async (provider: string = "google") => {
        await signIn(provider, { callbackUrl: "/questions" });
    };

    const logout = async () => {
        await signOut({ callbackUrl: "/" });
    };

    return (
        <AuthContext.Provider
            value={{
                isAuthenticated: status === "authenticated",
                user: session?.user
                    ? {
                          id: (session.user as { id?: string }).id || "",
                          email: session.user.email || "",
                          name: session.user.name ?? null,
                          image: session.user.image ?? null,
                      }
                    : null,
                login,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function AuthProvider({ children }: { children: ReactNode }) {
    return (
        <SessionProvider>
            <AuthProviderInner>{children}</AuthProviderInner>
        </SessionProvider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within AuthProvider");
    }
    return context;
}
