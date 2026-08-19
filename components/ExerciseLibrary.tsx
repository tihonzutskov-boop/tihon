import React, { useState, useEffect, useMemo } from 'react';
import { Gym, LibraryExercise, Language, EquipmentItem } from '../types';
import { api, DEFAULT_EQUIPMENT } from '../services/api';
import { searchAndFilterExercises, getExerciseLocations } from '../utils/exerciseMatcher';
import { getEquipmentIcon, isBeginnerFriendly } from '../utils/equipmentIcons';
import { getYouTubeEmbedUrl } from '../utils/youtubeEmbed';
import { getEquipmentIconComponent } from './EquipmentLibrary';
import { getExerciseRequiredEquipmentIds, getZoneEquipmentIds } from '../utils/equipmentMatcher';
import { 
  Search, MapPin, Dumbbell, Play, Edit3, Trash2, Plus, X, Loader2, Video, KeyRound, Box, Info, Image, Sparkles, Globe, Layers, Check, Flame, ShieldCheck
} from 'lucide-react';

interface ExerciseLibraryProps {
  gym: Gym;
  equipmentList?: EquipmentItem[];
  lang?: Language;
  onLanguageChange?: (lang: Language) => void;
  onLocateExercise?: (exercise: any) => void;
}

const LIB_UI: Record<Language, any> = {
  en: {
    headerTitle: 'Global Gym Exercise Library',
    headerDesc: 'This database defines standard movement patterns, mapped equipment requirements, form videos, and category classifications. Exercises reference items from the Equipment Library to determine zone availability.',
    searchPlace: 'Search exercises by name, muscle, equipment, category...',
    muscleFilter: 'Muscle:',
    categoryFilter: 'Category:',
    equipmentFilter: 'Equipment:',
    locationFilter: 'Map Location:',
    allLocations: 'All Locations',
    allEquipment: 'All Equipment',
    addExBtn: 'Add Exercise',
    loading: 'Loading gym exercises database...',
    noFoundTitle: 'No matching library exercises found',
    noFoundDesc: 'Create customized weights drills, warm-ups, or cardio guides linked to physical gym equipment.',
    createFirstBtn: 'Create Your First Custom Exercise',
    equipReqLabel: 'Required Equipment:',
    bodyweight: 'None (Bodyweight / Open Floor)',
    execGuidance: 'Execution & Form Guidance:',
    noInstructions: 'No custom training instructions defined.',
    mapAlign: 'Map floor alignment:',
    notMapped: 'Not Mapped',
    watchGuide: 'Watch Guide Video',
    noFormVideo: 'No Form Video Configured',
    modalAddTitle: 'Register New Library Exercise',
    modalEditTitle: 'Modify Library Exercise Info',
    exNameLabel: 'Exercise Name',
    targetMuscleLabel: 'Target Muscle',
    exCatLabel: 'Exercise Category',
    equipReqInputLabel: 'Equipment Required (From Equipment Library)',
    gymZoneLabel: 'Default Primary Zone (Optional)',
    unassignedOpt: 'Auto-detect from equipment in zone',
    ytLinkLabel: 'Exercise Movement Video URL / YouTube Shorts',
    ytLinkHelp: 'Add a video demonstration showing how to perform this movement (YouTube, Shorts, or MP4 link).',
    stepInstructionsLabel: 'Step-By-Step Movement Execution & Form Guidance',
    instructionsPlace: 'Explain body alignment, starting posture, movement path, tempo, breathing cues, and safety tips for performing this movement...',
    howToMakeHarderLabel: 'How to make it harder (Progression)',
    howToMakeEasierLabel: 'How to make it easier (Regression / Variation)',
    makeHarderPlaceholder: 'e.g. Increase weight, slow down tempo (3s eccentric), pause at peak contraction, or elevate feet...',
    makeEasierPlaceholder: 'e.g. Reduce range of motion, use lighter resistance, drop to knees, or use an assistance band...',
    diffHarderTitle: 'How to make it harder',
    diffEasierTitle: 'How to make it easier',
    discardBtn: 'Discard',
    saveBtn: 'Save Changes',
    publishBtn: 'Publish Exercise',
    confirmDeleteMsg: 'Are you sure you want to delete this exercise from the library?',
    langSelectTitle: 'Exercise Library Language:',
    allOpt: 'All'
  },
  et: {
    headerTitle: 'Ülemaailmne Jõusaali Harjutuste Kogu',
    headerDesc: 'See andmebaas määratleb standardsed liikumismustrid, vajaliku varustuse, õppevideod ja kategooriad.',
    searchPlace: 'Otsi harjutusi nime, lihase, varustuse või kategooria järgi...',
    muscleFilter: 'Lihasgrupp:',
    categoryFilter: 'Kategooria:',
    equipmentFilter: 'Varustus:',
    locationFilter: 'Asukoht saalis:',
    allLocations: 'Kõik asukohad',
    allEquipment: 'Kõik seadmed',
    addExBtn: 'Lisa harjutus',
    loading: 'Harjutuste andmebaasi laadimine...',
    noFoundTitle: 'Sobivaid harjutusi ei leitud',
    noFoundDesc: 'Loo kohandatud jõuharjutusi, soojendusi või kardiojuhiseid.',
    createFirstBtn: 'Loo oma esimene kohandatud harjutus',
    equipReqLabel: 'Vajalik varustus:',
    bodyweight: 'Puudub (Keharaskus / Vaba ala)',
    execGuidance: 'Sooritus ja tehnika juhised:',
    noInstructions: 'Täpsed juhised puuduvad.',
    mapAlign: 'Seos tsooniga:',
    notMapped: 'Määramata',
    watchGuide: 'Vaata õppevideot',
    noFormVideo: 'Video puudub',
    modalAddTitle: 'Uue harjutuse registreerimine',
    modalEditTitle: 'Harjutuse info muutmine',
    exNameLabel: 'Harjutuse nimi',
    targetMuscleLabel: 'Sihtlihas',
    exCatLabel: 'Kategooria',
    equipReqInputLabel: 'Vajalik varustus (Varustuse kogust)',
    gymZoneLabel: 'Peamine tsoon (valikuline)',
    unassignedOpt: 'Tuvasta automaatselt tsooni varustuse järgi',
    ytLinkLabel: 'YouTube Shortsi / video viide',
    ytLinkHelp: 'Toetab YouTube Shortsi linke ja tavalisi YouTube videolinke.',
    stepInstructionsLabel: 'Samm-sammulised liikumise ja tehnika juhised',
    instructionsPlace: 'Selgita algasendit, liigutuse faase, hingamist ja olulisi detaile...',
    howToMakeHarderLabel: 'Kuidas muuta raskemaks (Raskem variatsioon)',
    howToMakeEasierLabel: 'Kuidas muuta kergemaks (Kergem variatsioon)',
    makeHarderPlaceholder: 'nt. Suurenda raskust, aeglusta tempot (3 sek allalaskmine), lisa paus tipus...',
    makeEasierPlaceholder: 'nt. Vähenda liikumisulatust, kasuta kergemat raskust või abistavat kummilinti...',
    diffHarderTitle: 'Kuidas muuta raskemaks',
    diffEasierTitle: 'Kuidas muuta kergemaks',
    discardBtn: 'Tühista',
    saveBtn: 'Salvesta muudatused',
    publishBtn: 'Avalda harjutus',
    confirmDeleteMsg: 'Kas oled kindel, et soovite selle harjutuse kogumikust kustutada?',
    langSelectTitle: 'Harjutuste kogu keel:',
    allOpt: 'Kõik'
  },
  ru: {
    headerTitle: 'Глобальная библиотека упражнений',
    headerDesc: 'Эта база данных определяет стандартные движения, необходимый инвентарь, видео и категории.',
    searchPlace: 'Поиск упражнений по названию, мышцам, инвентарю, категории...',
    muscleFilter: 'Мышцы:',
    categoryFilter: 'Категория:',
    equipmentFilter: 'Инвентарь:',
    locationFilter: 'Локация в зале:',
    allLocations: 'Все локации',
    allEquipment: 'Весь инвентарь',
    addExBtn: 'Добавить упражнение',
    loading: 'Загрузка базы упражнений...',
    noFoundTitle: 'Упражнения не найдены',
    noFoundDesc: 'Создавайте собственные силовые упражнения, разминки или кардиопрограммы.',
    createFirstBtn: 'Создать первое упражнение',
    equipReqLabel: 'Необходимый инвентарь:',
    bodyweight: 'Нет (Свой вес / Свободное пространство)',
    execGuidance: 'Техника выполнения:',
    noInstructions: 'Инструкции не указаны.',
    mapAlign: 'Привязка к карте:',
    notMapped: 'Не привязано',
    watchGuide: 'Смотреть видеоурок',
    noFormVideo: 'Видео не добавлено',
    modalAddTitle: 'Новое упражнение',
    modalEditTitle: 'Редактировать упражнение',
    exNameLabel: 'Название упражнения',
    targetMuscleLabel: 'Целевая мышца',
    exCatLabel: 'Категория',
    equipReqInputLabel: 'Необходимый инвентарь (из каталога)',
    gymZoneLabel: 'Основная зона (опционально)',
    unassignedOpt: 'Определять автоматически по инвентарю',
    ytLinkLabel: 'Ссылка на YouTube Shorts / видео',
    ytLinkHelp: 'Поддерживаются ссылки YouTube Shorts и обычные видео YouTube.',
    stepInstructionsLabel: 'Пошаговая техника выполнения и наставления',
    instructionsPlace: 'Опишите исходное положение, фазу контроля, дыхание...',
    howToMakeHarderLabel: 'Как усложнить (Прогрессия)',
    howToMakeEasierLabel: 'Как облегчить (Регрессия / Вариация)',
    makeHarderPlaceholder: 'напр., Увеличить вес, замедлить темп (3 сек опускание), добавить паузу в пиковой точке...',
    makeEasierPlaceholder: 'напр., Уменьшить амплитуду движения, использовать меньший вес или резиновую петлю для помощи...',
    diffHarderTitle: 'Как усложнить',
    diffEasierTitle: 'Как облегчить',
    discardBtn: 'Отмена',
    saveBtn: 'Сохранить изменения',
    publishBtn: 'Опубликовать',
    confirmDeleteMsg: 'Вы уверены, что хотите удалить это упражнение из библиотеки?',
    langSelectTitle: 'Язык библиотеки упражнений:',
    allOpt: 'Все'
  }
};

