
import React, { useState, useEffect } from 'react';
import GymMap from './components/GymMap';
import ExerciseSelector from './components/ExerciseSelector';
import ProgramList from './components/ProgramList';
import LandingPage from './components/LandingPage';
import AdminPage from './components/AdminPage';
import { GymZone, WorkoutPlan, Exercise, Gym } from './types';
import { DEFAULT_GYM } from './constants';
import { api } from './services/api';
import { ChevronDown, MapPin, Loader2 } from 'lucide-react';

type ViewState = 'landing' | 'app' | 'admin';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('landing');
  
  // State for multiple Gyms
  const [gyms, setGyms] = useState<Gym[]>([DEFAULT_GYM]);
  const [isLoading, setIsLoading] = useState(true);
  
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
      <LandingPage 
        gyms={gyms}
        onSelectGym={handleGymSelect}
        onAdminEnter={() => setCurrentView('admin')}
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
      <header className="h-16 border-b border-slate-800 bg-slate-900 flex items-center px-6 justify-between flex-shrink-0 z-20">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentView('landing')}>
            <div className="w-8 h-8 bg-lime-500 rounded flex items-center justify-center text-slate-900 font-bold text-xl">
              G
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white hidden sm:block">Gym<span className="text-lime-500">Cartographer</span></h1>
          </div>
          
          {/* Gym Selector (if multiple gyms exist) */}
          {gyms.length > 1 && (
            <div className="relative group">
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

        <div className="flex items-center space-x-4 text-sm text-slate-400">
           <span>Building: <strong className="text-white">{workoutPlan.name}</strong></span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden relative">
        
        {/* Left: Map Area */}
        <div className="flex-1 p-4 md:p-8 relative flex items-center justify-center bg-slate-950">
          <GymMap 
            zones={zones}
            dimensions={dimensions}
            entrance={entrance}
            floorColor={floorColor}
            annexes={annexes}
            onZoneClick={handleZoneClick}
            onMapClick={handleMapClick}
            selectedZoneId={selectedZone?.id || null}
            focusedZoneId={focusedZoneId} // Pass focus state
          />
        </div>

        {/* Center/Overlay: Exercise Selector (Slide over) */}
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

        {/* Right: Program List (Desktop) */}
        <div className="hidden lg:block h-full z-10">
          <ProgramList 
            workout={workoutPlan} 
            onRemoveExercise={removeExercise}
            onClear={clearProgram}
          />
        </div>
      </main>
    </div>
  );
};

export default App;
