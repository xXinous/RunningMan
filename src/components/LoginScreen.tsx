import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Terminal, Cpu, AlertTriangle, ChevronRight } from 'lucide-react';
import { loginOrCreate, loginWithProvider } from '../store/profile';
import type { MasterAccount } from '../types/player';

interface LoginScreenProps {
  onLogin: (account: MasterAccount) => void;
}

import RetroSpinner from './player/RetroSpinner';

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [masterId, setMasterId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterId.trim() || !password) return;
    
    const forbiddenChars = /[<>{}"'`=]/;
    if (forbiddenChars.test(masterId) || forbiddenChars.test(password)) {
      setError('CARACTERES PROIBIDOS DETECTADOS PELA SEGURANÇA');
      return;
    }

    setError(null);
    setIsLoggingIn(true);
    const result = await loginOrCreate(masterId.trim(), password);
    setIsLoggingIn(false);

    if (!result.ok) {
      setError((result as Extract<typeof result, { ok: false }>).message);
      return;
    }

    // Navega direto — animação de sucesso + AnimatePresence aninhado travava a troca de tela.
    onLogin(result.account);
  };

  const handleProviderLogin = async (provider: 'google' | 'apple') => {
    setError(null);
    setIsLoggingIn(true);
    const result = await loginWithProvider(provider);
    setIsLoggingIn(false);

    if (!result.ok) {
      setError((result as Extract<typeof result, { ok: false }>).message);
      return;
    }

    onLogin(result.account);
  };

  return (
    <div className="w-full h-full flex items-center justify-center p-4 overflow-y-auto relative safe-area-pad min-h-0">
      <div className="noise-overlay" />
      <div className="scanlines" />

      <div className="absolute inset-0 opacity-[0.04] pointer-events-none select-none overflow-hidden">
        <div className="absolute top-8 left-8 font-display text-[12vw] font-bold leading-none tracking-tighter text-industrial-silver">TAC-01</div>
        <div className="absolute bottom-8 right-8 font-display text-[12vw] font-bold leading-none tracking-tighter text-industrial-silver text-right">SYS-86</div>
      </div>

      <motion.div key="login-panel" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 1.05, y: -20 }} transition={{ duration: 0.4 }} className="w-full max-w-md relative">
        <div className="bg-surface-container-low p-1 relative shadow-2xl">
          <div className="absolute -top-3 right-6 bg-primary px-2 py-0.5 text-[10px] font-display font-bold text-black tracking-widest uppercase z-10">
            MASTER-AUTH-V1
          </div>
          <div className="bg-surface p-8">
            <div className="mb-10 border-l-4 border-primary pl-6">
              <h1 className="font-display text-4xl font-bold text-white tracking-tight uppercase mb-2">
                Terminal <span className="text-primary">Mestre</span>
              </h1>
              <p className="text-xs font-display uppercase tracking-[0.2em] text-industrial-silver/60">
                Ponto de Acesso à Rede LimboOS
              </p>
            </div>
            <form onSubmit={handleLogin} className="space-y-8">
              <div className="space-y-6">
                <div className="group">
                  <label className="block text-[10px] font-display font-bold uppercase tracking-[0.2em] mb-2 text-industrial-silver/60 group-focus-within:text-primary transition-colors">
                    ID Mestre ou E-mail (Contas Antigas)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-industrial-silver/40 group-focus-within:text-primary transition-colors">
                      <Terminal size={16} />
                    </div>
                    <input type="text" required value={masterId} onChange={e => setMasterId(e.target.value)}
                      placeholder="RM-USER-01 ou e-mail"
                      className="w-full bg-surface-container-lowest border-none py-4 pl-12 pr-4 text-white font-sans text-base tracking-wide focus:ring-0 placeholder:text-industrial-silver/20 outline-none" />
                    <div className="absolute bottom-0 left-0 h-0.5 w-0 bg-primary transition-all duration-300 group-focus-within:w-full" />
                  </div>
                </div>

                <div className="group">
                  <label className="block text-[10px] font-display font-bold uppercase tracking-[0.2em] mb-2 text-industrial-silver/60 group-focus-within:text-primary transition-colors">
                    Chave de Segurança
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-industrial-silver/40 group-focus-within:text-primary transition-colors">
                      <Lock size={16} />
                    </div>
                    <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-surface-container-lowest border-none py-4 pl-12 pr-4 text-white font-sans text-base tracking-wide focus:ring-0 placeholder:text-industrial-silver/20 outline-none" />
                    <div className="absolute bottom-0 left-0 h-0.5 w-0 bg-primary transition-all duration-300 group-focus-within:w-full" />
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="bg-red-900/20 border-l-2 border-red-500 p-3 flex items-center gap-3">
                    <AlertTriangle size={14} className="text-red-500 shrink-0" />
                    <span className="text-[10px] font-display font-bold text-red-500 uppercase tracking-wider">{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center justify-between gap-6 pt-2">
                <p className="text-[9px] font-display text-industrial-silver/30 uppercase tracking-widest leading-relaxed">
                  Novas contas são registradas<br />automaticamente no primeiro acesso.
                </p>
                <button type="submit" disabled={isLoggingIn}
                  className="shrink-0 bg-primary hover:bg-primary-container text-black font-display font-bold text-xs uppercase tracking-[0.2em] py-4 px-8 transition-all flex items-center justify-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed glow-orange active:scale-95">
                  {isLoggingIn ? (
                    <>
                      <RetroSpinner size="sm" />
                      Sincronizando...
                    </>
                  ) : (
                    <>Entrar no Sistema<ChevronRight size={16} className="transition-transform group-hover:translate-x-1" /></>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-8 pt-6 border-t border-industrial-silver/10 space-y-4">
              <div className="text-center">
                <span className="bg-surface px-4 text-[9px] font-display font-bold uppercase tracking-[0.2em] text-industrial-silver/40">
                  Ou autentique-se via
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => handleProviderLogin('google')}
                  disabled={isLoggingIn}
                  className="flex items-center justify-center gap-3 bg-surface-container-lowest hover:bg-white/5 border border-industrial-silver/10 py-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <span className="text-[10px] font-display font-bold uppercase tracking-widest text-industrial-silver">Google</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleProviderLogin('apple')}
                  disabled={isLoggingIn}
                  className="flex items-center justify-center gap-3 bg-surface-container-lowest hover:bg-white/5 border border-industrial-silver/10 py-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-industrial-silver" xmlns="http://www.w3.org/2000/svg">
                    <path d="M16.365 1.43c-.004.015-.008.03-.013.045C16.143 2.115 15.534 3.02 14.618 3.7c-.895.663-1.956 1.077-3.04 1.184a2.95 2.95 0 0 1-.027-.373c-.015-.99.373-1.996 1.055-2.732.682-.736 1.63-1.185 2.57-1.312a3.81 3.81 0 0 1 .158-.02c.003-.005.006-.01.009-.015a.014.014 0 0 1 .01-.01.012.012 0 0 1 .01.006.012.012 0 0 1 .002.002h.001ZM18.96 19.866c-1.137 1.634-2.316 3.266-4.135 3.303-1.782.037-2.366-1.042-4.412-1.042-2.046 0-2.684 1.005-4.375 1.08-1.782.073-3.136-1.78-4.274-3.414C-.626 16.33-1.396 10.96 1.013 7.643c1.173-1.614 2.946-2.64 4.885-2.677 1.745-.037 3.376 1.168 4.45 1.168 1.074 0 3.053-1.458 5.176-1.238 2.197.23 3.992 1.256 5.105 2.875-4.486 2.65-3.753 8.91 1.033 10.87-1.026 2.553-2.684 5.34-3.87 7.054Z"/>
                  </svg>
                  <span className="text-[10px] font-display font-bold uppercase tracking-widest text-industrial-silver">Apple</span>
                </button>
              </div>
            </div>
          </div>
          <div className="bg-surface-container-highest h-10 flex items-center px-8 justify-between">
            <div className="flex gap-1">
              {[1,2,3,4,5].map(i => (
                <div key={i} className={`w-1.5 h-3 ${isLoggingIn ? 'animate-pulse bg-primary' : 'bg-industrial-silver/20'}`} style={{ animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
            <div className="text-[9px] font-display text-industrial-silver/30 uppercase tracking-widest">Nó de Link: Ativo</div>
          </div>
        </div>
      </motion.div>

      <div className="hidden lg:block absolute left-12 top-1/2 -translate-y-1/2 space-y-12">
        <div className="space-y-4">
          <div className="flex items-center gap-3"><Cpu size={14} className="text-primary" /><span className="text-[10px] font-display font-bold uppercase tracking-widest text-industrial-silver">Acesso Mestre</span></div>
          <div className="w-48 h-1 bg-surface-container-highest overflow-hidden">
            <motion.div animate={{ x: ['-100%', '100%'] }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} className="w-1/3 h-full bg-primary" />
          </div>
        </div>
      </div>
    </div>
  );
}
