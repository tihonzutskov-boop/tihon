import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Gym, LibraryExercise, Language, EquipmentItem, MovementPattern, ExerciseCategory, ExperienceLevel, JointStressArea, MuscleGroup, ALL_MUSCLE_GROUPS } from '../types';
import { api, DEFAULT_EQUIPMENT } from '../services/api';
import { searchAndFilterExercises, getExerciseLocations } from '../utils/exerciseMatcher';
import { getEquipmentIcon, isBeginnerFriendly } from '../utils/equipmentIcons';
import { getEquipmentIconComponent } from './EquipmentLibrary';
import { getExerciseRequiredEquipmentIds, getZoneEquipmentIds } from '../utils/equipmentMatcher';
import { getYouTubeVideoId } from '../utils/youtubeEmbed';
import { deriveMuscleGroups, deriveExerciseCategory, suggestEquipmentIds } from '../utils/exerciseTagDerivation';
import EditTutorialModal from './EditTutorialModal';
import VariationTutorialField, { VariationState, blankVariationState, variationStateFromExercise } from './VariationTutorialField';
import {
  Search, MapPin, Dumbbell, Edit3, Trash2, Plus, X, Loader2, KeyRound, Box, Sparkles, Globe, Layers, Check, Flame, ShieldCheck, Film
} from 'lucide-react';

