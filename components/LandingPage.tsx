
import React from 'react';
import { Gym, Language } from '../types';

interface LandingPageProps {
  gyms: Gym[];
  onSelectGym: (gymId: string) => void;
  onLoginClick: () => void;
  onSignupClick: () => void;
  lang: Language;
}

const LandingPage: React.FC<LandingPageProps> = ({ gyms, onSelectGym, onLoginClick, onSignupClick }) => {
  const handleExplore = () => {
    if (gyms[0]) onSelectGym(gyms[0].id);
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <nav className="relative z-30 flex items-center justify-between px-6 md:px-8 py-4 border-b border-white/10 bg-black/60 backdrop-blur-sm">
        <div className="flex items-center gap-9">
          <div className="flex items-center gap-2 font-black text-base tracking-tight">
            <span className="w-6 h-6 rounded-md bg-lime-400 text-black flex items-center justify-center text-xs font-black">G</span>
            GYDE
          </div>
          <div className="hidden md:flex items-center gap-7">
            <span className="text-sm font-medium text-slate-400">Features</span>
            <span className="text-sm font-medium text-slate-400">How It Works</span>
            <span className="text-sm font-medium text-slate-400">Locations</span>
          </div>
        </div>
        <button onClick={onLoginClick} className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
          Login
        </button>
      </nav>

      <div className="relative px-6 pt-20 md:pt-32 pb-16 md:pb-24 text-center overflow-hidden">
        <div
          className="absolute inset-0 z-0 blur-[10px] pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 700px 500px at 22% 30%, rgba(163,230,53,0.35), transparent 60%), radial-gradient(ellipse 700px 500px at 78% 55%, rgba(56,189,248,0.30), transparent 60%), radial-gradient(ellipse 500px 400px at 50% 90%, rgba(132,204,22,0.18), transparent 60%)',
          }}
        />
        <div className="relative z-10 max-w-4xl mx-auto">
          <h1 className="text-white text-4xl sm:text-5xl md:text-7xl font-black tracking-tight leading-[1.05] mb-6 md:mb-7">
            Train smarter with<br />a map of your gym
          </h1>
          <p className="text-base md:text-lg text-slate-300 max-w-xl mx-auto mb-8 md:mb-10 leading-relaxed">
            Your training plan, proper technique, and a map to every machine — built for beginners.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onSignupClick}
              className="w-full sm:w-auto bg-white text-black font-bold text-sm px-7 py-3.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Get Started
            </button>
            <button
              onClick={handleExplore}
              className="w-full sm:w-auto bg-white/5 border border-white/10 text-white font-bold text-sm px-7 py-3.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              See How It Works
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
