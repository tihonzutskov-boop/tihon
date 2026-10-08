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
import GuidedSession from './components/GuidedSession';
import SessionCheckIn from './components/SessionCheckIn';
import SessionLocationPicker from './components/SessionLocationPicker';
import type { LocationCheck } from './components/SessionLocationPicker';
import { clientLocations } from './utils/gymChains';
import { isFirstWeek } from './utils/firstWeek';
import { VideoPreloader } from './components/NativeVideo';
import { upcomingTutorialUrls } from './utils/videoLoad';
import ExerciseTutorials from './components/ExerciseTutorials';
import { GymZone, WorkoutPlan, Exercise, Gym, GymMachine, User, Language, WorkoutDay, EquipmentItem, LibraryExercise, QuestionnaireAnswers } from './types';
import { DEFAULT_GYM } from './constants';
import { api, DEFAULT_EQUIPMENT } from './services/api';
import { rememberTimeZone } from './utils/timezone';
import { getExerciseLocations } from './utils/exerciseMatcher';
import { translations, getGymTranslation } from './translations';
import { ChevronDown, MapPin, Loader2, ClipboardList, BookOpen, Globe, Search, X, Settings } from 'lucide-react';

type ViewState = 'landing' | 'app' | 'admin' | 'dashboard';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('landing');
  const [lang] = useState<Language>('en');
  const t = translations[lang] || translations.en;

  const [gyms, setGyms] = useState<Gym[]>([DEFAULT_GYM]);
  const [equipmentList, setEquipmentList] = useState<EquipmentItem[]>(DEFAULT_EQUIPMENT);
  const [libraryExercises, setLibraryExercises] = useState<LibraryExercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [user, setUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [activeGymId, setActiveGymId] = useState<string>('default-gym');
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireAnswers | null>(null);

  // The gym layouts, equipment and exercise library need a signed-in user, so
  // this runs once a session exists — after restoring one on page load, or after
  // signing in — rather than on every visit, where a visitor would only be
  // refused.
  const loadLibrary = async () => {
    try {
      const fetchedGyms = await api.fetchGyms();
      setGyms(fetchedGyms);
      if (!fetchedGyms.find(g => g.id === activeGymId)) {
        setActiveGymId(fetchedGyms[0]?.id || 'default-gym');
      }
      const fetchedEquipment = await api.fetchEquipment();
      setEquipmentList(fetchedEquipment);
      const fetchedExercises = await api.fetchExercises();
      setLibraryExercises(fetchedExercises);
    } catch (e) {
      console.error("Failed to load gyms", e);
    }
  };

  useEffect(() => {
    rememberTimeZone();

    // Restore an existing session (httpOnly cookie) on page load/refresh.
    const restoreSession = async () => {
      const existingUser = await api.fetchMe();
      if (existingUser) {
        setUser(existingUser);
        setCurrentView(existingUser.role === 'admin' ? 'admin' : 'dashboard');
        await Promise.all([loadLibrary(), loadMyPlan(), loadMyQuestionnaire()]);
      }
    };

    // The loading gate lifts only once the session check has finished —
    // otherwise the landing page would flash for a moment before the check
    // flips currentView to dashboard/admin, showing the marketing page to a
    // user who is actually already logged in.
    setIsLoading(true);
    restoreSession().finally(() => setIsLoading(false));
  }, []);

  const loadMyQuestionnaire = async () => {
    const saved = await api.fetchMyQuestionnaire();
    setQuestionnaire(saved);
  };

  // The adapted plan, not the stored one: the client is here to train, so what
  // they should see is the plan plus whatever their training log justifies
  // changing. The stored plan is the authored intent and stays untouched.
  const loadMyPlan = async () => {
    const { plan, needsReview, weeksTrained } = await api.fetchMyAdaptedPlan();
    if (plan && plan.days.length > 0) {
      setWorkoutPlan(prev => ({ ...prev, name: plan.name, days: plan.days }));
      setPlanNeedsReview(needsReview);
      setPlanWeeksTrained(weeksTrained);
      return;
    }
    // Falls back to the stored plan if adaptation is unavailable — a client
    // with no history yet is the common case, and an unreachable endpoint
    // should not leave them with no plan at all.
    const saved = await api.fetchMyPlan();
    if (saved && saved.days.length > 0) {
      setWorkoutPlan(prev => ({ ...prev, name: saved.name, days: saved.days }));
    }
  };

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
  const [viewingMachine, setViewingMachine] = useState<GymMachine | null>(null);
  // A session is a sequence, not a single screen: the check-in before, the
  // guided workout, then the check-in after. A boolean could only express the
  // middle one, and the pre-session check-in has to be able to end the session
  // before it starts (ILLNESS-4).
  // It opens by asking which location the client is at, since the chain's
  // locations do not all have the same equipment.
  const [sessionPhase, setSessionPhase] = useState<'idle' | 'location' | 'pre' | 'training' | 'post'>('idle');
  // Today's session as it can be done at the chosen location: the plan's day
  // with anything that location lacks swapped. Null until a location is checked,
  // when the plan's own day stands in.
  const [sessionDay, setSessionDay] = useState<WorkoutDay | null>(null);
  const checkedDayRef = React.useRef<{ gymId: string; day: WorkoutDay } | null>(null);
  // When the server recorded the session that was just finished, for the
  // "Session complete" screen. Null until the recording comes back — and if it
  // fails, nothing is shown rather than a time that was never stored.
  const [finishedAt, setFinishedAt] = useState<string | null>(null);
  // Bumped each time a session is recorded, so the dashboard behind the session
  // screens reloads its log instead of showing the week as it was before.
  const [logsVersion, setLogsVersion] = useState(0);
  const [savingCheckIn, setSavingCheckIn] = useState(false);
  // H-1: past week 12 the beginner rules are no longer evidenced, so the engine
  // stops adapting and asks for a decision rather than extrapolating.
  const [planNeedsReview, setPlanNeedsReview] = useState(false);
  // Whole weeks since the plan began; null until the server has said, so the
  // first-week note is never shown on a guess.
  const [planWeeksTrained, setPlanWeeksTrained] = useState<number | null>(null);
  const [tutorialsOpen, setTutorialsOpen] = useState(false);
  // A write that fails has to say so. Silence reads as success, and by the
  // time the client notices, the thing they did is gone.
  const [saveNotice, setSaveNotice] = useState<{ title: string; detail: string } | null>(null);
  
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan>({
    id: 'current-1',
    name: 'Weekly Routine',
    days: [{ id: 'day-1', name: 'Workout 1', exercises: [] }],
    totalDurationMinutes: 0
  });

  const handleZoneClick = (zone: GymZone) => {
    if (focusedZoneId === zone.id) {
        if (!requireLogin()) return;
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
    setSelectedMachineId(machine.id);
  };

  const handleHighlightMachine = (machine: GymMachine) => {
    setSelectedMachineId(machine.id);
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

  const handleLocateExercise = (ex: Exercise) => {
    if (ex.equipmentId === 'manual') return;

    setFocusedZoneId(ex.equipmentId);
    setSelectedMachineId(ex.machineId || null);

    // On mobile, close sidebar to show map
    if (window.innerWidth < 768) {
      setIsPlanOpen(false);
    }
  };

  const handleLocateLibraryExercise = (ex: LibraryExercise) => {
    const location = getExerciseLocations(ex, activeGym);
    const zone = location.primaryZone || location.matchedZones[0];
    setTutorialsOpen(false);
    if (zone) {
      setFocusedZoneId(zone.id);
      setSelectedMachineId(location.primaryMachine?.id || null);
    }
    handleGymSelect(activeGymId);
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

  // The gym map is the floor-plan builder, and it is not ready to be put in
  // front of clients yet — so it is admin-only for now. One flag, checked
  // everywhere that opens it, so re-enabling it is a single edit.
  //
  // Guided sessions are unaffected: the Locate stage renders its own map
  // inside the session rather than routing through this view.
  const canOpenGymMap = user?.role === 'admin';

  const handleGymSelect = (gymId: string) => {
    // Guarded here as well as at each button, so no path can strand a client
    // in a view they have no way back out of. Bails before touching the active
    // gym too — for a client this call should do nothing at all.
    if (!canOpenGymMap) return;
    setActiveGymId(gymId);
    setCurrentView('app');
  };

  // Building/using a personal training plan requires login; browsing the
  // gym map and equipment library does not. Returns false (and prompts the
  // auth modal) so a caller can bail out of opening the plan-builder UI.
  const requireLogin = (): boolean => {
    if (!user) {
      setShowAuthModal(true);
      return false;
    }
    return true;
  };

  // Server messages arrive unpunctuated ("Server responded with 500"), and run
  // straight into the sentence that follows them.
  const asSentence = (msg: string | undefined) => {
    const text = (msg || 'Could not reach the server').trim();
    return /[.!?]$/.test(text) ? text : `${text}.`;
  };

  const persistPlan = async (plan: WorkoutPlan) => {
    const result = await api.savePlan(plan.name, plan.days);
    setSaveNotice(result.ok ? null : {
      title: 'Your plan didn’t save',
      detail: `${asSentence(result.error)} The change is still on screen but is not stored yet — press Save in the plan panel to try again.`,
    });
    return result;
  };

  const recordCompletedWorkout = async (dayName: string, exerciseCount: number, planDayId?: string) => {
    const result = await api.completeWorkout(dayName, exerciseCount, planDayId);
    // Deliberately specific about what was and wasn't lost: the sets are
    // already stored by this point (logExercises writes them, and reports its
    // own failures), so only the dashboard's tally missed this session.
    if (result.ok) {
      setFinishedAt(result.completedAt ?? null);
      setLogsVersion(v => v + 1);
    } else {
      setSaveNotice({
        title: 'This session wasn’t counted',
        detail: `${asSentence(result.error)} Everything you lifted was saved — only the workout count, streak and hours on your dashboard missed it.`,
      });
    }
    return result;
  };

  const handleLoginClick = () => {
    setShowAuthModal(true);
  };

  const handleSignupClick = () => {
    setShowAuthModal(true);
  };
  
  const handleAuthSuccess = async (u: User) => {
    // The library is loaded before the dashboard appears, so it never mounts
    // with no gyms in it and picks a gym that is not there.
    await loadLibrary();
    setUser(u);
    if (u.role === 'admin') {
      setCurrentView('admin');
    } else {
      setCurrentView('dashboard');
    }
    loadMyPlan();
    loadMyQuestionnaire();
  };

  const handleLogout = async () => {
    // Local state is cleared either way — the client asked to sign out and
    // should not be left sitting in the app. But only the server can actually
    // end the session, so a failure here means they look signed out while the
    // cookie is still live, which on a shared machine is worth saying plainly.
    const result = await api.logout();
    setUser(null);
    setCurrentView('landing');
    if (!result.ok) setSaveNotice({
      title: 'Signed out here, but not confirmed',
      detail: `${asSentence(result.error)} Your session may still be open on this device — close the browser if you are not on your own computer.`,
    });
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
          onSelectGym={handleGymSelect}
          canOpenGymMap={canOpenGymMap}
          onLoginClick={handleLoginClick}
          onSignupClick={handleSignupClick}
        />
        {showAuthModal && (
          <AuthModal 
            onClose={() => setShowAuthModal(false)}
            onSuccess={handleAuthSuccess}
          />
        )}
      </>
    );
  }

  if (currentView === 'dashboard' && user) {
     return (
       <>
         <UserDashboard
           user={user}
           gyms={gyms}
           activeGymId={activeGymId}
           workoutPlan={workoutPlan}
           planNeedsReview={planNeedsReview}
           logsVersion={logsVersion}
           onLogout={handleLogout}
           onEnterGym={handleGymSelect}
           canOpenGymMap={canOpenGymMap}
           onStartWorkout={(dayIndex) => {
             setActiveDayIndex(dayIndex);
             setSessionDay(null);
             checkedDayRef.current = null;
             // Where first, since it decides what the session is; then the
             // check-in (ILLNESS-1 asks for recovery status before the workout),
             // then the session.
             setSessionPhase('location');
           }}
           questionnaire={questionnaire}
           onSubmitQuestionnaire={async (answers) => {
             const result = await api.saveQuestionnaire(answers);
             // Only what the server actually stored counts as saved. Marking it
             // saved regardless told a client whose save failed that their
             // plan was on its way, and it never was.
             if (!result.ok) return { ok: false, error: result.error };
             setQuestionnaire(answers);
             if (result.assignedPlan) await loadMyPlan();
             return { ok: true };
           }}
           onOpenTutorials={() => setTutorialsOpen(true)}
           lang={lang}
         />
         {sessionPhase === 'location' && workoutPlan.days[activeDayIndex] && (() => {
           const where = clientLocations(gyms, questionnaire);
           const planDay = workoutPlan.days[activeDayIndex];
           const check = async (gymId: string): Promise<LocationCheck> => {
             const result = await api.fetchMyAdaptedPlan(gymId);
             const day = result.plan?.days.find(d => d.id === planDay.id);
             if (!result.ok || !day) return { ok: false, error: 'Could not reach the server' };
             checkedDayRef.current = { gymId, day };
             return { ok: true, changes: (result.gym?.changes || []).filter(c => c.dayId === planDay.id) };
           };
           return (
             <SessionLocationPicker
               dayName={planDay.name}
               chainName={where.chain}
               locations={where.locations}
               usualId={where.usualId}
               initialId={where.locations.some(g => g.id === activeGymId) ? activeGymId : where.usualId}
               onCancel={() => setSessionPhase('idle')}
               check={check}
               onContinue={(gymId, checked) => {
                 setActiveGymId(gymId);
                 const checkedDay = checkedDayRef.current;
                 setSessionDay(checked && checkedDay?.gymId === gymId ? checkedDay.day : null);
                 setSessionPhase('pre');
               }}
             />
           );
         })()}
         {/* The check-in and the first-week reminder take a while to read: the first
             exercise's tutorial video loads in that time rather than after it. */}
         {sessionPhase === 'pre' && workoutPlan.days[activeDayIndex] && (
           <VideoPreloader urls={upcomingTutorialUrls((sessionDay || workoutPlan.days[activeDayIndex]).exercises, libraryExercises, 0, 1)} />
         )}
         {sessionPhase === 'pre' && workoutPlan.days[activeDayIndex] && (
           <SessionCheckIn
             phase="pre"
             dayName={workoutPlan.days[activeDayIndex].name}
             planDayId={workoutPlan.days[activeDayIndex].id}
             firstWeek={isFirstWeek(planWeeksTrained)}
             saving={savingCheckIn}
             onCancel={() => setSessionPhase('idle')}
             onProceed={async (checkIn, verdict) => {
               setSavingCheckIn(true);
               // Recorded before training rather than after, so a session
               // abandoned midway still leaves the reported state behind —
               // that is exactly the case a coach needs to see.
               await api.saveCheckIn({ ...checkIn, verdict: verdict.verdict });
               setSavingCheckIn(false);
               setSessionPhase('training');
             }}
           />
         )}
         {sessionPhase === 'training' && activeGym && workoutPlan.days[activeDayIndex] && (
           <GuidedSession
             day={sessionDay || workoutPlan.days[activeDayIndex]}
             gym={activeGym}
             equipmentList={equipmentList}
             libraryExercises={libraryExercises}
             onClose={() => setSessionPhase('idle')}
             onFinish={() => {
               const d = sessionDay || workoutPlan.days[activeDayIndex];
               setFinishedAt(null);
               recordCompletedWorkout(d.name, d.exercises.length, d.id);
               setSessionPhase('post');
             }}
           />
         )}
         {sessionPhase === 'post' && workoutPlan.days[activeDayIndex] && (
           <SessionCheckIn
             phase="post"
             dayName={workoutPlan.days[activeDayIndex].name}
             planDayId={workoutPlan.days[activeDayIndex].id}
             completedAt={finishedAt}
             saving={savingCheckIn}
             onCancel={() => setSessionPhase('idle')}
             onSubmitPost={async (checkIn) => {
               setSavingCheckIn(true);
               await api.saveCheckIn(checkIn);
               setSavingCheckIn(false);
               setSessionPhase('idle');
             }}
           />
         )}
         {tutorialsOpen && (
           <ExerciseTutorials
             libraryExercises={libraryExercises}
             gym={activeGym}
             isAdmin={user.role === 'admin'}
             onClose={() => setTutorialsOpen(false)}
             onLocateExercise={handleLocateLibraryExercise}
             canOpenGymMap={canOpenGymMap}
             onExercisesUpdated={setLibraryExercises}
           />
         )}
       </>
     );
  }

  if (currentView === 'admin') {
    return (
      <AdminPage
        gyms={gyms}
        setGyms={setGyms}
        onExit={() => setCurrentView(user ? 'dashboard' : 'landing')}
        onPreviewAsUser={handleGymSelect}
      />
    );
  }

  const totalExercises = workoutPlan.days.reduce((acc, d) => acc + d.exercises.length, 0);

  return (
    <div className="h-screen bg-slate-950 text-slate-200 flex flex-col overflow-hidden animate-in fade-in duration-700">
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
           {user?.role === 'admin' && (
             <button
                onClick={() => setCurrentView('admin')}
                title="Switch to the admin editor"
                className="hidden md:flex items-center gap-1.5 text-xs font-bold text-lime-400 hover:text-lime-300 bg-lime-500/10 hover:bg-lime-500/20 border border-lime-500/30 px-3 py-1.5 rounded-lg mr-2 transition-colors"
             >
                <Settings className="w-3.5 h-3.5" />
                Admin View
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
                if (!isPlanOpen && !requireLogin()) return;
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

           {user && (
             <button
                onClick={() => setCurrentView('dashboard')}
                title="Go to your dashboard"
                className="w-9 h-9 rounded-full overflow-hidden border-2 border-slate-700 hover:border-lime-500 transition-colors flex-shrink-0 ml-1"
             >
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full bg-lime-500/20 text-lime-400 flex items-center justify-center text-xs font-bold">
                    {user.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
             </button>
           )}
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative min-h-0">
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
            onLocateExercise={handleLocateExercise}
            onWatchVideo={handleWatchVideo}
            onClose={() => setIsPlanOpen(false)}
            isLoggedIn={!!user}
            onCompleteWorkout={(dayName, exerciseCount, planDayId) => recordCompletedWorkout(dayName, exerciseCount, planDayId)}
            onSavePlan={() => persistPlan(workoutPlan)}
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
            equipmentList={equipmentList}
            onEquipmentChange={setEquipmentList}
            exercises={libraryExercises}
            onClose={() => setIsLibraryOpen(false)}
            onSelectMachine={handleLibrarySelect}
            lang={lang}
          />
        </div>

        <div className="flex-1 relative flex items-center justify-center bg-slate-950 overflow-hidden min-h-0">
          <div
             className={`absolute inset-0 bg-slate-950/50 backdrop-blur-sm z-20 transition-opacity duration-300 pointer-events-none md:hidden
               ${isPlanOpen || isSelectorOpen || isLibraryOpen ? 'opacity-100' : 'opacity-0'}
             `}
          />
          <div className="w-full h-full p-4 md:p-6 lg:p-8 max-w-7xl flex items-center justify-center min-h-0">
            <GymMap 
              zones={zones}
              dimensions={dimensions}
              entrance={entrance}
              floorColor={floorColor}
              annexes={annexes}
              onZoneClick={handleZoneClick}
              onMapClick={handleMapClick}
              onMachineClick={handleMachineClick}
              onHighlightMachine={handleHighlightMachine}
              selectedZoneId={selectedZone?.id || null}
              focusedZoneId={focusedZoneId}
              selectedMachineId={selectedMachineId}
              hideSearch={isPlanOpen || isLibraryOpen || isSelectorOpen || Boolean(viewingMachine)}
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
            onWatchVideo={(url) => setViewingMachine({ id: 'video-preview', name: 'Exercise Form Guide', x: 0, y: 0, width: 0, height: 0, videoUrl: url })}
            equipmentList={equipmentList}
            exercises={libraryExercises}
            lang={lang}
          />
        </div>
        
        {viewingMachine && (
           <MachineDetailModal
             machine={viewingMachine}
             onClose={() => setViewingMachine(null)}
             equipmentList={equipmentList}
             lang={lang}
           />
        )}

        {showAuthModal && (
          <AuthModal
            onClose={() => setShowAuthModal(false)}
            onSuccess={handleAuthSuccess}
          />
        )}
      </main>

      {/* A failed plan save is otherwise invisible: the edit stays on screen
          and disappears at the next reload. Dismissible, and retryable from
          the plan panel's own Save button. */}
      {saveNotice && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] max-w-md w-[calc(100%-2rem)] bg-red-950/90 border border-red-800/60 rounded-xl px-4 py-3 shadow-lg backdrop-blur-sm flex items-start gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold text-red-300">{saveNotice.title}</p>
            <p className="text-[11px] text-red-200/70 mt-0.5 break-words">{saveNotice.detail}</p>
          </div>
          <button
            type="button"
            onClick={() => setSaveNotice(null)}
            className="ml-auto flex-shrink-0 text-red-300/70 hover:text-red-200 text-xs font-bold px-1"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

export default App;