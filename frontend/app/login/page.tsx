'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function Login() {
    const router = useRouter();
    const [usuario, setUsuario] = useState('');
    const [password, setPassword] = useState('');

    const [faseAnimacion, setFaseAnimacion] = useState(0);

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
        setTimeout(() => {
            if (usuario === 'admin' && password === '1234') {
                router.push('/Dashboard');
            } else {
                alert('Usuario o contraseña incorrectos. (Usá admin y 1234)');
            }
        }, 1000);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4 overflow-hidden">
            <div className="max-w-7xl w-full flex flex-col md:flex-row items-center gap-12 md:gap-20">

                <div
                    className={`flex-1 flex justify-center w-full transition-all duration-1000 ease-in-out relative z-10
            ${faseAnimacion === 0 ? 'opacity-0 translate-y-[calc(50%+1.5rem)] md:translate-y-0 md:translate-x-[calc(50%+1.5rem)]' : ''}
            ${faseAnimacion === 1 ? 'opacity-100 translate-y-[calc(50%+1.5rem)] md:translate-y-0 md:translate-x-[calc(50%+1.5rem)]' : ''}
            ${faseAnimacion === 2 ? 'opacity-100 translate-y-0 md:translate-x-0' : ''}
          `}
                >
                    <img
                        src="/logo.png"
                        alt="Logo Repuestera El Chorolqui"
                        className="w-full max-w-[2400px] object-contain"
                    />
                </div>

                <div
                    className={`flex-1 w-full max-w-md transition-all duration-1000 ease-in-out relative z-0
            ${faseAnimacion < 2 ? 'opacity-0 -translate-y-[calc(50%+1.5rem)] md:-translate-y-0 md:-translate-x-[calc(50%+1.5rem)]' : 'opacity-100 translate-y-0 md:translate-x-0'}
          `}
                >
                    <Card className="p-8 md:p-10">
                        <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-8">
                            Iniciar Sesión
                        </h1>

                        <form onSubmit={handleLogin} className="flex flex-col gap-8">
                            <div>
                                <input
                                    type="text"
                                    placeholder="Nombre de Usuario"
                                    value={usuario}
                                    onChange={(e) => setUsuario(e.target.value)}
                                    className="w-full pb-2 text-sm text-foreground placeholder-muted-foreground bg-transparent border-b border-input focus:outline-none focus:border-ring transition-colors"
                                    required
                                />
                            </div>

                            <div>
                                <input
                                    type="password"
                                    placeholder="Contraseña"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pb-2 text-sm text-foreground placeholder-muted-foreground bg-transparent border-b border-input focus:outline-none focus:border-ring transition-colors"
                                    required
                                />
                            </div>

                            <div className="flex justify-end mt-2">
                                <Button
                                    type="submit"
                                    className="px-8"
                                >
                                    Ingresar
                                </Button>
                            </div>
                        </form>
                    </Card>
                </div>

            </div>
        </div>
    );
}
