import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../services/api';
import { User as UserType, Language } from '../types';

interface AuthModalProps {
  onClose: () => void;
  onSuccess: (user: UserType) => void;
  initialMode?: 'login' | 'signup';
  lang: Language;
}

declare global {
  interface Window {
    google?: any;
  }
}

const GOOGLE_CLIENT_ID = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID as string | undefined;

const AuthModal: React.FC<AuthModalProps> = ({ onClose, onSuccess, lang }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setError('Google sign-in is not configured yet.');
      return;
    }

    let cancelled = false;
    let attempts = 0;
    setError(null);

    const handleCredentialResponse = async (response: any) => {
      setLoading(true);
      setError(null);
      try {
        const user = await api.googleLogin(response.credential);
        onSuccess(user);
        onClose();
      } catch (err) {
        setError('Sign-in failed. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    const tryInit = () => {
      if (cancelled) return;
      if (window.google?.accounts?.id && buttonRef.current) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
        });
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: 'filled_black',
          size: 'large',
          width: 320,
          text: 'continue_with',
        });
      } else if (attempts < 50) {
        attempts += 1;
        setTimeout(tryInit, 100);
      } else {
        // This means Google's identity script itself never finished
        // loading in this browser — most often an ad-blocker/privacy
        // extension or a restrictive network blocking
        // accounts.google.com/gsi/client, not anything about which
        // Google account is being used (that check happens later, inside
        // Google's own flow, well past this point).
        setError('Could not load Google sign-in. This is usually caused by an ad-blocker, privacy extension, or restrictive network blocking Google’s sign-in script — try disabling extensions for this site, switching networks, or a different browser.');
      }
    };

    tryInit();
    return () => { cancelled = true; };
  }, [onSuccess, onClose, retryCount]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh] my-auto animate-in zoom-in-95 duration-200">

        {/* Decorative Header */}
        <div className="h-28 sm:h-32 bg-gradient-to-br from-lime-500/20 to-blue-500/20 relative flex items-center justify-center flex-shrink-0">
            <div className="absolute top-3 right-3 z-20">
                <button
                  onClick={onClose}
                  className="p-2.5 bg-black/40 hover:bg-black/60 rounded-full text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label="Close"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
            <div className="text-center z-10 px-4">
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">GY<span className="text-lime-500">DE</span></h2>
                <p className="text-slate-300 text-xs sm:text-sm mt-1 font-medium">Sign in to continue</p>
            </div>
            {/* Grid Pattern */}
            <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
        </div>

        <div className="p-6 sm:p-8 space-y-4 sm:space-y-5 overflow-y-auto flex-1 flex flex-col items-center">
           {error && (
             <div className="w-full p-3 bg-red-950/30 border border-red-900/50 rounded-lg text-red-400 text-xs text-center font-medium space-y-2.5">
               <p>{error}</p>
               {GOOGLE_CLIENT_ID && (
                 <button
                   onClick={() => { setError(null); setRetryCount(c => c + 1); }}
                   className="text-[11px] font-bold text-red-300 underline hover:text-red-200 transition-colors"
                 >
                   Try again
                 </button>
               )}
             </div>
           )}

           <div ref={buttonRef} className="flex justify-center min-h-[44px]" />

           {loading && (
             <p className="text-xs text-slate-400 text-center">Signing you in…</p>
           )}

           <p className="text-xs text-slate-500 text-center pt-2">
             We use Google Sign-In only — no passwords stored.
           </p>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
