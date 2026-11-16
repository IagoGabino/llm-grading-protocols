"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Code2, User, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function Header() {
    const { isAuthenticated, logout } = useAuth();
    const pathname = usePathname();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const isActive = (path: string) => pathname === path;

    const navLinks = [
        { href: "/questions", label: "Questões" },
        { href: "/attempts", label: "Minhas Tentativas" },
        { href: "/profile", label: "Perfil" },
    ];

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto flex h-14 max-w-7xl items-center px-4">
                <Link href="/" className="mr-4 flex items-center space-x-2 md:mr-6">
                    <Code2 className="h-6 w-6 text-primary" />
                    <span className="text-lg font-bold">DevPractice</span>
                </Link>

                {/* Desktop Navigation */}
                {isAuthenticated && (
                    <nav className="hidden flex-1 items-center space-x-6 text-sm font-medium md:flex">
                        {navLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={cn(
                                    "transition-colors hover:text-foreground/80",
                                    isActive(link.href) ? "text-foreground" : "text-foreground/60"
                                )}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </nav>
                )}

                <div className="ml-auto flex items-center space-x-2">
                    {/* Mobile Menu */}
                    {isAuthenticated && (
                        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" className="md:hidden">
                                    <Menu className="h-5 w-5" />
                                    <span className="sr-only">Abrir menu</span>
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="right" className="w-[280px] sm:w-[350px]">
                                <SheetHeader>
                                    <SheetTitle>Menu</SheetTitle>
                                </SheetHeader>
                                <nav className="flex flex-col space-y-4">
                                    {navLinks.map((link) => (
                                        <Link
                                            key={link.href}
                                            href={link.href}
                                            onClick={() => setMobileMenuOpen(false)}
                                            className={cn(
                                                "rounded-md px-3 py-2 text-base font-medium transition-colors hover:bg-accent",
                                                isActive(link.href)
                                                    ? "bg-accent text-accent-foreground"
                                                    : "text-foreground/60"
                                            )}
                                        >
                                            {link.label}
                                        </Link>
                                    ))}
                                    <div className="border-t pt-4">
                                        <Button
                                            variant="ghost"
                                            className="w-full justify-start px-3"
                                            onClick={() => {
                                                logout();
                                                setMobileMenuOpen(false);
                                            }}
                                        >
                                            Sair
                                        </Button>
                                    </div>
                                </nav>
                            </SheetContent>
                        </Sheet>
                    )}

                    {/* Desktop User Menu */}
                    {isAuthenticated ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="hidden md:flex">
                                    <User className="h-5 w-5" />
                                    <span className="sr-only">Abrir menu do usuário</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-popover">
                                <DropdownMenuItem asChild>
                                    <Link href="/profile">Perfil</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={logout}>Sair</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <Button asChild size="sm">
                            <Link href="/login">Entrar</Link>
                        </Button>
                    )}
                </div>
            </div>
        </header>
    );
}