const MUSCLE_TRANSLATIONS: Record<Language, Record<string, string>> = {
  en: {
    'All': 'All', 'Quads': 'Quads', 'Glutes': 'Glutes', 'Legs/Quads': 'Legs/Quads', 'Glutes/Quads': 'Glutes/Quads',
    'Back': 'Back', 'Back/Full Body': 'Back/Full Body', 'Chest': 'Chest', 'Shoulders': 'Shoulders', 'Arms/Biceps': 'Arms/Biceps', 'Arms/Triceps': 'Arms/Triceps', 'Cardio': 'Cardio', 'Core': 'Core', 'Full Body': 'Full Body'
  },
  et: {
    'All': 'Kõik', 'Quads': 'Nelipealihas', 'Glutes': 'Tuhar', 'Legs/Quads': 'Jalad/Nelipealihas', 'Glutes/Quads': 'Tuhar/Nelipealihas',
    'Back': 'Selg', 'Back/Full Body': 'Selg/Kogu keha', 'Chest': 'Rind', 'Shoulders': 'Õlad', 'Arms/Biceps': 'Käed/Biitseps', 'Arms/Triceps': 'Käed/Triitseps', 'Cardio': 'Kardio', 'Core': 'Tüvelihased', 'Full Body': 'Kogu keha'
  },
  ru: {
    'All': 'Все', 'Quads': 'Квадрицепс', 'Glutes': 'Ягодицы', 'Legs/Quads': 'Ноги/Квадрицепс', 'Glutes/Quads': 'Ягодицы/Квадрицепс',
    'Back': 'Спина', 'Back/Full Body': 'Спина/Все тело', 'Chest': 'Грудь', 'Shoulders': 'Плечи', 'Arms/Biceps': 'Руки/Бицепс', 'Arms/Triceps': 'Руки/Трицепс', 'Cardio': 'Кардио', 'Core': 'Кор', 'Full Body': 'Все тело'
  }
};

