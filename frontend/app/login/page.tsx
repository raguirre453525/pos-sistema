'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

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
        <div className="min-h-screen flex items-center justify-center bg-white p-4 overflow-hidden">
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
                    <div className="bg-white rounded-[2rem] p-10 md:p-12 border border-gray-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
                        <h1 className="text-4xl md:text-[2.75rem] font-black text-black mb-12 tracking-tight">
                            Iniciar Sesión
                        </h1>

                        <form onSubmit={handleLogin} className="flex flex-col gap-10">
                            
                            <div>
                                <input
                                    type="text"
                                    placeholder="Nombre de Usuario"
                                    value={usuario}
                                    onChange={(e) => setUsuario(e.target.value)}
                                    className="w-full pb-2 text-gray-700 placeholder-gray-400 bg-transparent border-b-2 border-[#db4865] focus:outline-none focus:border-red-600 transition-colors"
                                    required
                                />
                            </div>

                            
                            <div>
                                <input
                                    type="password"
                                    placeholder="Contraseña"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pb-2 text-gray-700 placeholder-gray-400 bg-transparent border-b-2 border-[#db4865] focus:outline-none focus:border-red-600 transition-colors"
                                    required
                                />
                            </div>

                            
                            <div className="flex justify-end mt-2">
                                <button
                                    type="submit"
                                    className="bg-[#db4865] hover:bg-[#c23d57] text-white px-10 py-3 rounded-full font-medium transition-all duration-200"
                                >
                                    Ingresar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

            </div>
        </div>
    );
}