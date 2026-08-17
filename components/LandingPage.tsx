
import React from 'react';
import { Map, BrainCircuit, Activity, ArrowRight, MapPin, User } from 'lucide-react';
import { Gym, Language } from '../types';
import { translations } from '../translations';
import GymMap from './GymMap';

interface LandingPageProps {
  gyms: Gym[];
  onSelectGym: (gymId: string) => void;
  onLoginClick: () => void;
  lang: Language;
}

const LandingPage: React.FC<LandingPageProps> = ({ gyms, onSelectGym, onLoginClick, lang }) => {
  const t = translations[lang];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden text-slate-200">
       <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" 
            style={{ 
              backgroundImage: 'linear-gradient(#1e293b 1px, transparent 1px), linear-gradient(90deg, #1e293b 1px, transparent 1px)', 
              backgroundSize: '40px 40px' 
            }}>
       </div>
       
       <nav className="absolute top-0 w-full p-6 flex justify-end z-50">
          <button 
             onClick={onLoginClick}
             className="text-white hover:text-lime-400 text-sm font-bold flex items-center transition-colors px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-lime-500 shadow-lg"
           >
             <User className="w-4 h-4 mr-2" />
             {t.login} / {t.signup}
           </button>
       </nav>
       
       <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-lime-500/10 rounded-full blur-[128px] pointer-events-none" />
       <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[128px] pointer-events-none" />

       <div className="z-10 max-w-5xl px-6 text-center mt-24 md:mt-0 w-full flex flex-col items-center">
         <div className="mb-8 inline-flex items-center justify-center p-1.5 px-4 bg-slate-900/80 rounded-full border border-slate-800 backdrop-blur-sm shadow-xl">
           <span className="flex h-2 w-2 relative mr-3">
             <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime-400 opacity-75"></span>
             <span className="relative inline-flex rounded-full h-2 w-2 bg-lime-500"></span>
           </span>
           <span className="text-xs font-medium text-slate-300 tracking-wide uppercase">{t.landingTitle} v1.0</span>
         </div>
         
         <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight text-white mb-6 leading-tight">
           GY<span className="text-lime-500">DE</span>
         </h1>
         
         <p className="text-xl text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed">
           {t.landingDesc}
         </p>

         <div className="w-full max-w-3xl mb-20">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-6">{t.selectLocation}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 justify-center">
              {gyms.map((gym) => (
                <button 
                  key={gym.id}
                  onClick={() => onSelectGym(gym.id)}
                  className="group bg-slate-900/80 hover:bg-slate-800 backdrop-blur border border-slate-800 hover:border-lime-500/50 rounded-2xl overflow-hidden transition-all hover:shadow-[0_0_30px_-10px_rgba(132,204,22,0.15)] flex flex-col text-left"
                >
                  <div className="h-32 w-full bg-slate-950/50 border-b border-slate-800 relative">
                     <div className="absolute inset-0 p-4 opacity-70 group-hover:opacity-100 transition-opacity">
                        <GymMap zones={gym.zones} dimensions={gym.dimensions} entrance={gym.entrance} floorColor={gym.floorColor} annexes={gym.annexes} isThumbnail={true} />
                     </div>
                  </div>
                  <div className="p-6 flex items-center justify-between">
                     <div>
                       <h4 className="font-bold text-lg text-white group-hover:text-lime-400 transition-colors">{gym.name}</h4>
                       <div className="flex items-center text-xs text-slate-500 mt-1">
                         <MapPin className="w-3 h-3 mr-1" />
                         <span>{gym.zones.length} {t.zones}</span>
                       </div>
                     </div>
                     <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-lime-500 group-hover:text-slate-900 transition-colors">
                        <ArrowRight className="w-5 h-5" />
                     </div>
                  </div>
                </button>
              ))}
            </div>
         </div>
       </div>

       <div className="absolute bottom-6 w-full px-6 flex flex-col items-center justify-center space-y-2 z-20">
         <span className="text-xs text-slate-600 font-medium tracking-widest uppercase">Powered by Google Gemini</span>
       </div>
    </div>
  );
};

export default LandingPage;