const CATEGORY_TRANSLATIONS: Record<Language, Record<string, string>> = {
  en: {
    'All': 'All', 'Compound (Strength)': 'Compound (Strength)', 'Isolation (Hypertrophy)': 'Isolation (Hypertrophy)', 'Cardio / Aerobic': 'Cardio / Aerobic', 'Mobility / Stretching': 'Mobility / Stretching', 'Functional / Athlete': 'Functional / Athlete', 'Warm-up / Cooldown': 'Warm-up / Cooldown'
  },
  et: {
    'All': 'Kõik', 'Compound (Strength)': 'Baasharjutus (Jõud)', 'Isolation (Hypertrophy)': 'Isoleeriv (Hüpertroofia)', 'Cardio / Aerobic': 'Kardio / Aeroobne', 'Mobility / Stretching': 'Liikuvus / Venitus', 'Functional / Athlete': 'Funktsionaalne', 'Warm-up / Cooldown': 'Soojendus / Taastumine'
  },
  ru: {
    'All': 'Все', 'Compound (Strength)': 'Базовое (Сила)', 'Isolation (Hypertrophy)': 'Изолирующее (Гипертрофия)', 'Cardio / Aerobic': 'Кардио / Аэробное', 'Mobility / Stretching': 'Мобильность / Растяжка', 'Functional / Athlete': 'Функциональное', 'Warm-up / Cooldown': 'Разминка / Заминка'
  }
};

// Left-edge / badge color per target muscle group, so exercises are
// recognizable by muscle at a glance across the grid and detail view.
const MUSCLE_COLORS: Record<string, string> = {
  'Chest': '#f87171', 'Back': '#60a5fa', 'Back/Full Body': '#60a5fa', 'Shoulders': '#fbbf24',
  'Legs/Quads': '#34d399', 'Glutes': '#34d399', 'Glutes/Quads': '#34d399',
  'Arms/Biceps': '#c084fc', 'Arms/Triceps': '#c084fc', 'Cardio': '#22d3ee', 'Core': '#fb923c', 'Full Body': '#a3e635'
};
const muscleColor = (m: string) => MUSCLE_COLORS[m] || '#94a3b8';

// Searchable "type to filter, or create a new one" combobox used for the
// Target Muscle and Category fields in the add/edit form — free text isn't
// locked to the preset list, matching the same pattern used for equipment
// categories.
const SearchCombo: React.FC<{ value: string; options: string[]; onChange: (val: string) => void; colored?: boolean }> = ({ value, options, onChange, colored }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const matches = options.filter(o => o.toLowerCase().includes(query.toLowerCase()));
  const exact = options.some(o => o.toLowerCase() === query.trim().toLowerCase());

  return (
    <div className="relative">
      {colored && (
        <span
          className="absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full pointer-events-none"
          style={{ backgroundColor: muscleColor(open ? query || value : value) }}
        />
      )}
      <input
        type="text"
        value={open ? query : value}
        onFocus={() => { setQuery(''); setOpen(true); }}
        onChange={(e) => setQuery(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        placeholder="Type to search or create..."
        autoComplete="off"
        className={`w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500/50 transition-colors min-h-[44px] ${colored ? 'pl-7' : ''}`}
      />
      {open && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg max-h-40 overflow-y-auto shadow-xl">
          {matches.map(o => (
            <button
              key={o}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onChange(o); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2"
            >
              {colored && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: muscleColor(o) }} />}
              {o}
            </button>
          ))}
          {query.trim() && !exact && (
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onChange(query.trim()); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-xs text-indigo-400 font-semibold hover:bg-slate-800 border-t border-slate-800"
            >
              + Create &ldquo;{query.trim()}&rdquo;
            </button>
          )}
          {matches.length === 0 && !query.trim() && (
            <div className="px-3 py-2 text-xs text-slate-500">No matches</div>
          )}
        </div>
      )}
    </div>
  );
};

