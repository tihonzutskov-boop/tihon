
import React, { useState, useEffect } from 'react';
import GymMap from './components/GymMap';
import ExerciseSelector from './components/ExerciseSelector';
import ProgramList from './components/ProgramList';
import LandingPage from './components/LandingPage';
import AdminPage from './components/AdminPage';
import UserDashboard from './components/UserDashboard';
import AuthModal from './components/AuthModal';
import MachineDetailModal from './components/MachineDetailModal';
import { GymZone, WorkoutPlan, Exercise, Gym, GymMachine, User } from './types';
import { DEFAULT_GYM } from './constants';
import { api } from './services/api';
import { ChevronDown, MapPin, Loader2, Calendar, ClipboardList, ArrowLeft } from 'lucide-react';

type ViewState = 'landing' | 'app' | 'admin' | 'dashboard';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('landing');
  
  // State for multiple Gyms
  const [gyms, setGyms] = useState<Gym[]>([DEFAULT_GYM]);
  const [isLoading, setIsLoading] = useState(true);
  
  // User State
  const [user, setUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  // Track active gym for the user view
  const [activeGymId, setActiveGymId] = useState<string>('default-gym');
  
  // Load initial data from Backend
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const fetchedGyms = await api.fetchGyms();
        setGyms(fetchedGyms);
        // If the active ID isn't in the fetched list, reset to the first one
        if (!fetchedGyms.find(g => g.id === activeGymId)) {
          setActiveGymId(fetchedGyms[0]?.id || 'default-gym');
        }
      } catch (e) {
        console.error("Failed to load gyms", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []); // Run once on mount

  // Derived active gym data
  const activeGym = gyms.find(g => g.id === activeGymId) || gyms[0];
  const zones = activeGym?.zones || [];
  const dimensions = activeGym?.dimensions;
  const entrance = activeGym?.entrance;
  const floorColor = activeGym?.floorColor;
  const annexes = activeGym?.annexes;

  const [selectedZone, setSelectedZone] = useState<GymZone | null>(null);
  const [focusedZoneId, setFocusedZoneId] = useState<string | null>(null); // New Zoom State
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [isPlanOpen, setIsPlanOpen] = useState(false); // Toggle for Plan Sidebar
  const [viewingMachine, setViewingMachine] = useState<GymMachine | null>(null); // Machine Modal State
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan>({
    id: 'current-1',
    name: 'New Session',
    exercises: [],
    totalDurationMinutes: 0
  });

  const handleZoneClick = (zone: GymZone) => {
    if (focusedZoneId === zone.id) {
        // Already focused, open selector immediately
        setSelectedZone(zone);
        setIsSelectorOpen(true);
    } else {
        // Zoom in first, but DO NOT open selector automatically
        setFocusedZoneId(zone.id);
        setSelectedZone(zone);
        setIsSelectorOpen(false);
    }
  };

  const handleMapClick = () => {
    // Zoom out
    if (focusedZoneId) {
        setFocusedZoneId(null);
        setSelectedZone(null);
        setIsSelectorOpen(false);
    }
  };

  const handleMachineClick = (machine: GymMachine) => {
    setViewingMachine(machine);
  };

  const handleCloseSelector = () => {
    setIsSelectorOpen(false);
    setSelectedZone(null);
    // Note: We keep focus (zoom) when just closing the sidebar, 
    // user must click map background to zoom out fully.
  };

  const addExercise = (exercise: Exercise) => {
    setWorkoutPlan(prev => ({
      ...prev,
      exercises: [...prev.exercises, exercise]
    }));
    // Optionally open the plan to show the user it was added
    // setIsPlanOpen(true); 
  };

  const removeExercise = (id: string) => {
    setWorkoutPlan(prev => ({
      ...prev,
      exercises: prev.exercises.filter(ex => ex.id !== id)
    }));
  };

  const clearProgram = () => {
    setWorkoutPlan(prev => ({ ...prev, exercises: [] }));
  };

  const handleGymSelect = (gymId: string) => {
    setActiveGymId(gymId);
    setCurrentView('app');
  };

  // Auth Handlers
  const handleLoginClick = () => {
    setAuthMode('login');
    setShowAuthModal(true);
  };

  const handleSignupClick = () => {
    setAuthMode('signup');
    setShowAuthModal(true);
  };
  
  const handleAuthSuccess = (u: User) => {
    setUser(u);
    if (u.role === 'admin') {
      setCurrentView('admin');
    } else {
      setCurrentView('dashboard');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentView('landing');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-10 h-10 animate-spin mb-4 text-lime-500" />
        <p>Loading Gym Layouts...</p>
      </div>
    );
  }

  // --- View Routing ---

  if (currentView === 'landing') {
    return (
      <>
        <LandingPage 
          gyms={gyms}
          onSelectGym={handleGymSelect}
          onAdminEnter={() => setCurrentView('admin')} // Direct access without password
          onLoginClick={handleLoginClick} // Normal login flow
        />
        {showAuthModal && (
          <AuthModal 
            initialMode={authMode} 
            onClose={() => setShowAuthModal(false)}
            onSuccess={handleAuthSuccess}
          />
        )}
      </>
    );
  }

  if (currentView === 'dashboard' && user) {
     return (
       <UserDashboard 
         user={user}
         gyms={gyms}
         onLogout={handleLogout}
         onEnterGym={handleGymSelect}
       />
     );
  }

  if (currentView === 'admin') {
    return (
      <AdminPage 
        gyms={gyms} 
        setGyms={setGyms} 
        onExit={() => setCurrentView('landing')} 
      />
    );
  }

  // --- Main App View ---
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col overflow-hidden animate-in fade-in duration-700">
      {/* Navbar */}
      <header className="h-16 border-b border-slate-800 bg-slate-900 flex items-center px-6 justify-between flex-shrink-0 z-20 shadow-sm relative">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => setCurrentView(user ? 'dashboard' : 'landing')}>
            <div className="w-8 h-8 bg-gradient-to-br from-lime-400 to-lime-600 rounded flex items-center justify-center text-slate-900 font-bold text-xl shadow-lg shadow-lime-900/20 group-hover:scale-105 transition-transform">
              G
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white hidden sm:block">GY<span className="text-lime-500">DE</span></h1>
          </div>
          
          {/* Gym Selector (if multiple gyms exist) */}
          {gyms.length > 1 && (
            <div className="relative group hidden md:block">
              <div className="flex items-center space-x-2 text-sm text-slate-300 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors cursor-pointer border border-slate-700">
                <MapPin className="w-4 h-4 text-lime-400" />
                <span className="font-medium">{activeGym.name}</span>
                <ChevronDown className="w-4 h-4 text-slate-500" />
              </div>
              <select 
                value={activeGymId}
                onChange={(e) => setActiveGymId(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              >
                {gyms.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-4">
           {user && (
             <button 
                onClick={() => setCurrentView('dashboard')}
                className="hidden md:flex items-center text-xs font-bold text-slate-400 hover:text-white mr-4"
             >
                <ArrowLeft className="w-3 h-3 mr-1" />
                Dashboard
             </button>
           )}

           <button 
             onClick={() => setIsPlanOpen(!isPlanOpen)}
             className={`
               flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all border
               ${isPlanOpen 
                  ? 'bg-slate-800 text-lime-400 border-lime-500/50 shadow-[0_0_15px_-5px_rgba(132,204,22,0.3)]' 
                  : 'bg-transparent text-slate-400 border-transparent hover:bg-slate-800 hover:text-slate-200'}
             `}
           >
             <div className="relative">
               <ClipboardList className="w-5 h-5" />
               {workoutPlan.exercises.length > 0 && (
                 <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3">
                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime-400 opacity-75"></span>
                   <span className="relative inline-flex rounded-full h-3 w-3 bg-lime-500 text-[8px] text-slate-900 items-center justify-center font-bold"></span>
                 </span>
               )}
             </div>
             <span>My Plan</span>
             {workoutPlan.exercises.length > 0 && (
               <span className="bg-slate-700 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">
                 {workoutPlan.exercises.length}
               </span>
             )}
           </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden relative">
        
        {/* Left Drawer: Program List */}
        <div 
          className={`
            absolute top-0 bottom-0 left-0 w-80 md:w-96 z-30 transform transition-transform duration-300 ease-in-out shadow-2xl
            ${isPlanOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          <ProgramList 
            workout={workoutPlan} 
            onRemoveExercise={removeExercise}
            onClear={clearProgram}
            onClose={() => setIsPlanOpen(false)}
          />
        </div>

        {/* Center: Map Area */}
        <div className="flex-1 relative flex items-center justify-center bg-slate-950 overflow-hidden">
          {/* Backdrop overlay for mobile when sidebar is open */}
          <div 
             className={`absolute inset-0 bg-slate-950/50 backdrop-blur-sm z-20 transition-opacity duration-300 pointer-events-none md:hidden
               ${isPlanOpen || isSelectorOpen ? 'opacity-100' : 'opacity-0'}
             `} 
          />
          
          <div className="w-full h-full p-4 md:p-8">
            <GymMap 
              zones={zones}
              dimensions={dimensions}
              entrance={entrance}
              floorColor={floorColor}
              annexes={annexes}
              onZoneClick={handleZoneClick}
              onMapClick={handleMapClick}
              onMachineClick={handleMachineClick}
              selectedZoneId={selectedZone?.id || null}
              focusedZoneId={focusedZoneId} // Pass focus state
            />
          </div>
        </div>

        {/* Right Drawer: Exercise Selector */}
        <div 
          className={`
            absolute top-0 bottom-0 right-0 w-full md:w-[450px] z-30 transform transition-transform duration-300 ease-in-out shadow-2xl
            ${isSelectorOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'}
          `}
        >
          <ExerciseSelector 
            zone={selectedZone} 
            onAddExercise={addExercise} 
            onClose={handleCloseSelector} 
          />
        </div>
        
        {/* Machine Video Modal */}
        {viewingMachine && (
           <MachineDetailModal 
             machine={viewingMachine}
             onClose={() => setViewingMachine(null)}
           />
        )}
      </main>
    </div>
  );
};

export default App;
