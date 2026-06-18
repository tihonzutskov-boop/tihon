import React, { useState, useEffect } from 'react';
import { Gym, LibraryExercise } from '../types';
import { api } from '../services/api';
import { 
  Search, Filter, MapPin, Dumbbell, Play, Edit3, Trash2, Plus, X, Loader2, Video, KeyRound, Tag, Box, Info, Image, Sparkles
} from 'lucide-react';

interface ExerciseLibraryProps {
  gym: Gym;
}

const ExerciseLibrary: React.FC<ExerciseLibraryProps> = ({ gym }) => {
  // Exercises state
  const [libraryExercises, setLibraryExercises] = useState<LibraryExercise[]>([]);
  const [exercisesSearchQuery, setExercisesSearchQuery] = useState('');
  const [selectedMuscleFilter, setSelectedMuscleFilter] = useState('All');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');
  const [selectedZoneFilter, setSelectedZoneFilter] = useState('All');
  const [isLoadingExercises, setIsLoadingExercises] = useState(false);
  
  // Modal states for Exercise Library add/edit
  const [isExerciseModalOpen, setIsExerciseModalOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<LibraryExercise | null>(null);
  
  // Video player modal state
  const [playingVideoUrl, setPlayingVideoUrl] = useState<string | null>(null);

  // Load exercises on mount
  useEffect(() => {
    const loadExercises = async () => {
      setIsLoadingExercises(true);
      try {
        const fetched = await api.fetchExercises();
        setLibraryExercises(fetched);
      } catch (e) {
        console.error("Failed loading exercises:", e);
      } finally {
        setIsLoadingExercises(false);
      }
    };
    loadExercises();
  }, []);

  const handleAddNewExercise = async (newEx: Omit<LibraryExercise, 'id'>) => {
    const exerciseToSave: LibraryExercise = {
      ...newEx,
      id: `ex-${Date.now()}`
    };
    setLibraryExercises(prev => [...prev, exerciseToSave]);
    await api.createExercise(exerciseToSave);
  };
  
  const handleSaveExerciseEdit = async (updatedEx: LibraryExercise) => {
    setLibraryExercises(prev => prev.map(ex => ex.id === updatedEx.id ? updatedEx : ex));
    await api.saveExercise(updatedEx);
  };
  
  const handleDeleteExercise = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this exercise from the library?")) {
       setLibraryExercises(prev => prev.filter(ex => ex.id !== id));
       await api.deleteExercise(id);
    }
  };

  // Convert regular watch urls to embed format
  const getEmbedUrl = (url: string) => {
    if (!url) return '';
    try {
      if (url.includes('youtube.com/watch?v=')) {
        return url.replace('watch?v=', 'embed/');
      }
      if (url.includes('youtu.be/')) {
        const splitted = url.split('/');
        const id = splitted[splitted.length - 1].split('?')[0];
        return `https://www.youtube.com/embed/${id}`;
      }
      return url;
    } catch {
      return url;
    }
  };

  // Filter exercises matching predicates
  const filteredExercises = libraryExercises.filter(ex => {
    const searchLow = exercisesSearchQuery.toLowerCase();
    const matchesSearch = 
      ex.name.toLowerCase().includes(searchLow) ||
      (ex.targetMuscle || '').toLowerCase().includes(searchLow) ||
      (ex.instructions || '').toLowerCase().includes(searchLow) ||
      (ex.category || '').toLowerCase().includes(searchLow) ||
      (ex.equipmentRequired || '').toLowerCase().includes(searchLow);
      
    const matchesMuscle = selectedMuscleFilter === 'All' || ex.targetMuscle === selectedMuscleFilter;
    const matchesCategory = selectedCategoryFilter === 'All' || ex.category === selectedCategoryFilter;
    
    let matchesZone = true;
    if (selectedZoneFilter !== 'All') {
       matchesZone = ex.equipmentId === selectedZoneFilter;
    }
    
    return matchesSearch && matchesMuscle && matchesCategory && matchesZone;
  });

  const musclePresetGroups = [
    'All', 'Quads', 'Glutes', 'Legs/Quads', 'Glutes/Quads', 
    'Back', 'Back/Full Body', 'Chest', 'Shoulders', 'Arms/Biceps', 'Arms/Triceps', 'Cardio', 'Core', 'Full Body'
  ];

  const categoryPresets = [
    'All', 'Compound (Strength)', 'Isolation (Hypertrophy)', 'Cardio / Aerobic', 'Mobility / Stretching', 'Functional / Athlete', 'Warm-up / Cooldown'
  ];

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-slate-950 text-slate-200">
      
      {/* Intro Header info */}
      <div className="mb-6 bg-slate-900/50 border border-slate-800 rounded-2xl p-4 flex items-start gap-4">
        <div className="w-10 h-10 bg-indigo-950 border border-indigo-500/30 text-indigo-400 rounded-xl flex items-center justify-center flex-shrink-0 animate-pulse">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xs font-bold text-slate-100 uppercase tracking-widest leading-none">Global Gym Exercise Library</h2>
          <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
            This database defines standard movement patterns, mapped equipment requirements, form videos, and category classifications. These modular components are utilized dynamically by the AI Engine to construct personalized workout programming (reps, sets, rest schedules) for any user preference.
          </p>
        </div>
      </div>

      {/* Search and Filters Strip */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6 border-b border-slate-900 pb-5">
        <div className="flex-1 max-w-md relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            value={exercisesSearchQuery}
            onChange={(e) => setExercisesSearchQuery(e.target.value)}
            placeholder="Search exercises by name, muscle, equipment, category..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span>Muscle:</span>
            <select
              value={selectedMuscleFilter}
              onChange={(e) => setSelectedMuscleFilter(e.target.value)}
              className="bg-transparent border-none text-white focus:outline-none cursor-pointer text-xs font-semibold"
            >
              {musclePresetGroups.map(m => (
                <option key={m} value={m} className="bg-slate-950 text-white">{m}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl text-xs text-slate-400">
            <Tag className="w-3.5 h-3.5 text-slate-500" />
            <span>Category:</span>
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="bg-transparent border-none text-white focus:outline-none cursor-pointer text-xs font-semibold"
            >
              {categoryPresets.map(c => (
                <option key={c} value={c} className="bg-slate-950 text-white">{c}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl text-xs text-slate-400">
            <MapPin className="w-3.5 h-3.5 text-slate-500" />
            <span>Map Location:</span>
            <select
              value={selectedZoneFilter}
              onChange={(e) => setSelectedZoneFilter(e.target.value)}
              className="bg-transparent border-none text-white focus:outline-none cursor-pointer text-xs font-semibold"
            >
              <option value="All" className="bg-slate-950 text-white">All Locations</option>
              {gym.zones.map(z => (
                <option key={z.id} value={z.id} className="bg-slate-950 text-white">{z.name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              setEditingExercise(null);
              setIsExerciseModalOpen(true);
            }}
            className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-950/50"
          >
            <Plus className="w-4 h-4 mr-1" /> Add Exercise
          </button>
        </div>
      </div>

      {/* Grid Container */}
      {isLoadingExercises ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-3 py-12">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-xs">Loading gym exercises database...</p>
        </div>
      ) : filteredExercises.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 border border-dashed border-slate-800 rounded-2xl text-center bg-slate-900/10 my-6">
          <div className="w-12 h-12 bg-slate-900/80 rounded-2xl flex items-center justify-center mb-4 border border-slate-800 text-slate-500"><Dumbbell className="w-6 h-6 animate-bounce" /></div>
          <h3 className="text-sm font-bold text-slate-200 mb-1">No matching library exercises found</h3>
          <p className="text-xs text-slate-500 max-w-xs leading-relaxed mb-6">Create customized weights drills, warm-ups, or cardio guides without workout programming details like sets or reps.</p>
          <button
            onClick={() => {
              setEditingExercise(null);
              setIsExerciseModalOpen(true);
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all"
          >
            Create Your First Custom Exercise
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredExercises.map(ex => {
            const matchingZone = gym.zones.find(z => z.id === ex.equipmentId);
            return (
              <div key={ex.id} className="bg-slate-900/40 border border-slate-850/80 hover:border-slate-800 rounded-2xl overflow-hidden hover:shadow-xl transition-all flex flex-col group min-h-[280px] hover:bg-slate-900/70">
                <div className="p-5 flex-1 flex flex-col">
                  {/* Top classification badges */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60 text-[9px] font-bold tracking-wide uppercase">
                        {ex.category || 'Strength'}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-indigo-950/80 text-indigo-400 border border-indigo-900/30 text-[9px] font-bold tracking-wide uppercase">
                        {ex.targetMuscle}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button 
                        onClick={() => { setEditingExercise(ex); setIsExerciseModalOpen(true); }}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        title="Edit Exercise"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDeleteExercise(ex.id)}
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-colors"
                        title="Delete Exercise"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Title */}
                  <h3 className="text-sm font-extrabold text-white mb-3 group-hover:text-indigo-400 transition-colors tracking-tight leading-tight uppercase font-mono">
                    {ex.name}
                  </h3>
                  
                  {/* Specifications required */}
                  <div className="space-y-1.5 mb-4 bg-slate-950/40 p-3 rounded-xl border border-slate-900/70">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <Box className="w-3.5 h-3.5 text-slate-500" />
                      <span className="font-semibold text-slate-300">Equipment required:</span>
                    </div>
                    <p className="text-xs font-bold text-slate-200 pl-5">
                      {ex.equipmentRequired || 'None (Bodyweight)'}
                    </p>
                  </div>

                  {/* Form instructions of how to execute */}
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-1">
                      <Info className="w-3.5 h-3.5" />
                      <span>Execution & Form Guidance:</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed font-sans line-clamp-4">
                      {ex.instructions || 'No custom training instructions defined.'}
                    </p>
                  </div>
                  
                  {/* Floor zone link indicator */}
                  <div className="mt-4 pt-3 border-t border-slate-850/40 flex justify-between items-center text-[11px]">
                    <span className="text-slate-500 font-semibold uppercase tracking-wider text-[9px]">Map floor alignment:</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${matchingZone ? 'bg-indigo-950/40 text-indigo-400 hover:underline cursor-pointer' : 'text-slate-600'}`}>
                      {matchingZone ? matchingZone.name : 'Not Mapped'}
                    </span>
                  </div>
                </div>
                
                {/* Visual Guides demonstrating proper form */}
                {ex.videoUrl ? (
                  <button 
                    onClick={() => setPlayingVideoUrl(ex.videoUrl!)}
                    className="w-full py-3 bg-slate-950/80 hover:bg-slate-900 border-t border-slate-850/65 text-indigo-400 hover:text-indigo-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <Play className="w-4 h-4 fill-indigo-400 text-indigo-400" />
                    Watch Guide Video
                  </button>
                ) : (
                  <div className="w-full py-3 bg-slate-950/20 text-slate-600 text-[10px] text-center border-t border-slate-850/20 font-medium select-none">
                    No Form Video Configured
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* EXERCISE ADD/EDIT MODAL */}
      {isExerciseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm" onClick={() => setIsExerciseModalOpen(false)} />
          <div className="relative bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
             <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800 bg-slate-900/50">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  {editingExercise ? 'Modify Library Exercise Info' : 'Register New Library Exercise'}
                </h3>
                <button onClick={() => setIsExerciseModalOpen(false)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-850 rounded-full transition-colors"><X className="w-4 h-4" /></button>
             </div>
             
             <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const exData = {
                  name: formData.get('name') as string,
                  targetMuscle: formData.get('targetMuscle') as string,
                  equipmentRequired: formData.get('equipmentRequired') as string,
                  category: formData.get('category') as string,
                  instructions: formData.get('instructions') as string || '',
                  equipmentId: formData.get('equipmentId') as string || '',
                  videoUrl: formData.get('videoUrl') as string || '',
                  imageUrl: formData.get('imageUrl') as string || ''
                };
                
                if (editingExercise) {
                  handleSaveExerciseEdit({ ...editingExercise, ...exData });
                } else {
                  handleAddNewExercise(exData);
                }
                setIsExerciseModalOpen(false);
             }} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Exercise Name <span className="text-red-500">*</span></label>
                  <input required name="name" type="text" defaultValue={editingExercise?.name || ''} placeholder="e.g., Dumbbell Flat Bench Press" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Target Muscle <span className="text-red-500">*</span></label>
                    <select required name="targetMuscle" defaultValue={editingExercise?.targetMuscle || 'Legs/Quads'} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500/50 transition-colors cursor-pointer">
                      {musclePresetGroups.slice(1).map(m => (
                        <option key={m} value={m} className="bg-slate-950 text-white">{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Exercise Category <span className="text-red-500">*</span></label>
                    <select required name="category" defaultValue={editingExercise?.category || 'Compound (Strength)'} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500/50 transition-colors cursor-pointer">
                      {categoryPresets.slice(1).map(c => (
                        <option key={c} value={c} className="bg-slate-950 text-white">{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Equipment Required <span className="text-red-500">*</span></label>
                  <input required name="equipmentRequired" type="text" defaultValue={editingExercise?.equipmentRequired || ''} placeholder="e.g. Set of Dumbbells & Bench, Olympic Barbell, Lat Pulldown Machine" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors" />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Gym Zone Location Mapping</label>
                  <select name="equipmentId" defaultValue={editingExercise?.equipmentId || ''} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500/50 transition-colors cursor-pointer">
                    <option value="" className="bg-slate-950 text-white">Unassigned (None / Free Space)</option>
                    {gym.zones.map(z => (
                      <option key={z.id} value={z.id} className="bg-slate-950 text-white">{z.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">YouTube Demo Video Link</label>
                  <input name="videoUrl" type="url" defaultValue={editingExercise?.videoUrl || ''} placeholder="e.g. https://www.youtube.com/watch?v=8iPEnn-ltC8" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-700 focus:outline-none focus:border-indigo-500/50 transition-colors" />
                  <p className="text-[9px] text-slate-500 leading-relaxed mt-1">Accepts standard watch links or direct share links, and auto-formats to active embedded layout players.</p>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Optional Form Demonstration Image URL</label>
                  <input name="imageUrl" type="url" defaultValue={editingExercise?.imageUrl || ''} placeholder="e.g. https://example.com/squat_form.jpg" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-700 focus:outline-none focus:border-indigo-500/50 transition-colors" />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Step-By-Step Setup & Form instructions <span className="text-red-500">*</span></label>
                  <textarea required name="instructions" rows={5} defaultValue={editingExercise?.instructions || ''} placeholder="Explain step-by-step setup, starting postura, control phase, breath control mechanisms, and focus cues to prevent injuries..." className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500/50 transition-colors resize-none" />
                </div>
                
                <div className="pt-4 border-t border-slate-800 flex justify-end space-x-3">
                   <button type="button" onClick={() => setIsExerciseModalOpen(false)} className="px-4 py-2 bg-slate-950 hover:bg-slate-850 rounded-xl text-xs font-bold text-slate-400 border border-slate-800 transition-colors">Discard</button>
                   <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white shadow-md shadow-indigo-900/10">
                     {editingExercise ? 'Save Changes' : 'Publish Exercise'}
                   </button>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* FOOTER SCALE-UP VIDEO MODAL */}
      {playingVideoUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={() => setPlayingVideoUrl(null)} />
          <div className="relative bg-black border border-slate-850 rounded-2xl w-full max-w-3xl shadow-2xl aspect-video overflow-hidden animate-in zoom-in-95 duration-250">
             <button 
               onClick={() => setPlayingVideoUrl(null)} 
               className="absolute top-4 right-4 z-50 p-2 bg-black/60 hover:bg-black/80 rounded-full text-white/80 hover:text-white transition-colors"
               title="Close Video"
             >
                <X className="w-4 h-4" />
             </button>
             <iframe
               src={getEmbedUrl(playingVideoUrl)}
               title="Instructional Demonstration Player"
               allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
               allowFullScreen
               className="w-full h-full border-0 absolute inset-0"
             />
          </div>
        </div>
      )}

    </div>
  );
};

export default ExerciseLibrary;