const ExerciseLibrary: React.FC<ExerciseLibraryProps> = ({
  gym, 
  equipmentList = DEFAULT_EQUIPMENT, 
  lang = 'en', 
  onLanguageChange, 
  onLocateExercise 
}) => {
  const [libLang, setLibLang] = useState<Language>('en');
  const [libraryExercises, setLibraryExercises] = useState<LibraryExercise[]>([]);
  const [exercisesSearchQuery, setExercisesSearchQuery] = useState('');
  const [selectedMuscleFilter, setSelectedMuscleFilter] = useState('All');
  const [selectedZoneFilter, setSelectedZoneFilter] = useState('All');
  const [selectedEquipmentFilter, setSelectedEquipmentFilter] = useState('All');
  const [selectedMappedFilter, setSelectedMappedFilter] = useState<'All' | 'mapped' | 'unmapped'>('All');
  const [groupMode, setGroupMode] = useState<'muscle' | 'category' | 'name'>('muscle');
  const [isLoadingExercises, setIsLoadingExercises] = useState(false);

  const [previewExercise, setPreviewExercise] = useState<LibraryExercise | null>(null);
  const [isExerciseModalOpen, setIsExerciseModalOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<LibraryExercise | null>(null);
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>([]);
  const [formMuscle, setFormMuscle] = useState('Legs/Quads');
  const [formCategory, setFormCategory] = useState('Compound (Strength)');
  const [formGifUrl, setFormGifUrl] = useState('');
  const [formError, setFormError] = useState('');
  const gifFileInputRef = React.useRef<HTMLInputElement>(null);

  const [playingVideoUrl, setPlayingVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (lang && lang !== libLang) {
      setLibLang(lang);
    }
  }, [lang]);

  const t = LIB_UI[libLang] || LIB_UI.en;

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

  // When opening edit modal, initialize selected equipment IDs
  const handleOpenEditModal = (ex: LibraryExercise) => {
    setEditingExercise(ex);
    const existingIds = getExerciseRequiredEquipmentIds(ex, equipmentList);
    setSelectedEquipmentIds(existingIds);
    setFormMuscle(ex.targetMuscle);
    setFormCategory(ex.category);
    setFormGifUrl(ex.imageUrl || '');
    setFormError('');
    setIsExerciseModalOpen(true);
  };

  const handleOpenCreateModal = () => {
    setEditingExercise(null);
    setSelectedEquipmentIds([]);
    setFormMuscle('Legs/Quads');
    setFormCategory('Compound (Strength)');
    setFormGifUrl('');
    setFormError('');
    setIsExerciseModalOpen(true);
  };

  const toggleEquipmentSelection = (eqId: string) => {
    setSelectedEquipmentIds(prev =>
      prev.includes(eqId) ? prev.filter(id => id !== eqId) : [...prev, eqId]
    );
  };

  const handleGifFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFormGifUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddNewExercise = async (newEx: Omit<LibraryExercise, 'id'>) => {
    const exerciseToSave: LibraryExercise = {
      ...newEx,
      id: `ex-${Date.now()}`,
      requiredEquipmentIds: selectedEquipmentIds
    };
    setLibraryExercises(prev => [...prev, exerciseToSave]);
    await api.createExercise(exerciseToSave);
  };
  
  const handleSaveExerciseEdit = async (updatedEx: LibraryExercise) => {
    const fullUpdated: LibraryExercise = {
      ...updatedEx,
      requiredEquipmentIds: selectedEquipmentIds
    };
    setLibraryExercises(prev => prev.map(ex => ex.id === fullUpdated.id ? fullUpdated : ex));
    await api.saveExercise(fullUpdated);
  };
  
  const handleDeleteExercise = async (id: string) => {
    if (window.confirm(t.confirmDeleteMsg)) {
       setLibraryExercises(prev => prev.filter(ex => ex.id !== id));
       await api.deleteExercise(id);
    }
  };

  const getEmbedUrl = (url: string) => {
    return getYouTubeEmbedUrl(url);
  };

  // Map of equipment by ID for fast lookup
  const equipmentMap = useMemo(() => {
    return new Map(equipmentList.map(eq => [eq.id, eq]));
  }, [equipmentList]);

  // Filter exercises including equipment + mapping-status filters. Category
  // is no longer a separate filter — the browse view groups by it instead.
  const filteredExercises = useMemo(() => {
    const translatedLibraryList = libraryExercises.map(ex => ({
      raw: ex,
      translated: ex
    }));

    const baseFiltered = searchAndFilterExercises({
      exercises: translatedLibraryList,
      searchQuery: exercisesSearchQuery,
      muscleFilter: selectedMuscleFilter,
      categoryFilter: 'All',
      selectedZoneId: selectedZoneFilter,
      gym
    });

    return baseFiltered.filter(({ raw }) => {
      if (selectedEquipmentFilter !== 'All') {
        const reqIds = getExerciseRequiredEquipmentIds(raw, equipmentList);
        if (!reqIds.includes(selectedEquipmentFilter)) return false;
      }
      if (selectedMappedFilter !== 'All') {
        const isMapped = getExerciseLocations(raw, gym).isMapped;
        if (selectedMappedFilter === 'mapped' && !isMapped) return false;
        if (selectedMappedFilter === 'unmapped' && isMapped) return false;
      }
      return true;
    });
  }, [libraryExercises, exercisesSearchQuery, selectedMuscleFilter, selectedZoneFilter, selectedEquipmentFilter, selectedMappedFilter, gym, equipmentList]);

  const musclePresetGroups = [
    'All', 'Quads', 'Glutes', 'Legs/Quads', 'Glutes/Quads',
    'Back', 'Back/Full Body', 'Chest', 'Shoulders', 'Arms/Biceps', 'Arms/Triceps', 'Cardio', 'Core', 'Full Body'
  ];

  const categoryPresets = [
    'All', 'Compound (Strength)', 'Isolation (Hypertrophy)', 'Cardio / Aerobic', 'Mobility / Stretching', 'Functional / Athlete', 'Warm-up / Cooldown'
  ];

  // Exercises grouped for the browse view (or a flat name-sorted list)
  const groupedExercises = useMemo(() => {
    if (groupMode === 'name') {
      const sorted = [...filteredExercises].sort((a, b) => a.raw.name.localeCompare(b.raw.name));
      return [{ label: null as string | null, items: sorted }];
    }
    const key = groupMode === 'category' ? 'category' : 'targetMuscle';
    const groups = new Map<string, typeof filteredExercises>();
    filteredExercises.forEach(entry => {
      const k = (entry.raw as any)[key] || 'Other';
      groups.set(k, [...(groups.get(k) || []), entry]);
    });
    return Array.from(groups.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, items]) => ({ label, items }));
  }, [filteredExercises, groupMode]);

  // All muscle/category values used across saved exercises, plus the base
  // presets, so custom values created earlier still show as suggestions.
  const allMuscles = useMemo(() => {
    const fromData = libraryExercises.map(e => e.targetMuscle).filter(Boolean);
    return Array.from(new Set([...musclePresetGroups.slice(1), ...fromData])).sort();
  }, [libraryExercises]);

  const allCategories = useMemo(() => {
    const fromData = libraryExercises.map(e => e.category).filter(Boolean);
    return Array.from(new Set([...categoryPresets.slice(1), ...fromData])).sort();
  }, [libraryExercises]);

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-slate-950 text-slate-200">
      
      {/* Intro Header info */}
      <div className="mb-6 bg-slate-900/50 border border-slate-800 rounded-2xl p-4 flex items-start gap-4">
        <div className="w-10 h-10 bg-indigo-950 border border-indigo-500/30 text-indigo-400 rounded-xl flex items-center justify-center flex-shrink-0 animate-pulse">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xs font-bold text-slate-100 uppercase tracking-widest leading-none">{t.headerTitle}</h2>
          <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
            {t.headerDesc}
          </p>
        </div>
      </div>

      {/* Search + Group-by */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
        <div className="flex-1 max-w-md relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={exercisesSearchQuery}
            onChange={(e) => setExercisesSearchQuery(e.target.value)}
            placeholder={t.searchPlace}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors"
          />
        </div>
        <select
          value={groupMode}
          onChange={(e) => setGroupMode(e.target.value as 'muscle' | 'category' | 'name')}
          className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none cursor-pointer flex-shrink-0"
        >
          <option value="muscle" className="bg-slate-950 text-white">Group: muscle</option>
          <option value="category" className="bg-slate-950 text-white">Group: category</option>
          <option value="name" className="bg-slate-950 text-white">Sort: name A-Z</option>
        </select>
        <button
          onClick={handleOpenCreateModal}
          className="flex items-center justify-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-950/50 flex-shrink-0"
        >
          <Plus className="w-4 h-4 mr-1" /> {t.addExBtn}
        </button>
      </div>

      {/* Muscle pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-3 scrollbar-hide">
        {['All', ...allMuscles].map(m => {
          const count = m === 'All' ? libraryExercises.length : libraryExercises.filter(e => e.targetMuscle === m).length;
          const active = selectedMuscleFilter === m;
          const color = muscleColor(m);
          return (
            <button
              key={m}
              onClick={() => setSelectedMuscleFilter(m)}
              style={active && m !== 'All' ? { backgroundColor: color, borderColor: color } : undefined}
              className={`whitespace-nowrap px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1.5 border ${
                active
                  ? m === 'All' ? 'bg-indigo-600 text-white border-indigo-600' : 'text-slate-950'
                  : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              <span>{m === 'All' ? t.allOpt : (MUSCLE_TRANSLATIONS[libLang][m] || m)}</span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded-full ${active ? 'bg-black/20' : 'bg-slate-800 text-slate-500'}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Secondary compact filters */}
      <div className="flex flex-wrap items-center gap-2 mb-6 pb-5 border-b border-slate-900">
        <select
          value={selectedEquipmentFilter}
          onChange={(e) => setSelectedEquipmentFilter(e.target.value)}
          className="bg-slate-900/60 border border-slate-800/70 rounded-lg px-2.5 py-1.5 text-[10.5px] text-slate-400 focus:outline-none cursor-pointer max-w-[160px] truncate"
        >
          <option value="All" className="bg-slate-950 text-white">{t.allEquipment}</option>
          {equipmentList.map((eq) => (
            <option key={eq.id} value={eq.id} className="bg-slate-950 text-white">{eq.name}</option>
          ))}
        </select>
        <select
          value={selectedZoneFilter}
          onChange={(e) => setSelectedZoneFilter(e.target.value)}
          className="bg-slate-900/60 border border-slate-800/70 rounded-lg px-2.5 py-1.5 text-[10.5px] text-slate-400 focus:outline-none cursor-pointer"
        >
          <option value="All" className="bg-slate-950 text-white">{t.allLocations}</option>
          {gym?.zones?.map((z, idx) => (
            <option key={`z-${z.id}-${idx}`} value={z.id} className="bg-slate-950 text-white">{z.name}</option>
          ))}
        </select>
        <select
          value={selectedMappedFilter}
          onChange={(e) => setSelectedMappedFilter(e.target.value as 'All' | 'mapped' | 'unmapped')}
          className="bg-slate-900/60 border border-slate-800/70 rounded-lg px-2.5 py-1.5 text-[10.5px] text-slate-400 focus:outline-none cursor-pointer"
        >
          <option value="All" className="bg-slate-950 text-white">All mapping states</option>
          <option value="mapped" className="bg-slate-950 text-white">Mapped only</option>
          <option value="unmapped" className="bg-slate-950 text-white">Needs review</option>
        </select>
      </div>

      {/* Grid Container */}
      {isLoadingExercises ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-3 py-12">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-xs">{t.loading}</p>
        </div>
      ) : filteredExercises.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 border border-dashed border-slate-800 rounded-2xl text-center bg-slate-900/10 my-6">
          <div className="w-12 h-12 bg-slate-900/80 rounded-2xl flex items-center justify-center mb-4 border border-slate-800 text-slate-500"><Dumbbell className="w-6 h-6 animate-bounce" /></div>
          <h3 className="text-sm font-bold text-slate-200 mb-1">{t.noFoundTitle}</h3>
          <p className="text-xs text-slate-500 max-w-xs leading-relaxed mb-6">{t.noFoundDesc}</p>
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all"
          >
            {t.createFirstBtn}
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedExercises.map((group, groupIdx) => (
            <div key={group.label || `flat-${groupIdx}`}>
              {group.label && (
                <div className="flex items-center gap-2.5 mb-3">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {groupMode === 'muscle' ? (MUSCLE_TRANSLATIONS[libLang][group.label] || group.label) : (CATEGORY_TRANSLATIONS[libLang][group.label] || group.label)}
                  </h2>
                  <span className="text-[10px] text-slate-600 font-mono">{group.items.length}</span>
                  <div className="flex-1 h-px bg-slate-800/80" />
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {group.items.map(({ raw, translated: ex }, exIndex) => {
                  const isMapped = getExerciseLocations(raw, gym).isMapped;
                  const requiredIds = getExerciseRequiredEquipmentIds(raw, equipmentList);
                  const requiredItems = requiredIds.map(id => equipmentMap.get(id)).filter(Boolean) as EquipmentItem[];
                  const color = muscleColor(ex.targetMuscle);

                  return (
                    <div
                      key={`ex-card-${ex.id}-${raw.id || ''}-${exIndex}`}
                      onClick={() => setPreviewExercise(raw)}
                      style={{ borderLeftColor: color, borderLeftWidth: 3 }}
                      className="bg-slate-900/50 border border-slate-850/80 hover:border-slate-800 rounded-2xl p-4 hover:shadow-xl transition-all cursor-pointer group animate-in fade-in duration-300"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex flex-wrap gap-1.5">
                          <span
                            className="px-2 py-0.5 rounded-full text-[8.5px] font-bold tracking-wide uppercase border"
                            style={{ backgroundColor: `${color}22`, color, borderColor: `${color}55` }}
                          >
                            {MUSCLE_TRANSLATIONS[libLang][ex.targetMuscle] || ex.targetMuscle}
                          </span>
                          {isBeginnerFriendly(raw) && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-950/90 text-emerald-400 border border-emerald-500/40 text-[8.5px] font-bold tracking-wide uppercase">
                              🌱
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleOpenEditModal(raw); }}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                            title="Edit Exercise"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteExercise(raw.id); }}
                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-colors"
                            title="Delete Exercise"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <h3 className="text-xs font-extrabold text-white mb-2 tracking-tight leading-tight">
                        {ex.name}
                      </h3>

                      <div className="flex items-center gap-1.5 flex-wrap mb-2">
                        {requiredItems.length > 0 ? (
                          <>
                            {requiredItems.slice(0, 2).map(req => {
                              const IconComp = getEquipmentIconComponent(req.icon);
                              return (
                                <span key={req.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/60 text-[9.5px] text-slate-300">
                                  <IconComp className="w-2.5 h-2.5 text-lime-400" />
                                  {req.name}
                                </span>
                              );
                            })}
                            {requiredItems.length > 2 && (
                              <span className="text-[9.5px] px-1.5 py-0.5 rounded-md bg-slate-800/50 text-slate-500">+{requiredItems.length - 2}</span>
                            )}
                          </>
                        ) : (
                          <span className="text-[9.5px] px-1.5 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/60 text-slate-300">{t.bodyweight}</span>
                        )}
                      </div>

                      <p className="text-[10.5px] text-slate-500 leading-relaxed line-clamp-2 mb-3">
                        {ex.instructions || t.noInstructions}
                      </p>

                      <div className="flex items-center justify-between pt-2.5 border-t border-slate-850/60">
                        <span className={`text-[9.5px] font-bold flex items-center gap-1 ${isMapped ? 'text-slate-500' : 'text-amber-400'}`}>
                          {isMapped ? <><MapPin className="w-2.5 h-2.5" /> {t.mapAlign}</> : '⚠️ Needs review'}
                        </span>
                        {ex.videoUrl && (
                          <span className="w-5 h-5 rounded-full bg-indigo-950/60 text-indigo-400 flex items-center justify-center">
                            <Play className="w-2.5 h-2.5 fill-current" />
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* EXERCISE DETAIL / PREVIEW MODAL */}
      {previewExercise && (() => {
        const ex = previewExercise;
        const color = muscleColor(ex.targetMuscle);
        const requiredIds = getExerciseRequiredEquipmentIds(ex, equipmentList);
        const requiredItems = requiredIds.map(id => equipmentMap.get(id)).filter(Boolean) as EquipmentItem[];
        const locationResult = getExerciseLocations(ex, gym);
        const { matchedZones, isMapped } = locationResult;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm" onClick={() => setPreviewExercise(null)} />
            <div className="relative bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh] my-auto animate-in zoom-in-95 duration-200" style={{ borderTop: `3px solid ${color}` }}>
              <div className="flex justify-between items-start px-6 py-4 border-b border-slate-800 bg-slate-900/90 flex-shrink-0">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wide uppercase border" style={{ backgroundColor: `${color}22`, color, borderColor: `${color}55` }}>
                      {MUSCLE_TRANSLATIONS[libLang][ex.targetMuscle] || ex.targetMuscle}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60 text-[9px] font-bold tracking-wide uppercase">
                      {CATEGORY_TRANSLATIONS[libLang][ex.category] || ex.category}
                    </span>
                    {isBeginnerFriendly(ex) && (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/90 text-emerald-400 border border-emerald-500/40 text-[9px] font-bold tracking-wide uppercase flex items-center gap-1">
                        🌱 Beginner Friendly
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-black text-white">{ex.name}</h3>
                </div>
                <button
                  onClick={() => setPreviewExercise(null)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5 overflow-y-auto flex-1">
                {ex.imageUrl && (
                  <div>
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      <Image className="w-3.5 h-3.5" />
                      <span>Exercise GIF</span>
                    </div>
                    <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                      <img src={ex.imageUrl} alt={`${ex.name} demonstration`} referrerPolicy="no-referrer" className="w-full max-h-72 object-cover" />
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    <Layers className="w-3.5 h-3.5 text-lime-400" />
                    <span>{t.equipReqLabel}</span>
                  </div>
                  {requiredItems.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {requiredItems.map(req => {
                        const IconComp = getEquipmentIconComponent(req.icon);
                        return (
                          <span key={req.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 border border-slate-700/80 text-[11px] font-semibold text-lime-300">
                            <IconComp className="w-3 h-3 text-lime-400" />
                            {req.name}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs font-bold text-slate-300">{ex.equipmentRequired || t.bodyweight}</p>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    <Info className="w-3.5 h-3.5" />
                    <span>{t.execGuidance}</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">{ex.instructions || t.noInstructions}</p>
                </div>

                {(ex.makeHarder || ex.makeEasier) && (
                  <div className="space-y-2">
                    {ex.makeHarder && (
                      <div className="p-3 rounded-xl border border-amber-500/20 bg-slate-950/50">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1">
                          <Flame className="w-3 h-3" />
                          <span>{t.diffHarderTitle}</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">{ex.makeHarder}</p>
                      </div>
                    )}
                    {ex.makeEasier && (
                      <div className="p-3 rounded-xl border border-emerald-500/20 bg-slate-950/50">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">
                          <ShieldCheck className="w-3 h-3" />
                          <span>{t.diffEasierTitle}</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">{ex.makeEasier}</p>
                      </div>
                    )}
                  </div>
                )}

                {ex.videoUrl && (
                  <button
                    onClick={() => setPlayingVideoUrl(ex.videoUrl!)}
                    className="w-full py-3 bg-slate-950/80 hover:bg-slate-900 border border-slate-800 rounded-xl text-indigo-400 hover:text-indigo-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <Play className="w-4 h-4 fill-indigo-400 text-indigo-400" />
                    {t.watchGuide}
                  </button>
                )}

                <div className={`px-3 py-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${isMapped ? 'bg-slate-950/50 border-slate-800 text-slate-300' : 'bg-amber-950/30 border-amber-800/30 text-amber-400'}`}>
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  {isMapped ? <span>Mapped to <b className="text-white">{matchedZones.map(z => z.name).join(', ')}</b></span> : <span>Not mapped to a zone yet — needs manual review</span>}
                </div>
              </div>

              <div className="px-6 py-3 border-t border-slate-800 bg-slate-900 flex-shrink-0">
                <button
                  onClick={() => { setPreviewExercise(null); handleOpenEditModal(ex); }}
                  className="w-full px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors flex items-center justify-center gap-1.5 min-h-[44px]"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit Exercise
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* EXERCISE ADD/EDIT MODAL */}
      {isExerciseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm" onClick={() => setIsExerciseModalOpen(false)} />
          <div className="relative bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh] my-auto animate-in zoom-in-95 duration-200">
             <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800 bg-slate-900/90 flex-shrink-0">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Dumbbell className="w-4 h-4 text-indigo-400" />
                  <span>{editingExercise ? t.modalEditTitle : t.modalAddTitle}</span>
                </h3>
                <button 
                  onClick={() => setIsExerciseModalOpen(false)} 
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
             </div>
             
             <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);

                if (selectedEquipmentIds.length === 0) {
                  setFormError('Select at least one equipment item (use "Open Floor / Mat Area" for bodyweight moves).');
                  return;
                }
                if (!formGifUrl) {
                  setFormError('Upload an exercise GIF.');
                  return;
                }
                setFormError('');

                // Construct human readable equipment label
                const selectedEqItems = selectedEquipmentIds.map(id => equipmentMap.get(id)?.name).filter(Boolean);
                const reqString = selectedEqItems.join(', ') || 'None (Bodyweight)';

                const zoneRaw = formData.get('equipmentId') as string;

                const exData = {
                  name: formData.get('name') as string,
                  targetMuscle: formMuscle,
                  equipmentRequired: reqString,
                  requiredEquipmentIds: selectedEquipmentIds,
                  category: formCategory,
                  instructions: formData.get('instructions') as string || '',
                  equipmentId: zoneRaw === 'auto' ? '' : zoneRaw,
                  videoUrl: formData.get('videoUrl') as string || '',
                  imageUrl: formGifUrl,
                  makeHarder: ((formData.get('makeHarder') as string) || '').trim(),
                  makeEasier: ((formData.get('makeEasier') as string) || '').trim()
                };

                if (editingExercise) {
                  handleSaveExerciseEdit({ ...editingExercise, ...exData });
                } else {
                  handleAddNewExercise(exData);
                }
                setIsExerciseModalOpen(false);
             }} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="p-6 space-y-4 overflow-y-auto flex-1">
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">{t.exNameLabel} <span className="text-red-500">*</span></label>
                    <input required name="name" type="text" defaultValue={editingExercise?.name || ''} placeholder="e.g., Incline Dumbbell Bench Press" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors min-h-[44px]" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">{t.targetMuscleLabel} <span className="text-red-500">*</span></label>
                      <SearchCombo value={formMuscle} options={allMuscles} onChange={setFormMuscle} colored />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">{t.exCatLabel} <span className="text-red-500">*</span></label>
                      <SearchCombo value={formCategory} options={allCategories} onChange={setFormCategory} />
                    </div>
                  </div>

                  {/* Interactive Equipment Multi-Selector from Equipment Library */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        {t.equipReqInputLabel} <span className="text-red-500">*</span> <span className="text-lime-400">({selectedEquipmentIds.length} selected)</span>
                      </label>
                      <span className="text-[10px] text-slate-500">Tap to select equipment required for this exercise</span>
                    </div>

                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl max-h-48 overflow-y-auto space-y-1.5">
                      {equipmentList.map(eq => {
                        const isSelected = selectedEquipmentIds.includes(eq.id);
                        const IconComp = getEquipmentIconComponent(eq.icon);

                        return (
                          <div
                            key={eq.id}
                            onClick={() => toggleEquipmentSelection(eq.id)}
                            className={`p-2 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-lime-500/10 border-lime-500/50 text-white font-semibold'
                                : 'bg-slate-900/50 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <IconComp className={`w-3.5 h-3.5 ${isSelected ? 'text-lime-400' : 'text-slate-500'}`} />
                              <span>{eq.name}</span>
                              <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-500">{eq.category}</span>
                            </div>
                            <div className={`w-4 h-4 rounded flex items-center justify-center border ${
                              isSelected ? 'bg-lime-500 text-slate-950 border-lime-500' : 'border-slate-700'
                            }`}>
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">{t.gymZoneLabel} <span className="text-red-500">*</span></label>
                    <select required name="equipmentId" defaultValue={editingExercise?.equipmentId || 'auto'} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500/50 transition-colors cursor-pointer min-h-[44px]">
                      <option value="auto" className="bg-slate-950 text-white">{t.unassignedOpt}</option>
                      {gym?.zones?.map(z => (
                        <option key={z.id} value={z.id} className="bg-slate-950 text-white">{z.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Exercise GIF upload */}
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Exercise GIF <span className="text-red-500">*</span></label>
                    {formGifUrl ? (
                      <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950 aspect-video max-h-44 group">
                        <img src={formGifUrl} alt="Exercise GIF preview" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button type="button" onClick={() => gifFileInputRef.current?.click()} className="px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700 flex items-center gap-1">
                            <Image className="w-3 h-3" /> Change
                          </button>
                          <button type="button" onClick={() => setFormGifUrl('')} className="px-3 py-1.5 rounded-lg bg-red-600/80 text-white text-xs font-semibold hover:bg-red-600 flex items-center gap-1">
                            <X className="w-3 h-3" /> Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => gifFileInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-700 hover:border-indigo-500/60 rounded-xl p-4 text-center cursor-pointer bg-slate-950/40 hover:bg-slate-950/80 transition-all group"
                      >
                        <div className="w-10 h-10 rounded-full bg-slate-800 group-hover:bg-indigo-500/20 text-slate-400 group-hover:text-indigo-400 mx-auto flex items-center justify-center mb-2 transition-colors">
                          <Image className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-semibold text-slate-300 group-hover:text-white">Click to upload a GIF</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">A short looping clip showing proper form</p>
                      </div>
                    )}
                    <input type="file" ref={gifFileInputRef} onChange={handleGifFileUpload} accept="image/gif" className="hidden" />
                  </div>

                  {/* Video URL for movement demonstration */}
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">{t.ytLinkLabel} <span className="text-red-500">*</span></label>
                    <input required name="videoUrl" type="url" defaultValue={editingExercise?.videoUrl || ''} placeholder="e.g. https://www.youtube.com/watch?v=ultWZbUMPL8" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-700 focus:outline-none focus:border-indigo-500/50 transition-colors min-h-[44px]" />
                    <p className="text-[9px] text-slate-500 leading-relaxed mt-1">{t.ytLinkHelp}</p>
                  </div>

                  {/* Step-by-Step Movement Instructions */}
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">{t.stepInstructionsLabel} <span className="text-red-500">*</span></label>
                    <textarea required name="instructions" rows={3} defaultValue={editingExercise?.instructions || ''} placeholder={t.instructionsPlace} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500/50 transition-colors resize-none" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Difficulty Modifiers: How to make it harder */}
                    <div className="p-3 rounded-xl border border-amber-500/20 bg-slate-950/30">
                      <label className="block text-[10px] text-amber-400 font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-amber-400" />
                        <span>{t.howToMakeHarderLabel}</span>
                        <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        required
                        name="makeHarder"
                        rows={2}
                        defaultValue={editingExercise?.makeHarder || ''}
                        placeholder={t.makeHarderPlaceholder}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-700 focus:outline-none focus:border-amber-500/50 transition-colors resize-none"
                      />
                    </div>

                    {/* Difficulty Modifiers: How to make it easier */}
                    <div className="p-3 rounded-xl border border-emerald-500/20 bg-slate-950/30">
                      <label className="block text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{t.howToMakeEasierLabel}</span>
                        <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        required
                        name="makeEasier"
                        rows={2}
                        defaultValue={editingExercise?.makeEasier || ''}
                        placeholder={t.makeEasierPlaceholder}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-700 focus:outline-none focus:border-emerald-500/50 transition-colors resize-none"
                      />
                    </div>
                  </div>

                  {formError && (
                    <div className="p-3 rounded-xl bg-red-950/30 border border-red-800/40 text-xs text-red-400">
                      {formError}
                    </div>
                  )}
                </div>

                <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end space-x-3 flex-shrink-0">
                   <button type="button" onClick={() => setIsExerciseModalOpen(false)} className="px-5 py-2.5 bg-slate-950 hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-400 border border-slate-800 transition-colors min-h-[44px]">{t.discardBtn}</button>
                   <button type="submit" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white shadow-md shadow-indigo-900/10 min-h-[44px]">
                     {editingExercise ? t.saveBtn : t.publishBtn}
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
          <div className="relative bg-black border border-slate-850 rounded-2xl w-full max-w-3xl shadow-2xl aspect-video overflow-hidden animate-in zoom-in-95 duration-250 my-auto">
             <button 
               onClick={() => setPlayingVideoUrl(null)} 
               className="absolute top-3 right-3 z-50 p-2.5 bg-black/80 hover:bg-black rounded-full text-white/90 hover:text-white transition-colors border border-slate-700 min-w-[44px] min-h-[44px] flex items-center justify-center"
               title="Close Video"
               aria-label="Close"
             >
                <X className="w-5 h-5" />
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
