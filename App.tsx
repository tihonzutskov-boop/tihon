import React, { useState, useEffect } from 'react';
import GymMap from './components/GymMap';
import ExerciseSelector from './components/ExerciseSelector';
import ProgramList from './components/ProgramList';
import LandingPage from './components/LandingPage';
import AdminPage from './components/AdminPage';
import UserDashboard from './components/UserDashboard';
import AuthModal from './components/AuthModal';
import MachineDetailModal from './components/MachineDetailModal';
import EquipmentLibrary from './components/EquipmentLibrary';
import ExerciseLibrary from './components/ExerciseLibrary';
import PlanWizard from './components/PlanWizard';
import { GymZone, WorkoutPlan, Exercise, Gym, GymMachine, User, Language, WorkoutDay } from './types';
import { DEFAULT_GYM } from './constants';
import { api } from './services/api';
import { translations, getGymTranslation } from './translations';
import { ChevronDown, MapPin, Loader2, ClipboardList, ArrowLeft, BookOpen, Globe, Search, X } from 'lucide-react';

type ViewState = 'landing' | 'app' | 'admin' | 'dashboard';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('landing');
  const [lang] = useState<Language>('en');
  const t = translations[lang] || translations.en;

  const [gyms, setGyms] = useState<Gym[]>([DEFAULT_GYM]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [user, setUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [activeGymId, setActiveGymId] = useState<string>('default-gym');
  
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const fetchedGyms = await api.fetchGyms();
        setGyms(fetchedGyms);
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
  }, []);

  const activeGym = gyms.find(g => g.id === activeGymId) || gyms[0];
  const zones = activeGym?.zones || [];
  const dimensions = activeGym?.dimensions;
  const entrance = activeGym?.entrance;
  const floorColor = activeGym?.floorColor;
  const annexes = activeGym?.annexes;

  const [selectedZone, setSelectedZone] = useState<GymZone | null>(null);
  const [focusedZoneId, setFocusedZoneId] = useState<string | null>(null);
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [isPlanOpen, setIsPlanOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [viewingMachine, setViewingMachine] = useState<GymMachine | null>(null);
  
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan>({
    id: 'current-1',
    name: 'Weekly Routine',
    days: [{ id: 'day-1', name: 'Workout 1', exercises: [] }],
    totalDurationMinutes: 0
  });

  const handleZoneClick = (zone: GymZone) => {
    if (focusedZoneId === zone.id) {
        setSelectedZone(zone);
        setIsSelectorOpen(true);
        setIsLibraryOpen(false);
    } else {
        setFocusedZoneId(zone.id);
        setSelectedZone(zone);
        setIsSelectorOpen(false);
        setSelectedMachineId(null);
    }
  };

  const handleMapClick = () => {
    if (focusedZoneId) {
        setFocusedZoneId(null);
        setSelectedZone(null);
        setIsSelectorOpen(false);
        setSelectedMachineId(null);
    }
  };

  const handleMachineClick = (machine: GymMachine) => {
    setViewingMachine(machine);
  };

  const handleLibrarySelect = (machine: GymMachine, zoneId: string) => {
    const targetZone = zones.find(z => z.id === zoneId);
    if (targetZone) {
      setFocusedZoneId(zoneId);
      setSelectedZone(targetZone);
      setViewingMachine(machine);
      setSelectedMachineId(machine.id);
    }
  };

  const handleCloseSelector = () => {
    setIsSelectorOpen(false);
    setSelectedZone(null);
  };

  const addExercise = (exercise: Exercise) => {
    setWorkoutPlan(prev => {
      const newDays = [...prev.days];
      const targetDay = newDays[activeDayIndex] || newDays[0];
      const uniqueEx = {
        ...exercise,
        id: `ex-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
      };
      targetDay.exercises = [...targetDay.exercises, uniqueEx];
      return { ...prev, days: newDays };
    });
  };

  const handleWizardFinish = (days: WorkoutDay[]) => {
    setWorkoutPlan(prev => ({
      ...prev,
      days: days
    }));
    setActiveDayIndex(0);
    setIsWizardOpen(false);
    setIsPlanOpen(true);
    
    const firstDay = days[0];
    if (firstDay && firstDay.exercises.length > 0 && firstDay.exercises[0].equipmentId !== 'manual') {
      setFocusedZoneId(firstDay.exercises[0].equipmentId);
      setSelectedMachineId(firstDay.exercises[0].machineId || null);
    }
  };

  const handleLocateExercise = (ex: Exercise) => {
    if (ex.equipmentId === 'manual') return;
    
    setFocusedZoneId(ex.equipmentId);
    setSelectedMachineId(ex.machineId || null);
    
    // On mobile, close sidebar to show map
    if (window.innerWidth < 768) {
      setIsPlanOpen(false);
    }
  };

  const handleWatchVideo = (ex: Exercise) => {
    if (!ex.videoUrl) return;
    
    // Create a temporary machine object for the viewer
    const tempMachine: GymMachine = {
      id: ex.machineId || 'temp',
      name: ex.name,
      x: 0, y: 0, width: 0, height: 0,
      videoUrl: ex.videoUrl,
      longDescription: ex.notes || ''
    };
    
    setViewingMachine(tempMachine);
  };

  const removeExercise = (id: string) => {
    setWorkoutPlan(prev => {
      const newDays = prev.days.map(day => ({
        ...day,
        exercises: day.exercises.filter(ex => ex.id !== id)
      }));
      return { ...prev, days: newDays };
    });
  };

  const updateExercise = (updatedEx: Exercise) => {
    setWorkoutPlan(prev => {
      const newDays = prev.days.map(day => ({
        ...day,
        exercises: day.exercises.map(ex => ex.id === updatedEx.id ? updatedEx : ex)
      }));
      return { ...prev, days: newDays };
    });
  };

  const clearProgram = () => {
    setWorkoutPlan(prev => ({ 
      ...prev, 
      days: [{ id: `day-${Date.now()}`, name: 'Workout 1', exercises: [] }] 
    }));
    setActiveDayIndex(0);
  };

  const handleGymSelect = (gymId: string) => {
    setActiveGymId(gymId);
    setCurrentView('app');
  };

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

  if (currentView === 'landing') {
    return (
      <>
        <LandingPage 
          gyms={gyms}
          onSelectGym= {handleGymSelect}
          onAdminEnter={() => setCurrentView('admin')}
          onLoginClick={handleLoginClick}
          lang={lang}
        />
        {showAuthModal && (
          <AuthModal 
            initialMode={authMode} 
            onClose={() => setShowAuthModal(false)}
            onSuccess={handleAuthSuccess}
            lang={lang}
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
         lang={lang}
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

  const totalExercises = workoutPlan.days.reduce((acc, d) => acc + d.exercises.length, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col overflow-hidden animate-in fade-in duration-700">
      <header className="h-16 border-b border-slate-800 bg-slate-900 flex items-center px-6 justify-between flex-shrink-0 z-40 shadow-sm relative">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => setCurrentView(user ? 'dashboard' : 'landing')}>
            <div className="w-8 h-8 bg-gradient-to-br from-lime-400 to-lime-600 rounded flex items-center justify-center text-slate-900 font-bold text-xl shadow-lg shadow-lime-900/20 group-hover:scale-105 transition-transform">
              G
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white hidden sm:block">GY<span className="text-lime-500">DE</span></h1>
          </div>
          
          {gyms.length > 1 && (
            <div className="relative group hidden md:block">
              <div className="flex items-center space-x-2 text-sm text-slate-300 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors cursor-pointer border border-slate-700">
                <MapPin className="w-4 h-4 text-lime-400" />
                <span className="font-medium">{getGymTranslation(activeGym.name, lang)}</span>
                <ChevronDown className="w-4 h-4 text-slate-500" />
              </div>
              <select 
                value={activeGymId}
                onChange={(e) => setActiveGymId(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              >
                {gyms.map(g => (
                  <option key={g.id} value={g.id}>{getGymTranslation(g.name, lang)}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2 sm:space-x-4">
           {user && (
             <button 
                onClick={() => setCurrentView('dashboard')}
                className="hidden md:flex items-center text-xs font-bold text-slate-400 hover:text-white mr-2"
             >
                <ArrowLeft className="w-3 h-3 mr-1" />
                {t.dashboard}
             </button>
           )}

           <button 
             onClick={() => {
                setIsLibraryOpen(!isLibraryOpen);
                setIsPlanOpen(false);
             }}
             className={`
               flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all border
               ${isLibraryOpen 
                  ? 'bg-slate-800 text-blue-400 border-blue-500/50 shadow-[0_0_15px_-5px_rgba(59,130,246,0.3)]' 
                  : 'bg-transparent text-slate-400 border-transparent hover:bg-slate-800 hover:text-slate-200'}
             `}
           >
             <BookOpen className="w-5 h-5" />
             <span className="hidden xs:block">{t.library}</span>
           </button>

           <button 
             onClick={() => {
                setIsPlanOpen(!isPlanOpen);
                setIsLibraryOpen(false);
             }}
             className={`
               flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all border
               ${isPlanOpen 
                  ? 'bg-slate-800 text-lime-400 border-lime-500/50 shadow-[0_0_15px_-5px_rgba(132,204,22,0.3)]' 
                  : 'bg-transparent text-slate-400 border-transparent hover:bg-slate-800 hover:text-slate-200'}
             `}
           >
             <div className="relative">
               <ClipboardList className="w-5 h-5" />
               {totalExercises > 0 && (
                 <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3">
                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime-400 opacity-75"></span>
                   <span className="relative inline-flex rounded-full h-3 w-3 bg-lime-500 text-[8px] text-slate-900 items-center justify-center font-bold"></span>
                 </span>
               )}
             </div>
             <span className="hidden xs:block">{t.myPlan}</span>
             {totalExercises > 0 && (
               <span className="bg-slate-700 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">
                 {totalExercises}
               </span>
             )}
           </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        <div 
          className={`
            absolute top-0 bottom-0 left-0 w-80 md:w-96 z-30 transform transition-transform duration-300 ease-in-out shadow-2xl
            ${isPlanOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          <ProgramList 
            workout={workoutPlan} 
            activeDayIndex={activeDayIndex}
            setActiveDayIndex={setActiveDayIndex}
            onRemoveExercise={removeExercise}
            onAddExercise={addExercise}
            onUpdateExercise={updateExercise}
            onClear={clearProgram}
            onStartWizard={() => setIsWizardOpen(true)}
            onLocateExercise={handleLocateExercise}
            onWatchVideo={handleWatchVideo}
            onClose={() => setIsPlanOpen(false)}
            lang={lang}
          />
        </div>

        <div 
          className={`
            absolute top-0 bottom-0 left-0 w-80 md:w-96 z-30 transform transition-transform duration-300 ease-in-out shadow-2xl
            ${isLibraryOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'}
          `}
        >
          <EquipmentLibrary 
            gym={activeGym}
            zones={zones}
            onClose={() => setIsLibraryOpen(false)}
            onSelectMachine={handleLibrarySelect}
            lang={lang}
          />
        </div>

        <div className="flex-1 relative flex items-center justify-center bg-slate-950 overflow-hidden">
          <div 
             className={`absolute inset-0 bg-slate-950/50 backdrop-blur-sm z-20 transition-opacity duration-300 pointer-events-none md:hidden
               ${isPlanOpen || isSelectorOpen || isLibraryOpen ? 'opacity-100' : 'opacity-0'}
             `} 
          />
          <div className="w-full h-full p-4 md:p-6 lg:p-8 max-w-7xl flex items-center justify-center">
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
              focusedZoneId={focusedZoneId}
              selectedMachineId={selectedMachineId}
              hideSearch={isPlanOpen || isLibraryOpen || isSelectorOpen || isWizardOpen || Boolean(viewingMachine)}
              lang={lang}
            />
          </div>
        </div>

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
            lang={lang}
          />
        </div>
        
        {viewingMachine && (
           <MachineDetailModal 
             machine={viewingMachine}
             onClose={() => setViewingMachine(null)}
             lang={lang}
           />
        )}

        {isWizardOpen && (
          <PlanWizard 
            zones={zones}
            onFinish={handleWizardFinish}
            onCancel={() => setIsWizardOpen(false)}
            lang={lang}
          />
        )}
      </main>
    </div>
  );
};

export default App;