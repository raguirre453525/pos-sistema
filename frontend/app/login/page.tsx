'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { Store } from 'lucide-react';

export default function Login() {
    const router = useRouter();
    const { login, loading: authLoading } = useAuth();
    const [usuario, setUsuario] = useState('');
    const [password, setPassword] = useState('');
    const [faseAnimacion, setFaseAnimacion] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const timer1 = setTimeout(() => setFaseAnimacion(1), 100);
        const timer2 = setTimeout(() => setFaseAnimacion(2), 1200);
        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
        };
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!usuario.trim() || !password) {
            setError("Usuario y contraseña requeridos");
            return;
        }
        setSubmitting(true);
        try {
            const profile = await login(usuario.trim(), password);
            if (profile.role === "SuperAdmin") {
                router.push("/Admin/Negocios");
            } else {
                router.push("/Ventas");
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Credenciales inválidas";
            setError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const isBusy = submitting || authLoading;

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4 overflow-hidden">
            <div className="max-w-7xl w-full flex flex-col md:flex-row items-center gap-12 md:gap-20">

                <div
                    className={`flex-1 flex flex-col items-center justify-center w-full transition-all duration-1000 ease-in-out relative z-10
            ${faseAnimacion === 0 ? 'opacity-0 translate-y-[calc(50%+1.5rem)] md:translate-y-0 md:translate-x-[calc(50%+1.5rem)]' : ''}
            ${faseAnimacion === 1 ? 'opacity-100 translate-y-[calc(50%+1.5rem)] md:translate-y-0 md:translate-x-[calc(50%+1.5rem)]' : ''}
            ${faseAnimacion === 2 ? 'opacity-100 translate-y-0 md:translate-x-0' : ''}
          `}
                >
                    <div className="flex flex-col items-center gap-4 text-center">
                        <div className="w-20 h-20 rounded-2xl bg-slate-900 dark:bg-white flex items-center justify-center shadow-sm">
                            <Store className="w-10 h-10 text-white dark:text-slate-900" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">MetraTC POS</span>
                            <span className="text-sm text-slate-500 dark:text-slate-400">Sistema de gestión comercial</span>
                        </div>
                    </div>
                </div>

                <div
                    className={`flex-1 w-full max-w-md transition-all duration-1000 ease-in-out relative z-0
            ${faseAnimacion < 2 ? 'opacity-0 -translate-y-[calc(50%+1.5rem)] md:-translate-y-0 md:-translate-x-[calc(50%+1.5rem)]' : 'opacity-100 translate-y-0 md:translate-x-0'}
          `}
                >
                    <Card className="p-8 md:p-10">
                        <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-2">
                            Iniciar Sesión
                        </h1>
                        <p className="text-sm text-muted-foreground mb-6">Ingresá tus credenciales</p>

                        <form onSubmit={handleLogin} className="flex flex-col gap-6">
                            <div>
                                <input
                                    type="text"
                                    placeholder="Nombre de Usuario"
                                    value={usuario}
                                    onChange={(e) => setUsuario(e.target.value)}
                                    className="w-full pb-2 text-sm text-foreground placeholder-muted-foreground bg-transparent border-b border-input focus:outline-none focus:border-ring transition-colors disabled:opacity-50"
                                    required
                                    disabled={isBusy}
                                    autoComplete="username"
                                />
                            </div>

                            <div>
                                <input
                                    type="password"
                                    placeholder="Contraseña"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pb-2 text-sm text-foreground placeholder-muted-foreground bg-transparent border-b border-input focus:outline-none focus:border-ring transition-colors disabled:opacity-50"
                                    required
                                    disabled={isBusy}
                                    autoComplete="current-password"
                                />
                            </div>

                            {error && (
                                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                    {error}
                                </div>
                            )}

                            <div className="flex justify-end mt-1">
                                <Button
                                    type="submit"
                                    className="px-8"
                                    disabled={isBusy}
                                >
                                    {submitting ? "Ingresando…" : "Ingresar"}
                                </Button>
                            </div>
                        </form>
                    </Card>
                </div>

            </div>
        </div>
    );
}