interface ExerciseLibraryProps {
  gym: Gym;
  equipmentList?: EquipmentItem[];
  lang?: Language;
  onLanguageChange?: (lang: Language) => void;
  onLocateExercise?: (exercise: any) => void;
  onOpenTutorials?: () => void;
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
export const MUSCLE_COLORS: Record<string, string> = {
  'Chest': '#f87171', 'Back': '#60a5fa', 'Back/Full Body': '#60a5fa', 'Shoulders': '#fbbf24',
  'Legs/Quads': '#34d399', 'Glutes': '#34d399', 'Glutes/Quads': '#34d399',
  'Arms/Biceps': '#c084fc', 'Arms/Triceps': '#c084fc', 'Cardio': '#22d3ee', 'Core': '#fb923c', 'Full Body': '#a3e635'
};
export const muscleColor = (m: string) => MUSCLE_COLORS[m] || '#94a3b8';

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
        className={`w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-lime-500/50 transition-colors min-h-[44px] ${colored ? 'pl-7' : ''}`}
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
              className="w-full text-left px-3 py-1.5 text-xs text-lime-400 font-semibold hover:bg-slate-800 border-t border-slate-800"
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
  onLocateExercise,
  onOpenTutorials
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
  const [formExerciseType, setFormExerciseType] = useState<'standard' | 'video'>('standard');
  const [formHarderVariation, setFormHarderVariation] = useState<VariationState>(blankVariationState());
  const [formEasierVariation, setFormEasierVariation] = useState<VariationState>(blankVariationState());
  const [formVideoUrl, setFormVideoUrl] = useState('');
  const [formName, setFormName] = useState('');
  // Automatic-generation tagging. An exercise is only auto-selectable once
  // movement pattern, category and the enable flag are all set — the
  // generator treats anything missing as "can't establish eligibility".
  const [formMovementPattern, setFormMovementPattern] = useState<MovementPattern | ''>('');
  const [formExerciseCategoryTag, setFormExerciseCategoryTag] = useState<ExerciseCategory | ''>('');
  const [formMinExperience, setFormMinExperience] = useState<ExperienceLevel | ''>('');
  const [formJointStress, setFormJointStress] = useState<JointStressArea[]>([]);
  const [formPrimaryMuscles, setFormPrimaryMuscles] = useState<MuscleGroup[]>([]);
  const [formSecondaryMuscles, setFormSecondaryMuscles] = useState<MuscleGroup[]>([]);
  const [formGenerationEnabled, setFormGenerationEnabled] = useState(false);
  const [formError, setFormError] = useState('');
  const [savingExercise, setSavingExercise] = useState(false);
  const [equipmentPickerSearch, setEquipmentPickerSearch] = useState('');
  const [showTutorialEditor, setShowTutorialEditor] = useState(false);
  const exerciseFormRef = useRef<HTMLFormElement>(null);
  // Set right before requestSubmit() when "Add Tutorial" is clicked on a
  // brand-new exercise — the save still has to go through the normal
  // submit flow (native required-field validation included), this just
  // tells that flow's .then() to also open the Tutorial editor once the
  // save succeeds.
  const openTutorialAfterSaveRef = useRef(false);

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
    setFormExerciseType(ex.exerciseType === 'video' ? 'video' : 'standard');
    setFormVideoUrl(ex.exerciseType === 'video' ? ex.videoUrl || '' : '');
    setFormHarderVariation(variationStateFromExercise(ex, 'harder'));
    setFormEasierVariation(variationStateFromExercise(ex, 'easier'));
    setFormName(ex.name || '');
    setFormMovementPattern(ex.movementPattern || '');
    // Target Muscle and Category already state these facts in free text —
    // derive rather than making the admin restate them. Only when the
    // structured field is still empty, so a deliberate choice always wins.
    setFormExerciseCategoryTag(ex.exerciseCategory || deriveExerciseCategory(ex.category));
    setFormMinExperience(ex.minExperience || '');
    setFormJointStress(ex.jointStress || []);
    setFormPrimaryMuscles(
      (ex.primaryMuscles && ex.primaryMuscles.length > 0)
        ? ex.primaryMuscles
        : deriveMuscleGroups(ex.targetMuscle)
    );
    setFormSecondaryMuscles(ex.secondaryMuscles || []);
    setFormGenerationEnabled(ex.generationEnabled === true);
    setFormError('');
    setEquipmentPickerSearch('');
    setIsExerciseModalOpen(true);
  };

  const handleOpenCreateModal = () => {
    setEditingExercise(null);
    setSelectedEquipmentIds([]);
    setFormMuscle('Legs/Quads');
    setFormCategory('Compound (Strength)');
    setFormExerciseType('standard');
    setFormVideoUrl('');
    setFormHarderVariation(blankVariationState());
    setFormEasierVariation(blankVariationState());
    setFormName('');
    setFormMovementPattern('');
    setFormExerciseCategoryTag('');
    setFormMinExperience('');
    setFormJointStress([]);
    setFormPrimaryMuscles([]);
    setFormSecondaryMuscles([]);
    setFormGenerationEnabled(false);
    setFormError('');
    setEquipmentPickerSearch('');
    setIsExerciseModalOpen(true);
  };

  const toggleEquipmentSelection = (eqId: string) => {
    setSelectedEquipmentIds(prev =>
      prev.includes(eqId) ? prev.filter(id => id !== eqId) : [...prev, eqId]
    );
  };

  const handleAddNewExercise = async (newEx: Omit<LibraryExercise, 'id'>): Promise<LibraryExercise> => {
    const exerciseToSave: LibraryExercise = {
      ...newEx,
      id: `ex-${Date.now()}`,
      // Video exercises set their own default (the mat/turf area) without
      // ever touching the equipment picker, so selectedEquipmentIds — which
      // only reflects that picker's state — would wipe it out here.
      requiredEquipmentIds: newEx.exerciseType === 'video' ? newEx.requiredEquipmentIds : selectedEquipmentIds
    };
    const result = await api.createExercise(exerciseToSave);
    if (!result.ok) {
      throw new Error(result.error ? `Not saved to the server: ${result.error}` : 'Not saved to the server — check your connection.');
    }
    setLibraryExercises(prev => [...prev, exerciseToSave]);
    return exerciseToSave;
  };

  const handleSaveExerciseEdit = async (updatedEx: LibraryExercise): Promise<LibraryExercise> => {
    const fullUpdated: LibraryExercise = {
      ...updatedEx,
      requiredEquipmentIds: updatedEx.exerciseType === 'video' ? updatedEx.requiredEquipmentIds : selectedEquipmentIds
    };
    const result = await api.saveExercise(fullUpdated);
    if (!result.ok) {
      throw new Error(result.error ? `Not saved to the server: ${result.error}` : 'Not saved to the server — check your connection.');
    }
    setLibraryExercises(prev => prev.map(ex => ex.id === fullUpdated.id ? fullUpdated : ex));
    return fullUpdated;
  };
  
  const handleDeleteExercise = async (id: string) => {
    if (window.confirm(t.confirmDeleteMsg)) {
       setLibraryExercises(prev => prev.filter(ex => ex.id !== id));
       await api.deleteExercise(id);
    }
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
    // Group by a normalized (trimmed, case-insensitive) key so two
    // exercises the admin intends as the same category don't get split
    // into separate headers over a stray space or capitalization
    // difference — targetMuscle/category are free-text fields, not a
    // locked dropdown, so this drift happens easily. The header itself
    // still displays using the first-seen exact casing.
    const groups = new Map<string, { label: string; items: typeof filteredExercises }>();
    filteredExercises.forEach(entry => {
      const raw = (((entry.raw as any)[key] || 'Other') as string).trim() || 'Other';
      const normalized = raw.toLowerCase();
      const existing = groups.get(normalized);
      if (existing) {
        existing.items.push(entry);
      } else {
        groups.set(normalized, { label: raw, items: [entry] });
      }
    });
    return Array.from(groups.values())
      .sort((a, b) => a.label.localeCompare(b.label));
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
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-950 text-slate-200">
      {/* Fixed header: intro, search, group-by, muscle pills, secondary
          filters — stays reachable while the exercise grid below scrolls. */}
      <div className="p-6 pb-0 flex-shrink-0">
      {/* Intro Header info */}
      <div className="mb-6 bg-slate-900/50 border border-slate-800 rounded-2xl p-4 flex items-start gap-4">
        <div className="w-10 h-10 bg-lime-500/10 border border-lime-500/30 text-lime-400 rounded-xl flex items-center justify-center flex-shrink-0 animate-pulse">
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
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-lime-500/50 transition-colors"
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
        {onOpenTutorials && (
          <button
            onClick={onOpenTutorials}
            className="flex items-center justify-center px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 rounded-xl text-xs font-bold transition-all flex-shrink-0"
          >
            <Film className="w-4 h-4 mr-1.5 text-lime-400" /> Tutorials
          </button>
        )}
        <button
          onClick={handleOpenCreateModal}
          className="flex items-center justify-center px-4 py-2.5 bg-lime-500 hover:bg-lime-400 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-md shadow-lime-500/10 flex-shrink-0"
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
                  ? m === 'All' ? 'bg-lime-500 text-slate-950 border-lime-500 font-bold' : 'text-slate-950'
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
      </div>

      {/* Scrollable exercise grid — the only part of this view that scrolls */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
      {/* Grid Container */}
      {isLoadingExercises ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-3 py-12">
          <Loader2 className="w-8 h-8 animate-spin text-lime-500" />
          <p className="text-xs">{t.loading}</p>
        </div>
      ) : filteredExercises.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 border border-dashed border-slate-800 rounded-2xl text-center bg-slate-900/10 my-6">
          <div className="w-12 h-12 bg-slate-900/80 rounded-2xl flex items-center justify-center mb-4 border border-slate-800 text-slate-500"><Dumbbell className="w-6 h-6 animate-bounce" /></div>
          <h3 className="text-sm font-bold text-slate-200 mb-1">{t.noFoundTitle}</h3>
          <p className="text-xs text-slate-500 max-w-xs leading-relaxed mb-6">{t.noFoundDesc}</p>
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-lime-500 hover:bg-lime-400 text-slate-950 font-bold text-xs rounded-xl transition-all"
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
                          {raw.exerciseType === 'video' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/30 text-[8.5px] font-bold tracking-wide uppercase">
                              <Film className="w-2.5 h-2.5" /> Video
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
                        {raw.exerciseType === 'video' ? (
                          <span className="text-[9.5px] px-1.5 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/60 text-slate-300">
                            {raw.videoDurationLabel || 'Follow-along video'}
                          </span>
                        ) : requiredItems.length > 0 ? (
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

                      <div className="flex items-center justify-between pt-2.5 border-t border-slate-850/60">
                        {raw.exerciseType === 'video' ? (
                          <span className="text-[9.5px] font-bold text-slate-500 flex items-center gap-1">
                            <Film className="w-2.5 h-2.5" /> YouTube follow-along
                          </span>
                        ) : (
                          <span className={`text-[9.5px] font-bold flex items-center gap-1 ${isMapped ? 'text-slate-500' : 'text-amber-400'}`}>
                            {isMapped ? <><MapPin className="w-2.5 h-2.5" /> {t.mapAlign}</> : '⚠️ Needs review'}
                          </span>
                        )}
                        {!!(ex.tutorialVideoUrl && ex.steps && ex.steps.length > 0) && (
                          <span className="text-[8.5px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-lime-500/10 text-lime-400 flex items-center gap-1">
                            <Film className="w-2.5 h-2.5" /> Tutorial
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
      </div>

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

                <div className={`px-3 py-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${isMapped ? 'bg-slate-950/50 border-slate-800 text-slate-300' : 'bg-amber-950/30 border-amber-800/30 text-amber-400'}`}>
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  {isMapped ? <span>Mapped to <b className="text-white">{matchedZones.map(z => z.name).join(', ')}</b></span> : <span>Not mapped to a zone yet — needs manual review</span>}
                </div>
              </div>

              <div className="px-6 py-3 border-t border-slate-800 bg-slate-900 flex-shrink-0">
                <button
                  onClick={() => { setPreviewExercise(null); handleOpenEditModal(ex); }}
                  className="w-full px-4 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-lime-500 hover:bg-lime-400 transition-colors flex items-center justify-center gap-1.5 min-h-[44px]"
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
                  <Dumbbell className="w-4 h-4 text-lime-400" />
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
             
             <form ref={exerciseFormRef} onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const isVideo = formExerciseType === 'video';

                // Video exercises are a YouTube follow-along, not an
                // equipment-based movement — nothing to pick from the
                // Equipment Library.
                if (!isVideo && selectedEquipmentIds.length === 0) {
                  setFormError('Select at least one equipment item (use "Open Floor / Mat Area" for bodyweight moves).');
                  return;
                }
                setFormError('');

                const exData = isVideo ? {
                  name: formData.get('name') as string,
                  targetMuscle: formMuscle,
                  // Not truly "no equipment" — a follow-along video still
                  // needs floor space, so it defaults to the mat/turf area.
                  // equipmentId stays auto (unset) so it resolves against
                  // whichever zone actually has that equipment in the
                  // trainee's own gym, same as a standard exercise left on
                  // "Auto-detect from equipment in zone".
                  equipmentRequired: 'Open Floor / Mat Area',
                  requiredEquipmentIds: ['eq-floor-mat'],
                  category: formCategory,
                  instructions: editingExercise?.instructions || '',
                  equipmentId: '',
                  videoUrl: ((formData.get('videoUrl') as string) || '').trim(),
                  videoDurationLabel: ((formData.get('videoDurationLabel') as string) || '').trim(),
                  imageUrl: editingExercise?.imageUrl || '',
                  makeHarder: '',
                  makeEasier: '',
                  harderExerciseId: '',
                  easierExerciseId: '',
                  harderTutorial: {},
                  easierTutorial: {},
                  exerciseType: 'video' as const
                } : (() => {
                  // Construct human readable equipment label
                  const selectedEqItems = selectedEquipmentIds.map(id => equipmentMap.get(id)?.name).filter(Boolean);
                  const reqString = selectedEqItems.join(', ') || 'None (Bodyweight)';
                  const zoneRaw = formData.get('equipmentId') as string;
                  return {
                    name: formData.get('name') as string,
                    targetMuscle: formMuscle,
                    equipmentRequired: reqString,
                    requiredEquipmentIds: selectedEquipmentIds,
                    category: formCategory,
                    // GIF / video URL are edited in the Tutorials editor. Notes
                    // are now a coach-authored, per-plan field edited from the
                    // Coaching page (Exercise.notes) — carry over whatever this
                    // library exercise already had rather than editing it here.
                    instructions: editingExercise?.instructions || '',
                    equipmentId: zoneRaw === 'auto' ? '' : zoneRaw,
                    videoUrl: editingExercise?.videoUrl || '',
                    videoDurationLabel: '',
                    imageUrl: editingExercise?.imageUrl || '',
                    makeHarder: ((formData.get('makeHarder') as string) || '').trim(),
                    makeEasier: ((formData.get('makeEasier') as string) || '').trim(),
                    harderExerciseId: formHarderVariation.mode === 'link' ? formHarderVariation.linkedId : '',
                    easierExerciseId: formEasierVariation.mode === 'link' ? formEasierVariation.linkedId : '',
                    movementPattern: formMovementPattern || undefined,
                    exerciseCategory: formExerciseCategoryTag || undefined,
                    minExperience: formMinExperience || undefined,
                    jointStress: formJointStress,
                    primaryMuscles: formPrimaryMuscles,
                    secondaryMuscles: formSecondaryMuscles,
                    generationEnabled: formGenerationEnabled,
                    harderTutorial: formHarderVariation.mode === 'quick'
                      ? { videoUrl: formHarderVariation.videoUrl.trim(), steps: formHarderVariation.steps.map(s => s.trim()).filter(Boolean) }
                      : {},
                    easierTutorial: formEasierVariation.mode === 'quick'
                      ? { videoUrl: formEasierVariation.videoUrl.trim(), steps: formEasierVariation.steps.map(s => s.trim()).filter(Boolean) }
                      : {},
                    exerciseType: 'standard' as const
                  };
                })();

                setSavingExercise(true);
                (editingExercise
                  ? handleSaveExerciseEdit({ ...editingExercise, ...exData })
                  : handleAddNewExercise(exData)
                )
                  .then((savedEx) => {
                    setEditingExercise(savedEx);
                    setIsExerciseModalOpen(false);
                    if (openTutorialAfterSaveRef.current) {
                      openTutorialAfterSaveRef.current = false;
                      setShowTutorialEditor(true);
                    }
                  })
                  .catch((err: any) => {
                    openTutorialAfterSaveRef.current = false;
                    setFormError(err?.message || 'Failed to save. Please try again.');
                  })
                  .finally(() => setSavingExercise(false));
             }} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="p-6 space-y-4 overflow-y-auto flex-1">
                  <div className="flex gap-2 bg-slate-950 border border-slate-800 rounded-xl p-1">
                    <button
                      type="button"
                      onClick={() => setFormExerciseType('standard')}
                      className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 rounded-lg text-[11.5px] font-bold transition-colors ${
                        formExerciseType === 'standard' ? 'bg-slate-800 text-lime-400' : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      <span>🏋️ Standard Exercise</span>
                      <span className="text-[9px] font-semibold text-slate-500">Equipment, sets &amp; reps</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormExerciseType('video')}
                      className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 rounded-lg text-[11.5px] font-bold transition-colors ${
                        formExerciseType === 'video' ? 'bg-slate-800 text-red-400' : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      <span>▶ Video / Follow-Along</span>
                      <span className="text-[9px] font-semibold text-slate-500">YouTube link, no equipment needed</span>
                    </button>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">{t.exNameLabel} <span className="text-red-500">*</span></label>
                    <input required name="name" type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder={formExerciseType === 'video' ? 'e.g., 10-Min Dynamic Warmup' : 'e.g., Incline Dumbbell Bench Press'} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-lime-500/50 transition-colors min-h-[44px]" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">{t.targetMuscleLabel} <span className="text-red-500">*</span></label>
                      <SearchCombo
                        value={formMuscle}
                        options={allMuscles}
                        onChange={(v: string) => {
                          setFormMuscle(v);
                          // Keep the derived value in step while the admin
                          // hasn't overridden it; once they have, leave it be.
                          setFormPrimaryMuscles(prev => {
                            const derivedFromOld = deriveMuscleGroups(formMuscle);
                            const untouched = prev.length === 0
                              || (prev.length === derivedFromOld.length && prev.every(m => derivedFromOld.includes(m)));
                            return untouched ? deriveMuscleGroups(v) : prev;
                          });
                        }}
                        colored
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">{t.exCatLabel} <span className="text-red-500">*</span></label>
                      <SearchCombo
                        value={formCategory}
                        options={allCategories}
                        onChange={(v: string) => {
                          setFormCategory(v);
                          setFormExerciseCategoryTag(prev =>
                            (!prev || prev === deriveExerciseCategory(formCategory))
                              ? deriveExerciseCategory(v)
                              : prev
                          );
                        }}
                      />
                    </div>
                  </div>

                  {formExerciseType === 'video' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">YouTube URL <span className="text-red-500">*</span></label>
                        <input
                          required={formExerciseType === 'video'}
                          name="videoUrl"
                          type="text"
                          value={formVideoUrl}
                          onChange={(e) => setFormVideoUrl(e.target.value)}
                          placeholder="https://youtube.com/watch?v=..."
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-red-500/50 transition-colors min-h-[44px]"
                        />
                        {getYouTubeVideoId(formVideoUrl) && (
                          <div className="mt-2 flex items-center gap-2.5 bg-slate-950 border border-slate-800 rounded-xl p-2">
                            <img
                              src={`https://img.youtube.com/vi/${getYouTubeVideoId(formVideoUrl)}/hqdefault.jpg`}
                              alt=""
                              className="w-20 h-11 object-cover rounded-lg flex-shrink-0 bg-slate-900"
                            />
                            <span className="text-[10px] font-bold text-lime-400 flex items-center gap-1">
                              <Check className="w-3 h-3" /> Video found
                            </span>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Duration</label>
                        <input name="videoDurationLabel" type="text" defaultValue={editingExercise?.videoDurationLabel || ''} placeholder="e.g., 10 min" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-red-500/50 transition-colors min-h-[44px]" />
                      </div>
                      <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/5 border border-red-500/15 text-[10.5px] text-slate-400 leading-relaxed">
                        <Film className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                        <span>Equipment, target zone, sets/reps, and Harder/Easier are skipped for video exercises — trainees just watch and follow along.</span>
                      </div>
                    </div>
                  )}

                  {/* Interactive Equipment Multi-Selector from Equipment Library */}
                  {formExerciseType === 'standard' && (
                  <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        {t.equipReqInputLabel} <span className="text-red-500">*</span> <span className="text-lime-400">({selectedEquipmentIds.length} selected)</span>
                      </label>
                      <span className="text-[10px] text-slate-500">Tap to select equipment required for this exercise</span>
                    </div>

                    {(() => {
                      // Suggested from the exercise's own name. Added one at a
                      // time on purpose: required equipment is AND-ed, so a
                      // wrongly accepted item would make this exercise
                      // ineligible at gyms that can actually do it.
                      const suggestions = suggestEquipmentIds(formName, '', equipmentList)
                        .filter(id => !selectedEquipmentIds.includes(id))
                        .slice(0, 4);
                      if (suggestions.length === 0) return null;
                      return (
                        <div className="flex items-center gap-1.5 flex-wrap p-2 rounded-lg bg-lime-500/5 border border-lime-500/20">
                          <span className="text-[9.5px] font-bold text-lime-400 uppercase tracking-wide mr-0.5">Suggested</span>
                          {suggestions.map(id => (
                            <button
                              key={id}
                              type="button"
                              onClick={() => toggleEquipmentSelection(id)}
                              className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-900 border border-lime-500/30 text-[10px] font-bold text-lime-300 hover:bg-lime-500/10 transition-colors"
                            >
                              <Plus className="w-2.5 h-2.5" />
                              {equipmentMap.get(id)?.name || id}
                            </button>
                          ))}
                        </div>
                      );
                    })()}

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={equipmentPickerSearch}
                        onChange={(e) => setEquipmentPickerSearch(e.target.value)}
                        placeholder="Search equipment by name or category..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-lime-500/50 transition-colors"
                      />
                    </div>

                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl max-h-48 overflow-y-auto space-y-1.5">
                      {(() => {
                        const q = equipmentPickerSearch.trim().toLowerCase();
                        const visible = q
                          ? equipmentList.filter(eq => eq.name.toLowerCase().includes(q) || (eq.category || '').toLowerCase().includes(q))
                          : equipmentList;

                        if (visible.length === 0) {
                          return <p className="text-xs text-slate-500 text-center py-3">No equipment matches "{equipmentPickerSearch}"</p>;
                        }

                        return visible.map(eq => {
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
                        });
                      })()}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">{t.gymZoneLabel} <span className="text-red-500">*</span></label>
                    <select required name="equipmentId" defaultValue={editingExercise?.equipmentId || 'auto'} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-lime-500/50 transition-colors cursor-pointer min-h-[44px]">
                      <option value="auto" className="bg-slate-950 text-white">{t.unassignedOpt}</option>
                      {gym?.zones?.map(z => (
                        <option key={z.id} value={z.id} className="bg-slate-950 text-white">{z.name}</option>
                      ))}
                    </select>
                  </div>

                  {editingExercise ? (
                    <div className="p-3 rounded-xl border border-lime-500/20 bg-lime-500/5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-500 leading-relaxed">Video, step-by-step instructions, and the GIF live in the Tutorials editor.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowTutorialEditor(true)}
                        className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 bg-lime-500 hover:bg-lime-400 rounded-lg text-[11px] font-bold text-slate-950 transition-colors"
                      >
                        <Film className="w-3.5 h-3.5" />
                        {editingExercise.tutorialVideoUrl ? 'Edit Tutorial' : 'Add Tutorial'}
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/30 flex items-center justify-between gap-3">
                      <p className="text-[10px] text-slate-500 leading-relaxed">Video, step-by-step instructions, and the GIF live in the Tutorials editor. Saves this exercise first, then opens it.</p>
                      <button
                        type="button"
                        disabled={savingExercise}
                        onClick={() => {
                          openTutorialAfterSaveRef.current = true;
                          exerciseFormRef.current?.requestSubmit();
                        }}
                        className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-[11px] font-bold text-white transition-colors disabled:opacity-60"
                      >
                        <Film className="w-3.5 h-3.5" />
                        Add Tutorial
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Difficulty Modifiers: How to make it harder */}
                    <div className="p-3 rounded-xl border border-amber-500/20 bg-slate-950/30">
                      <label className="block text-[10px] text-amber-400 font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-amber-400" />
                        <span>{t.howToMakeHarderLabel}</span>
                      </label>
                      <textarea
                        name="makeHarder"
                        rows={2}
                        defaultValue={editingExercise?.makeHarder || ''}
                        placeholder={t.makeHarderPlaceholder}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-700 focus:outline-none focus:border-amber-500/50 transition-colors resize-none"
                      />
                      <VariationTutorialField
                        value={formHarderVariation}
                        onChange={setFormHarderVariation}
                        libraryExercises={libraryExercises}
                        excludeId={editingExercise?.id}
                        accentColor="#fb923c"
                      />
                    </div>

                    {/* Difficulty Modifiers: How to make it easier */}
                    <div className="p-3 rounded-xl border border-emerald-500/20 bg-slate-950/30">
                      <label className="block text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{t.howToMakeEasierLabel}</span>
                      </label>
                      <textarea
                        name="makeEasier"
                        rows={2}
                        defaultValue={editingExercise?.makeEasier || ''}
                        placeholder={t.makeEasierPlaceholder}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-700 focus:outline-none focus:border-emerald-500/50 transition-colors resize-none"
                      />
                      <VariationTutorialField
                        value={formEasierVariation}
                        onChange={setFormEasierVariation}
                        libraryExercises={libraryExercises}
                        excludeId={editingExercise?.id}
                        accentColor="#34d399"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 -mt-2">Optional — leave either blank if it doesn't apply. Only shown to trainees when filled in.</p>

                  {/* Automatic generation tagging */}
                  <div className="p-3.5 rounded-xl border border-sky-500/20 bg-sky-500/[0.03] space-y-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] text-sky-400 font-bold uppercase tracking-wider mb-1">Automatic plan generation</p>
                        <p className="text-[10px] text-slate-500 leading-relaxed">
                          Lets the generator pick this exercise for a client's plan on its own. It stays off until movement pattern and type are set.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormGenerationEnabled(v => !v)}
                        disabled={!formMovementPattern || !formExerciseCategoryTag}
                        className={`flex-shrink-0 px-3 py-2 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                          formGenerationEnabled ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {formGenerationEnabled ? '✓ Enabled' : 'Disabled'}
                      </button>
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Movement pattern</label>
                      <div className="flex flex-wrap gap-1.5">
                        {(['horizontal_push','horizontal_pull','vertical_push','vertical_pull','squat','hinge','lunge','carry','core','conditioning','mobility'] as MovementPattern[]).map(mp => (
                          <button
                            key={mp}
                            type="button"
                            onClick={() => setFormMovementPattern(formMovementPattern === mp ? '' : mp)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                              formMovementPattern === mp ? 'bg-sky-500 text-slate-950' : 'bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-600'
                            }`}
                          >
                            {mp.replace(/_/g, ' ')}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Type</label>
                        <div className="flex flex-wrap gap-1.5">
                          {(['compound','isolation','cardio','mobility','warmup','cooldown'] as ExerciseCategory[]).map(c => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setFormExerciseCategoryTag(formExerciseCategoryTag === c ? '' : c)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                                formExerciseCategoryTag === c ? 'bg-sky-500 text-slate-950' : 'bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-600'
                              }`}
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Minimum experience</label>
                        <div className="flex flex-wrap gap-1.5">
                          {(['Beginner','Intermediate','Advanced'] as ExperienceLevel[]).map(lv => (
                            <button
                              key={lv}
                              type="button"
                              onClick={() => setFormMinExperience(formMinExperience === lv ? '' : lv)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                                formMinExperience === lv ? 'bg-sky-500 text-slate-950' : 'bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-600'
                              }`}
                            >
                              {lv}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Primary muscles</label>
                        <div className="flex flex-wrap gap-1.5">
                          {ALL_MUSCLE_GROUPS.map(m => {
                            const on = formPrimaryMuscles.includes(m);
                            return (
                              <button
                                key={m}
                                type="button"
                                onClick={() => setFormPrimaryMuscles(prev => on ? prev.filter(x => x !== m) : [...prev, m])}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                                  on ? 'bg-sky-500 text-slate-950' : 'bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-600'
                                }`}
                              >
                                {m}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Secondary muscles</label>
                        <div className="flex flex-wrap gap-1.5">
                          {ALL_MUSCLE_GROUPS.map(m => {
                            const on = formSecondaryMuscles.includes(m);
                            return (
                              <button
                                key={m}
                                type="button"
                                onClick={() => setFormSecondaryMuscles(prev => on ? prev.filter(x => x !== m) : [...prev, m])}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                                  on ? 'bg-slate-700 text-white' : 'bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-600'
                                }`}
                              >
                                {m}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 -mt-1.5">
                      Filled in from Target Muscle and Category above — click any chip to change it. Used to keep a week balanced and avoid stacking exercises that train the same thing.
                    </p>

                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Stresses these areas</label>
                      <div className="flex flex-wrap gap-1.5">
                        {(['Back','Knees','Shoulders','Neck','Wrists','Hips','Ankles'] as JointStressArea[]).map(area => {
                          const on = formJointStress.includes(area);
                          return (
                            <button
                              key={area}
                              type="button"
                              onClick={() => setFormJointStress(prev => on ? prev.filter(a => a !== area) : [...prev, area])}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                                on ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' : 'bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-600'
                              }`}
                            >
                              {area}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1.5">Clients reporting an injury in a selected area never get this exercise.</p>
                    </div>
                  </div>
                  </>
                  )}

                  {formError && (
                    <div className="p-3 rounded-xl bg-red-950/30 border border-red-800/40 text-xs text-red-400">
                      {formError}
                    </div>
                  )}
                </div>

                <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end space-x-3 flex-shrink-0">
                   <button type="button" onClick={() => setIsExerciseModalOpen(false)} className="px-5 py-2.5 bg-slate-950 hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-400 border border-slate-800 transition-colors min-h-[44px]">{t.discardBtn}</button>
                   <button type="submit" disabled={savingExercise} className="px-5 py-2.5 bg-lime-500 hover:bg-lime-400 rounded-xl text-xs font-bold text-slate-950 shadow-md shadow-lime-500/20 min-h-[44px] disabled:opacity-60">
                     {savingExercise ? 'Saving…' : editingExercise ? t.saveBtn : t.publishBtn}
                   </button>
                </div>
             </form>
          </div>
        </div>
      )}

      {showTutorialEditor && editingExercise && (
        <EditTutorialModal
          exercise={editingExercise}
          onClose={() => setShowTutorialEditor(false)}
          onSave={async (updated) => {
            const result = await api.saveExercise(updated);
            setLibraryExercises(prev => prev.map(ex => ex.id === updated.id ? updated : ex));
            setEditingExercise(updated);
            if (!result.ok) {
              throw new Error(
                result.error
                  ? `Saved on this device only — the server rejected it: ${result.error}`
                  : 'Saved on this device only — could not reach the server.'
              );
            }
          }}
        />
      )}

    </div>
  );
};

export default ExerciseLibrary;
