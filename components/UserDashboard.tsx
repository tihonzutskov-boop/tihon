
import React from 'react';
import { User, Gym, WorkoutPlan } from '../types';
import { Trophy, Flame, Clock, Calendar, LogOut, ArrowRight, Activity, MapPin, Dumbbell, ClipboardList, Target } from 'lucide-react';
import GymMap from './GymMap';

interface UserDashboardProps {
  user: User;
  gyms: Gym[];
  onLogout: () => void;
  onEnterGym: (gymId: string, plan?: WorkoutPlan) => void;
}

const UserDashboard: React.FC<UserDashboardProps> = ({ user, gyms, onLogout, onEnterGym }) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 animate-in fade-in duration-500">
      
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-lime-400 to-lime-600 rounded flex items-center justify-center text-slate-900 font-bold text-lg shadow-lg">
                G
              </div>
              <span className="font-bold text-lg text-white tracking-tight">GY<span className="text-lime-500">DE</span> Dashboard</span>
            </div>
            
            <div className="flex items-center space-x-4">
               <div className="hidden md:flex flex-col items-end mr-2">
                 <span className="text-sm font-bold text-white">{user.name}</span>
                 <span className="text-xs text-slate-500">{user.email}</span>
               </div>
               <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span className="text-lime-500 font-bold">{user.name.charAt(0)}</span>
                  )}
               </div>
               <button 
                 onClick={onLogout}
                 className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                 title="Log Out"
               >
                 <LogOut className="w-5 h-5" />
               </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Welcome Section */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white mb-2">Hello, {user.name.split(' ')[0]} 👋</h1>
          <p className="text-slate-400">Ready to crush your workout today?</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <StatCard 
            icon={Trophy} 
            value={user.stats?.workoutsCompleted || 0} 
            label="Workouts Completed" 
            color="text-yellow-400"
            bg="bg-yellow-950/30"
            borderColor="border-yellow-900/50"
          />
          <StatCard 
            icon={Flame} 
            value={user.stats?.streakDays || 0} 
            label="Day Streak" 
            color="text-orange-400" 
            bg="bg-orange-950/30"
            borderColor="border-orange-900/50"
          />
          <StatCard 
            icon={Clock} 
            value={Math.round((user.stats?.totalMinutes || 0) / 60)} 
            label="Total Hours" 
            color="text-blue-400" 
            bg="bg-blue-950/30"
            borderColor="border-blue-900/50"
            suffix="h"
          />
        </div>

        {/* My Training Plans Section */}
        {user.savedPlans && user.savedPlans.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center">
              <ClipboardList className="w-5 h-5 mr-2 text-blue-400" />
              My Training Plans
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {user.savedPlans.map(plan => (
                <div 
                  key={plan.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-blue-500/50 transition-all group flex flex-col h-full"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 bg-blue-950/50 rounded-lg flex items-center justify-center text-blue-400 border border-blue-900/30">
                      <Target className="w-5 h-5" />
                    </div>
                    {plan.lastPerformed && (
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                        Performed {plan.lastPerformed}
                      </span>
                    )}
                  </div>
                  
                  <h3 className="text-lg font-bold text-white mb-2">{plan.name}</h3>
                  
                  <div className="flex flex-wrap gap-2 mb-6">
                    <div className="flex items-center text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-1 rounded">
                      <Dumbbell className="w-3 h-3 mr-1" />
                      {plan.exercises.length} EXERCISES
                    </div>
                    <div className="flex items-center text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-1 rounded">
                      <Clock className="w-3 h-3 mr-1" />
                      {plan.totalDurationMinutes} MINS
                    </div>
                  </div>

                  <div className="mt-auto">
                    <button 
                      onClick={() => onEnterGym(gyms[0].id, plan)}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold flex items-center justify-center transition-all shadow-lg shadow-blue-900/20"
                    >
                      Start Session
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Gyms Section */}
        <div className="mb-8 flex items-center justify-between">
           <h2 className="text-xl font-bold text-white flex items-center">
             <MapPin className="w-5 h-5 mr-2 text-lime-400" />
             Available Locations
           </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {gyms.map(gym => (
            <button
              key={gym.id}
              onClick={() => onEnterGym(gym.id)}
              className="group bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-lime-500/50 hover:shadow-[0_0_20px_-5px_rgba(132,204,22,0.15)] transition-all flex flex-col text-left"
            >
              <div className="h-40 bg-slate-950 relative w-full border-b border-slate-800 overflow-hidden">
                <div className="absolute inset-0 p-4 opacity-60 group-hover:opacity-100 transition-opacity duration-500">
                   <GymMap zones={gym.zones} dimensions={gym.dimensions} entrance={gym.entrance} floorColor={gym.floorColor} annexes={gym.annexes} isThumbnail={true} />
                </div>
              </div>
              <div className="p-6">
                 <h3 className="text-lg font-bold text-white group-hover:text-lime-400 transition-colors mb-1">{gym.name}</h3>
                 <p className="text-sm text-slate-500 mb-4">{gym.zones.length} Zones • {gym.annexes ? gym.annexes.length : 0} Extensions</p>
                 <div className="flex items-center text-sm font-semibold text-lime-500 group-hover:translate-x-1 transition-transform">
                   Enter Gym <ArrowRight className="w-4 h-4 ml-1.5" />
                 </div>
              </div>
            </button>
          ))}
        </div>

        {/* Recent Activity */}
        <h2 className="text-xl font-bold text-white mb-6 flex items-center">
           <Activity className="w-5 h-5 mr-2 text-emerald-400" />
           Recent Activity
        </h2>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
           {[1, 2, 3].map((i) => (
             <div key={i} className="p-4 border-b border-slate-800 last:border-0 flex items-center justify-between hover:bg-slate-800/50 transition-colors">
                <div className="flex items-center space-x-4">
                   <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center border border-slate-700 text-slate-400">
                     <Dumbbell className="w-5 h-5" />
                   </div>
                   <div>
                     <h4 className="font-bold text-slate-200">Full Body Hypertrophy</h4>
                     <div className="flex items-center text-xs text-slate-500 space-x-2">
                        <span className="flex items-center"><Calendar className="w-3 h-3 mr-1" /> {i} days ago</span>
                        <span>•</span>
                        <span>45 mins</span>
                     </div>
                   </div>
                </div>
                <div className="text-right">
                   <span className="text-sm font-mono text-lime-400">Completed</span>
                </div>
             </div>
           ))}
        </div>

      </main>
    </div>
  );
};

const StatCard = ({ icon: Icon, value, label, color, bg, borderColor, suffix = '' }: any) => (
  <div className={`p-6 rounded-2xl border ${borderColor} ${bg} flex items-center space-x-4`}>
     <div className={`p-3 rounded-xl bg-slate-950/50 ${color}`}>
       <Icon className="w-6 h-6" />
     </div>
     <div>
       <div className="text-3xl font-black text-white tracking-tight">{value}{suffix}</div>
       <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</div>
     </div>
  </div>
);

export default UserDashboard;
