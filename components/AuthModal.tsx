
import React, { useState } from 'react';
import { X, Mail, User, Loader2, ArrowRight } from 'lucide-react';
import { api } from '../services/api';
import { User as UserType } from '../types';

interface AuthModalProps {
  onClose: () => void;
  onSuccess: (user: UserType) => void;
  initialMode?: 'login' | 'signup';
}

const AuthModal: React.FC<AuthModalProps> = ({ onClose, onSuccess, initialMode = 'login' }) => {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let user;
      if (mode === 'login') {
        user = await api.login(email);
      } else {
        if (!name) throw new Error('Name is required');
        user = await api.signup(name, email);
      }
      onSuccess(user);
      onClose();
    } catch (err) {
      setError(mode === 'login' ? 'User not found. Try signing up.' : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Decorative Header */}
        <div className="h-32 bg-gradient-to-br from-lime-500/20 to-blue-500/20 relative flex items-center justify-center">
            <div className="absolute top-4 right-4 z-20">
                <button onClick={onClose} className="p-2 bg-black/20 hover:bg-black/40 rounded-full text-white transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>
            <div className="text-center z-10">
                <h2 className="text-3xl font-black text-white tracking-tight">GY<span className="text-lime-500">DE</span></h2>
                <p className="text-slate-300 text-sm mt-1 font-medium">{mode === 'login' ? 'Welcome Back' : 'Join the Movement'}</p>
            </div>
            {/* Grid Pattern */}
            <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
           {error && (
             <div className="p-3 bg-red-950/30 border border-red-900/50 rounded-lg text-red-400 text-xs text-center">
               {error}
             </div>
           )}

           {mode === 'signup' && (
             <div className="space-y-1.5">
               <label className="text-xs font-bold text-slate-500 uppercase ml-1">Full Name</label>
               <div className="relative">
                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                   <User className="h-4 w-4 text-slate-500" />
                 </div>
                 <input
                   type="text"
                   required
                   value={name}
                   onChange={(e) => setName(e.target.value)}
                   className="block w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-600 focus:ring-2 focus:ring-lime-500/50 focus:border-lime-500 transition-all sm:text-sm"
                   placeholder="John Doe"
                 />
               </div>
             </div>
           )}

           <div className="space-y-1.5">
             <label className="text-xs font-bold text-slate-500 uppercase ml-1">Email Address</label>
             <div className="relative">
               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                 <Mail className="h-4 w-4 text-slate-500" />
               </div>
               <input
                 type="email"
                 required
                 value={email}
                 onChange={(e) => setEmail(e.target.value)}
                 className="block w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-600 focus:ring-2 focus:ring-lime-500/50 focus:border-lime-500 transition-all sm:text-sm"
                 placeholder="you@example.com"
               />
             </div>
           </div>

           <button
             type="submit"
             disabled={loading}
             className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-slate-900 bg-lime-500 hover:bg-lime-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-lime-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4"
           >
             {loading ? (
               <Loader2 className="w-5 h-5 animate-spin" />
             ) : (
               <>
                 {mode === 'login' ? 'Sign In' : 'Create Account'}
                 <ArrowRight className="ml-2 w-4 h-4" />
               </>
             )}
           </button>

           <div className="text-center mt-6">
             <p className="text-xs text-slate-400">
               {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
               <button 
                 type="button"
                 onClick={() => {
                    setMode(mode === 'login' ? 'signup' : 'login');
                    setError(null);
                 }}
                 className="font-bold text-lime-500 hover:text-lime-400 underline decoration-dashed underline-offset-4"
               >
                 {mode === 'login' ? 'Sign up' : 'Log in'}
               </button>
             </p>
           </div>
        </form>
      </div>
    </div>
  );
};

export default AuthModal;
