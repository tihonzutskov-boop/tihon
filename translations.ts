import { Language } from './types';

export const translations: Record<Language, any> = {
  et: {
    library: 'Varustus',
    searchExercises: 'Otsi harjutusi',
    myPlan: 'Minu kava',
    landingTitle: 'Ruumiline treeningmootor',
    selectLocation: 'Vali asukoht',
    zones: 'tsooni',
    enterGym: 'Sisene saali',
    trainingPlan: 'Treeningkava',
    items: 'elementi',
    planEmpty: 'Sinu kava on tühi',
    selectEquipment: 'Vali varustus kaardilt või harjutuste kogust.',
    clear: 'Puhasta',
    savePlan: 'Salvesta kava',
    exportPlan: 'Laadi alla PDF',
    noExercises: 'Harjutusi pole veel genereeritud.',
    sets: 'seeriat',
    reps: 'kordust',
    watchGuide: 'Vaata juhendit',
    closeGuide: 'Sulge juhend',
    instructions: 'Juhised',
    proTip: 'Professionaalne nõuanne',
    login: 'Logi sisse',
    signup: 'Registreeru',
    welcomeBack: 'Tere tulemast tagasi',
    joinMovement: 'Liitu liikumisega',
    fullName: 'Täisnimi',
    email: 'E-posti aadress',
    dashboard: 'Töölaud',
    completedWorkouts: 'Lõpetatud treeningud',
    streak: 'Päevade seeria',
    totalHours: 'Tunde kokku',
    recentActivity: 'Viimane tegevus',
    logout: 'Logi välja',
    adminAccess: 'Admin ligipääs',
    machineGuide: 'Masina juhend',
    noInstructions: 'Selle masina kohta puuduvad üksikasjalikud juhised.',
    proTipDefault: 'Enne alustamist skaneeri oma ümbrust. Reguleeri istme kõrgus ja raskused vastavalt oma võimekusele.',
    searchPlaceholder: 'Otsi varustust või tsoone...',
    showOnMap: 'Näita kaardil',
    noEquipmentFound: 'Varustust ei leitud',
    inZone: 'Asukoht:',
    all: 'Kõik',
    readyToCrush: 'Kas oled tänaseks trenniks valmis?',
    availableGyms: 'Saadaval jõusaalid',
    extensions: 'laiendust',
    workoutsCompleted: 'Lõpetatud treeningud',
    dayStreak: 'Päevade jada',
    totalDuration: 'Koguaeg',
    recentActivityTitle: 'Viimased tegevused',
    completed: 'Lõpetatud',
    daysAgo: 'päeva tagasi',
    mins: 'min',
    addExerciseManually: 'Lisa harjutus käsitsi',
    exerciseName: 'Harjutuse nimi',
    muscleGroup: 'Lihasgrupp',
    cancel: 'Tühista',
    add: 'Lisa',
    edit: 'Muuda',
    update: 'Uuenda',
    save: 'Salvesta',
    day: 'Päev',
    locate: 'Leia saalist',
    watchVideo: 'Vaata YouTube Shortse',
    selectZoneTitle: 'Vali tsoon',
    remove: 'Eemalda',
    addToProgram: 'Lisa kavasse',
    exerciseDetails: 'Harjutuse detailid',
    description: 'Kirjeldus ja tehnika',
    searchOnYoutube: 'Otsi YouTube-ist',
    searchOnShorts: 'Otsi YouTube Shortse',
    searchOnTiktok: 'Otsi YouTube Shortse',
    noVideoFound: 'Videodemonstratsiooni pole lisatud',
    clickToWatch: 'Vajuta harjutusele kirjelduse ja video vaatamiseks',
    howToMakeHarder: 'Kuidas muuta raskemaks',
    howToMakeEasier: 'Kuidas muuta kergemaks',
    makeHarderPlaceholder: 'nt. Aeglusta tempot (3 sek allalaskmine), lisa paus liigutuse tipus või suurenda raskust...',
    makeEasierPlaceholder: 'nt. Vähenda liikumisulatust, kasuta kergemat raskust või abistavat kummilinti...',
    difficultyModifiers: 'Raskusastme kohandamine',
    gymContent: {
      'Main Location': 'Peamine asukoht',
      'Cardio': 'Kardio',
      'Free Weights': 'Vabad raskused',
      'Machine': 'Masinad',
      'Power Rack': 'Jõuraamid',
      'Functional': 'Funktsionaalne',
      'Corridor': 'Koridor',
      'Facility': 'Ruumid',
      'Treadmills': 'Jooksurajad',
      'Rowers': 'Sõudeergomeetrid',
      'Dumbbell Rack': 'Hantlite ala',
      'Functional Turf': 'Funktsionaalne ala',
      'Squat Racks': 'Kükipuurid',
      'Cable Cross': 'Plokkmasin',
      'Leg Press': 'Jalapress',
      'Bench Press': 'Lamades surumine',
      'Treadmill 1': 'Jooksurada 1',
      'Treadmill 2': 'Jooksurada 2',
      'Treadmill 3': 'Jooksurada 3',
      'Treadmill 4': 'Jooksurada 4',
      'Rower A': 'Sõudeergomeeter A',
      'Rower B': 'Sõudeergomeeter B',
      'Rower C': 'Sõudeergomeeter C',
      'Rack 1': 'Puur 1',
      'Rack 2': 'Puur 2',
      'Rack 3': 'Puur 3',
      'Rack 4': 'Puur 4',
      'Main Rack': 'Peamine hantliraam',
      'Bench': 'Pink',
      'Standard treadmill for warmups and cardio intervals. Features incline settings up to 15% and speeds up to 12mph.': 'Standardne jooksurada soojenduseks ja kardiotreeninguks. Kaldenurk kuni 15% ja kiirus kuni 20 km/h.',
      'Concept2 Rower. Focus on driving with your legs before pulling with your arms. Great for full body conditioning.': 'Concept2 sõudeergomeeter. Keskendu jalgadega lükkamisele enne kätega tõmbamist. Suurepärane kogu keha vormimiseks.',
      'Power Rack suitable for Squats, Overhead Press, and Rack Pulls. Includes safety bars and pull-up handles.': 'Jõuraam kükkideks, surumisteks ja tõmmeteks. Sisaldab turvavardaid ja lõuatõmbekange.',
      '45-degree leg press machine. Ensure back is flat against the pad and do not lock knees at the top of the movement.': '45-kraadine jalapress. Veendu, et selg on vastu patja ja ära lukusta põlvi ülaasendis.'
    }
  },
  en: {
    library: 'Library',
    myPlan: 'My Plan',
    landingTitle: 'Spatial Training Engine',
    selectLocation: 'Select Location',
    zones: 'Zones',
    enterGym: 'Enter Gym',
    trainingPlan: 'Training Plan',
    items: 'Items',
    planEmpty: 'Your plan is empty',
    selectEquipment: 'Select equipment from the map or the exercise library.',
    clear: 'Clear',
    savePlan: 'Save Plan',
    exportPlan: 'Download PDF',
    noExercises: 'No exercises generated yet.',
    sets: 'Sets',
    reps: 'Reps',
    watchGuide: 'Watch Guide',
    closeGuide: 'Close Guide',
    instructions: 'Instructions',
    proTip: 'Pro Tip',
    login: 'Log In',
    signup: 'Sign Up',
    welcomeBack: 'Welcome Back',
    joinMovement: 'Join the Movement',
    fullName: 'Full Name',
    email: 'Email Address',
    dashboard: 'Dashboard',
    completedWorkouts: 'Workouts Completed',
    streak: 'Day Streak',
    totalHours: 'Total Hours',
    recentActivity: 'Recent Activity',
    logout: 'Log Out',
    adminAccess: 'Admin Access',
    searchExercises: 'Search Exercises',
    machineGuide: 'Machine Guide',
    noInstructions: 'No detailed instructions provided for this machine.',
    proTipDefault: 'Scan your environment before starting. Adjust the seat height and weight stack to match your strength level.',
    searchPlaceholder: 'Search equipment or zones...',
    showOnMap: 'Show on Map',
    noEquipmentFound: 'No equipment found',
    inZone: 'In',
    all: 'All',
    readyToCrush: 'Ready to crush your workout today?',
    availableGyms: 'Available Gyms',
    extensions: 'extensions',
    workoutsCompleted: 'Workouts Completed',
    dayStreak: 'Day Streak',
    totalDuration: 'Total Hours',
    recentActivityTitle: 'Recent Activity',
    completed: 'Completed',
    daysAgo: 'days ago',
    mins: 'mins',
    addExerciseManually: 'Add exercise manually',
    exerciseName: 'Exercise name',
    muscleGroup: 'Muscle group',
    cancel: 'Cancel',
    add: 'Add',
    edit: 'Edit',
    update: 'Update',
    save: 'Save',
    day: 'Day',
    locate: 'Locate in Gym',
    watchVideo: 'Watch YouTube Shorts',
    selectZoneTitle: 'Select a Zone',
    remove: 'Remove',
    addToProgram: 'Add to Program',
    exerciseDetails: 'Exercise Details',
    description: 'Description & Technique',
    searchOnYoutube: 'Search on YouTube',
    searchOnShorts: 'Search YouTube Shorts',
    searchOnTiktok: 'Search YouTube Shorts',
    noVideoFound: 'No direct video attached',
    clickToWatch: 'Click exercise to view video & description',
    howToMakeHarder: 'How to make it harder',
    howToMakeEasier: 'How to make it easier',
    makeHarderPlaceholder: 'e.g. Slow down tempo (3s eccentric), add pause at peak contraction, or increase resistance...',
    makeEasierPlaceholder: 'e.g. Reduce range of motion, use lighter resistance, or utilize an assistance band...',
    difficultyModifiers: 'Difficulty Variations & Scaling',
    gymContent: {
      'Main Location': 'Main Location',
      'Cardio': 'Cardio',
      'Free Weights': 'Free Weights',
      'Machine': 'Machine',
      'Power Rack': 'Power Rack',
      'Functional': 'Functional',
      'Corridor': 'Corridor',
      'Facility': 'Facility'
    }
  },
  ru: {
    library: 'Оборудование',
    searchExercises: 'Поиск упражнений',
    myPlan: 'Мой план',
    landingTitle: 'Система пространственных тренировок',
    selectLocation: 'Выберите локацию',
    zones: 'зоны',
    enterGym: 'Войти в зал',
    trainingPlan: 'План тренировки',
    items: 'элем.',
    planEmpty: 'Ваш план пуст',
    selectEquipment: 'Выберите оборудование на карте или в библиотеке упражнений.',
    clear: 'Очистить',
    savePlan: 'Сохранить план',
    exportPlan: 'Скачать PDF',
    noExercises: 'Упражнения еще не созданы.',
    sets: 'подх.',
    reps: 'повт.',
    watchGuide: 'Смотреть гид',
    closeGuide: 'Закрыть гид',
    instructions: 'Инструкции',
    proTip: 'Совет профи',
    login: 'Войти',
    signup: 'Регистрация',
    welcomeBack: 'С возвращением',
    joinMovement: 'Присоединяйтесь к нам',
    fullName: 'Полное имя',
    email: 'Эл. почта',
    dashboard: 'Панель',
    completedWorkouts: 'Завершено тренировок',
    streak: 'Серия дней',
    totalHours: 'Всего часов',
    recentActivity: 'Последние действия',
    logout: 'Выйти',
    adminAccess: 'Доступ админа',
    machineGuide: 'Руководство',
    noInstructions: 'Для этого тренажера нет подробных инструкций.',
    proTipDefault: 'Осмотритесь перед началом. Отрегулируйте высоту сиденья и вес в соответствии со своим уровнем.',
    searchPlaceholder: 'Поиск оборудования или зон...',
    showOnMap: 'Показать на карте',
    noEquipmentFound: 'Оборудование не найдено',
    inZone: 'В зоне',
    all: 'Все',
    readyToCrush: 'Готовы к тренировке сегодня?',
    availableGyms: 'Доступные залы',
    extensions: 'расширений',
    workoutsCompleted: 'Завершено тренировках',
    dayStreak: 'Ударный режим',
    totalDuration: 'Всего часов',
    recentActivityTitle: 'Последние действия',
    completed: 'Завершено',
    daysAgo: 'дня назад',
    mins: 'мин',
    addExerciseManually: 'Добавить вручную',
    exerciseName: 'Название упражнения',
    muscleGroup: 'Группа мышц',
    cancel: 'Отмена',
    add: 'Добавить',
    edit: 'Изменить',
    update: 'Обновить',
    save: 'Сохранить',
    day: 'День',
    locate: 'Найти в зале',
    watchVideo: 'Смотреть YouTube Shorts',
    selectZoneTitle: 'Выберите зону',
    remove: 'Удалить',
    addToProgram: 'Добавить в программу',
    exerciseDetails: 'Детали упражнения',
    description: 'Описание и техника',
    searchOnYoutube: 'Искать на YouTube',
    searchOnShorts: 'Искать в YouTube Shorts',
    searchOnTiktok: 'Искать в YouTube Shorts',
    noVideoFound: 'Прямое видео не прикреплено',
    clickToWatch: 'Нажмите на упражнение для просмотра видео и описания',
    howToMakeHarder: 'Как усложнить',
    howToMakeEasier: 'Как облегчить',
    makeHarderPlaceholder: 'напр. Замедлите темп (3 сек опускание), добавьте паузу в пиковой точке или увеличьте вес...',
    makeEasierPlaceholder: 'напр. Уменьшите амплитуду движения, используйте меньший вес или резиновую петлю для помощи...',
    difficultyModifiers: 'Вариации сложности и масштабирование',
    gymContent: {
      'Main Location': 'Главный зал',
      'Cardio': 'Кардио',
      'Free Weights': 'Свободные веса',
      'Machine': 'Тренажеры',
      'Power Rack': 'Силовые рамы',
      'Functional': 'Функционал',
      'Corridor': 'Коридор',
      'Facility': 'Удобства',
      'Treadmills': 'Беговые дорожки',
      'Rowers': 'Гребные тренажеры',
      'Dumbbell Rack': 'Зона гантелей',
      'Functional Turf': 'Функциональная зона',
      'Squat Racks': 'Силовые рамы',
      'Cable Cross': 'Кроссовер',
      'Leg Press': 'Жим ногами',
      'Bench Press': 'Жим лежа',
      'Treadmill 1': 'Дорожка 1',
      'Treadmill 2': 'Дорожка 2',
      'Treadmill 3': 'Дорожка 3',
      'Treadmill 4': 'Дорожка 4',
      'Rower A': 'Гребля A',
      'Rower B': 'Гребля B',
      'Rower C': 'Гребля C',
      'Rack 1': 'Рама 1',
      'Rack 2': 'Рама 2',
      'Rack 3': 'Рама 3',
      'Rack 4': 'Рама 4',
      'Main Rack': 'Основная стойка',
      'Bench': 'Скамья',
      'Standard treadmill for warmups and cardio intervals. Features incline settings up to 15% and speeds up to 12mph.': 'Стандартная дорожка для разминки. Наклон до 15% и скорость до 20 км/ч.',
      'Concept2 Rower. Focus on driving with your legs before pulling with your arms. Great for full body conditioning.': 'Тренажер Concept2. Сосредоточьтесь на толчке ногами перед тягой руками.',
      'Power Rack suitable for Squats, Overhead Press, and Rack Pulls. Includes safety bars and pull-up handles.': 'Силовая рама для приседаний и жимов. Включает страховочные упоры.',
      '45-degree leg press machine. Ensure back is flat against the pad and do not lock knees at the top of the movement.': 'Жим ногами под углом 45 градусов. Держите спину прижатой и не блокируйте колени.'
    }
  }
};

export const getGymTranslation = (text: string | undefined, lang: Language): string => {
  if (!text) return '';
  const langTranslations = translations[lang] || translations.en;
  if (langTranslations && langTranslations.gymContent && langTranslations.gymContent[text]) {
    return langTranslations.gymContent[text];
  }
  return text;
};

export const MUSCLE_TRANSLATIONS: Record<Language, Record<string, string>> = {
  en: {
    'Quads': 'Quads', 'Quadriceps': 'Quads', 'Glutes': 'Glutes', 'Legs/Quads': 'Legs/Quads', 'Glutes/Quads': 'Glutes/Quads',
    'Legs/Glutes': 'Legs/Glutes', 'Hamstrings': 'Hamstrings', 'Calves': 'Calves',
    'Back': 'Back', 'Lats': 'Lats', 'Upper Back': 'Upper Back', 'Lower Back': 'Lower Back', 'Back/Full Body': 'Back/Full Body',
    'Chest': 'Chest', 'Pectorals': 'Chest', 'Shoulders': 'Shoulders', 'Delts': 'Shoulders',
    'Arms/Biceps': 'Arms/Biceps', 'Arms/Triceps': 'Arms/Triceps', 'Biceps': 'Biceps', 'Triceps': 'Triceps', 'Arms': 'Arms',
    'Cardio': 'Cardio', 'Core': 'Core', 'Abs': 'Abs', 'Full Body': 'Full Body',
    'Legs': 'Legs', 'General': 'General', 'Traps': 'Traps', 'Forearms': 'Forearms',
    // Reverse lookup maps
    'Nelipealihas': 'Quads', 'Tuhar': 'Glutes', 'Tagareie lihased': 'Hamstrings', 'Selg': 'Back', 'Lailihas': 'Lats', 'Rind': 'Chest', 'Õlad': 'Shoulders',
    'Käed/Biitseps': 'Arms/Biceps', 'Käed/Triitseps': 'Arms/Triceps', 'Kardio': 'Cardio', 'Tüvelihased': 'Core', 'Kõhulihased': 'Abs', 'Kogu keha': 'Full Body', 'Jalad': 'Legs', 'Säärelihased': 'Calves', 'Alaselg': 'Lower Back',
    'Квадрицепс': 'Quads', 'Ягодицы': 'Glutes', 'Бицепс бедра': 'Hamstrings', 'Спина': 'Back', 'Широчайшие': 'Lats', 'Грудь': 'Chest', 'Плечи': 'Shoulders',
    'Руки/Бицепс': 'Arms/Biceps', 'Руки/Трицепс': 'Arms/Triceps', 'Кардио': 'Cardio', 'Кор': 'Core', 'Пресс': 'Abs', 'Все тело': 'Full Body', 'Ноги': 'Legs', 'Икры': 'Calves', 'Поясница': 'Lower Back'
  },
  et: {
    'Quads': 'Nelipealihas', 'Quadriceps': 'Nelipealihas', 'Glutes': 'Tuhar', 'Legs/Quads': 'Jalad/Nelipealihas', 'Glutes/Quads': 'Tuhar/Nelipealihas',
    'Legs/Glutes': 'Jalad/Tuhar', 'Hamstrings': 'Tagareie lihased', 'Calves': 'Säärelihased',
    'Back': 'Selg', 'Lats': 'Lailihas', 'Upper Back': 'Ülaselg', 'Lower Back': 'Alaselg', 'Back/Full Body': 'Selg/Kogu keha',
    'Chest': 'Rind', 'Pectorals': 'Rind', 'Shoulders': 'Õlad', 'Delts': 'Õlad',
    'Arms/Biceps': 'Käed/Biitseps', 'Arms/Triceps': 'Käed/Triitseps', 'Biceps': 'Biitseps', 'Triceps': 'Triitseps', 'Arms': 'Käed',
    'Cardio': 'Kardio', 'Core': 'Tüvelihased', 'Abs': 'Kõhulihased', 'Full Body': 'Kogu keha',
    'Legs': 'Jalad', 'General': 'Üldine', 'Traps': 'Trapets', 'Forearms': 'Küünarvarred',
    // Self/Reverse maps
    'Nelipealihas': 'Nelipealihas', 'Tuhar': 'Tuhar', 'Tagareie lihased': 'Tagareie lihased', 'Selg': 'Selg', 'Lailihas': 'Lailihas', 'Rind': 'Rind', 'Õlad': 'Õlad',
    'Käed/Biitseps': 'Käed/Biitseps', 'Käed/Triitseps': 'Käed/Triitseps', 'Kardio': 'Kardio', 'Tüvelihased': 'Tüvelihased', 'Kõhulihased': 'Kõhulihased', 'Kogu keha': 'Kogu keha', 'Jalad': 'Jalad', 'Säärelihased': 'Säärelihased', 'Alaselg': 'Alaselg',
    'Квадрицепс': 'Nelipealihas', 'Ягодицы': 'Tuhar', 'Бицепс бедра': 'Tagareie lihased', 'Спина': 'Selg', 'Широчайшие': 'Lailihas', 'Грудь': 'Rind', 'Плечи': 'Õlad',
    'Руки/Бицепс': 'Käed/Biitseps', 'Руки/Трицепс': 'Käed/Triitseps', 'Кардио': 'Kardio', 'Кор': 'Tüvelihased', 'Пресс': 'Kõhulihased', 'Все тело': 'Kogu keha', 'Ноги': 'Jalad', 'Икры': 'Säärelihased', 'Поясница': 'Alaselg'
  },
  ru: {
    'Quads': 'Квадрицепс', 'Quadriceps': 'Квадрицепс', 'Glutes': 'Ягодицы', 'Legs/Quads': 'Ноги/Квадрицепс', 'Glutes/Quads': 'Ягодицы/Квадрицепс',
    'Legs/Glutes': 'Ноги/Ягодицы', 'Hamstrings': 'Бицепс бедра', 'Calves': 'Икры',
    'Back': 'Спина', 'Lats': 'Широчайшие', 'Upper Back': 'Верх спины', 'Lower Back': 'Поясница', 'Back/Full Body': 'Спина/Все тело',
    'Chest': 'Грудь', 'Pectorals': 'Грудные', 'Shoulders': 'Плечи', 'Delts': 'Дельты',
    'Arms/Biceps': 'Руки/Бицепс', 'Arms/Triceps': 'Руки/Трицепс', 'Biceps': 'Бицепс', 'Triceps': 'Трицепс', 'Arms': 'Руки',
    'Cardio': 'Кардио', 'Core': 'Кор', 'Abs': 'Пресс', 'Full Body': 'Все тело',
    'Legs': 'Ноги', 'General': 'Общее', 'Traps': 'Трапеция', 'Forearms': 'Предплечья',
    // Reverse maps
    'Nelipealihas': 'Квадрицепс', 'Tuhar': 'Ягодицы', 'Tagareie lihased': 'Бицепс бедра', 'Selg': 'Спина', 'Lailihas': 'Широчайшие', 'Rind': 'Грудь', 'Õlad': 'Плечи',
    'Käed/Biitseps': 'Руки/Бицепс', 'Käed/Triitseps': 'Руки/Трицепс', 'Kardio': 'Кардио', 'Tüvelihased': 'Кор', 'Kõhulihased': 'Пресс', 'Kogu keha': 'Все тело', 'Jalad': 'Ноги', 'Säärelihased': 'Икры', 'Alaselg': 'Поясница',
    'Квадрицепс': 'Квадрицепс', 'Ягодицы': 'Ягодицы', 'Бицепс бедра': 'Бицепс бедра', 'Спина': 'Спина', 'Широчайшие': 'Широчайшие', 'Грудь': 'Грудь', 'Плечи': 'Плечи',
    'Руки/Бицепс': 'Руки/Бицепс', 'Руки/Трицепс': 'Руки/Трицепс', 'Кардио': 'Кардио', 'Кор': 'Кор', 'Пресс': 'Пресс', 'Все тело': 'Все тело', 'Ноги': 'Ноги', 'Икры': 'Икры', 'Поясница': 'Поясница'
  }
};

export const translateMuscle = (muscle: string | undefined, lang: Language): string => {
  if (!muscle) return '';
  const trimmed = muscle.trim();
  if (MUSCLE_TRANSLATIONS[lang]?.[trimmed]) {
    return MUSCLE_TRANSLATIONS[lang][trimmed];
  }
  const lower = trimmed.toLowerCase();
  const entries = Object.entries(MUSCLE_TRANSLATIONS[lang] || {});
  for (const [key, val] of entries) {
    if (key.toLowerCase() === lower) {
      return val;
    }
  }
  return muscle;
};

export const EXERCISE_NAME_TRANSLATIONS: Record<string, Record<Language, string>> = {
  'Barbell Back Squat': { en: 'Barbell Back Squat', et: 'Kangiga kükk turjal', ru: 'Приседания со штангой' },
  'Barbell Squat': { en: 'Barbell Squat', et: 'Kangiga kükk turjal', ru: 'Приседания со штангой' },
  'Squats': { en: 'Squats', et: 'Kükid', ru: 'Приседания' },
  'Goblet Squat': { en: 'Goblet Squat', et: 'Kükk hantliga ees', ru: 'Приседания Гоблет' },
  'Bench Press': { en: 'Bench Press', et: 'Lamades surumine', ru: 'Жим лежа' },
  'Barbell Bench Press': { en: 'Barbell Bench Press', et: 'Lamades surumine kangiga', ru: 'Жим штанги лежа' },
  'Dumbbell Bench Press': { en: 'Dumbbell Bench Press', et: 'Lamades surumine hantlitega', ru: 'Жим гантелей лежа' },
  'Incline Bench Press': { en: 'Incline Bench Press', et: 'Kaldpingil surumine', ru: 'Жим на наклонной скамье' },
  'Leg Press': { en: 'Machine Leg Press', et: 'Jalapress masinal', ru: 'Жим ногами в тренажере' },
  'Machine Leg Press': { en: 'Machine Leg Press', et: 'Jalapress masinal', ru: 'Жим ногами в тренажере' },
  'Overhead Press': { en: 'Overhead Press', et: 'Õlalt surumine kangiga', ru: 'Жим над головой' },
  'Dumbbell Shoulder Press': { en: 'Dumbbell Shoulder Press', et: 'Õlalt surumine hantlitega', ru: 'Жим гантелей стоя/сидя' },
  'Lat Pulldown': { en: 'Lat Pulldown', et: 'Ülatõmme plokil', ru: 'Тяга верхнего блока' },
  'Seated Cable Row': { en: 'Seated Cable Row', et: 'Eesttõmme plokil istudes', ru: 'Тяга нижнего блока' },
  'Barbell Bent Over Row': { en: 'Barbell Bent Over Row', et: 'Kangi tõmbed vastu kõhtu', ru: 'Тяга штанги в наклоне' },
  'Dumbbell Row': { en: 'Dumbbell Row', et: 'Hantli tõmme kummardudes', ru: 'Тяга гантели в наклоне' },
  'Deadlift': { en: 'Deadlift', et: 'Jõutõmme', ru: 'Становая тяга' },
  'Romanian Deadlift': { en: 'Romanian Deadlift', et: 'Rumeenia jõutõmme', ru: 'Румынская тяга' },
  'Barbell Biceps Curl': { en: 'Barbell Biceps Curl', et: 'Biitsepsitõmme kangiga', ru: 'Сгибание рук со штангой' },
  'Dumbbell Biceps Curl': { en: 'Dumbbell Biceps Curl', et: 'Biitsepsitõmme hantlitega', ru: 'Сгибания на бицепс с гантелями' },
  'Triceps Pushdown': { en: 'Triceps Pushdown', et: 'Triitsepsile alla surumine plokil', ru: 'Разгибание рук на блоке' },
  'Dips': { en: 'Dips', et: 'Rööbaspuudel surumine', ru: 'Отжимания на брусьях' },
  'Push-ups': { en: 'Push-ups', et: 'Kätekõverdused', ru: 'Отжимания от пола' },
  'Pull-ups': { en: 'Pull-ups', et: 'Lõuatõmbed', ru: 'Подтягивания' },
  'Leg Extension': { en: 'Leg Extension', et: 'Jalgade sirutamine masinal', ru: 'Разгибание ног в тренажере' },
  'Leg Curl': { en: 'Leg Curl', et: 'Jalgade kõverdamine masinal', ru: 'Сгибание ног в тренажере' },
  'Lying Leg Curl': { en: 'Lying Leg Curl', et: 'Jalgade kõverdamine kõhuli masinal', ru: 'Сгибание ног лежа' },
  'Calf Raise': { en: 'Calf Raise', et: 'Päkkadele tõus', ru: 'Подъемы на носки' },
  'Plank': { en: 'Plank', et: 'Plank', ru: 'Планка' },
  'Crunches': { en: 'Crunches', et: 'Kõhulihaste kõverdamine', ru: 'Скручивания на пресс' },
  'Hanging Leg Raise': { en: 'Hanging Leg Raise', et: 'Jalgade tõsted rippes', ru: 'Подъем ног в висе' },
  'Treadmill Run': { en: 'Treadmill Run', et: 'Jooksulindil kõnd/jooks', ru: 'Беговая дорожка' },
  'Treadmill Incline Hike': { en: 'Treadmill Incline Hike', et: 'Jooksulindil tõusuga kõnd', ru: 'Ходьба в горку на дорожке' },
  'Concept2 Rower': { en: 'Concept2 Rowing', et: 'Concept2 sõudeergomeeter', ru: 'Гребной тренажер Concept2' },
  'Concept2 Rowing': { en: 'Concept2 Rowing', et: 'Concept2 sõudeergomeeter', ru: 'Гребной тренажер Concept2' },
  'Assault Bike Sprint': { en: 'Assault Bike Sprint', et: 'Assault Bike sprint', ru: 'Спринт на Assault Bike' },
  'Kettlebell Swings': { en: 'Kettlebell Swings', et: 'Sangpommi hoogsammud', ru: 'Махи гирей' },
  'Face Pulls': { en: 'Face Pulls', et: 'Näole tõmbed plokil', ru: 'Тяга к лицу на блоке' },
  'Lateral Raises': { en: 'Lateral Raises', et: 'Hantlite viimine kõrvale', ru: 'Махи гантелями в стороны' },
  // Estonian keys mapping
  'Kangiga kükk turjal': { en: 'Barbell Back Squat', et: 'Kangiga kükk turjal', ru: 'Приседания со штангой' },
  'Lamades surumine': { en: 'Bench Press', et: 'Lamades surumine', ru: 'Жим лежа' },
  'Jalapress masinal': { en: 'Machine Leg Press', et: 'Jalapress masinal', ru: 'Жим ногами в тренажере' },
  'Jooksulindil kõnd/jooks': { en: 'Treadmill Run', et: 'Jooksulindil kõnd/jooks', ru: 'Беговая дорожка' },
  'Concept2 sõudeergomeeter': { en: 'Concept2 Rowing', et: 'Concept2 sõudeergomeeter', ru: 'Гребной тренажер Concept2' },
  // Russian keys mapping
  'Приседания со штангой': { en: 'Barbell Back Squat', et: 'Kangiga kükk turjal', ru: 'Приседания со штангой' },
  'Жим лежа': { en: 'Bench Press', et: 'Lamades surumine', ru: 'Жим лежа' },
  'Жим ногами в тренажере': { en: 'Machine Leg Press', et: 'Jalapress masinal', ru: 'Жим ногами в тренажере' },
  'Беговая дорожка': { en: 'Treadmill Run', et: 'Jooksulindil kõnd/jooks', ru: 'Беговая дорожка' },
  'Гребной тренажер Concept2': { en: 'Concept2 Rowing', et: 'Concept2 sõudeergomeeter', ru: 'Гребной тренажер Concept2' }
};

export const translateExerciseName = (name: string | undefined, lang: Language): string => {
  if (!name) return '';
  const trimmed = name.trim();
  if (EXERCISE_NAME_TRANSLATIONS[trimmed] && EXERCISE_NAME_TRANSLATIONS[trimmed][lang]) {
    return EXERCISE_NAME_TRANSLATIONS[trimmed][lang];
  }
  const lower = trimmed.toLowerCase();
  const keys = Object.keys(EXERCISE_NAME_TRANSLATIONS);
  for (const k of keys) {
    if (k.toLowerCase() === lower && EXERCISE_NAME_TRANSLATIONS[k][lang]) {
      return EXERCISE_NAME_TRANSLATIONS[k][lang];
    }
  }
  return name;
};

export const getEnglishExerciseName = (name: string | undefined): string => {
  if (!name) return 'Exercise';
  const trimmed = name.trim();
  if (EXERCISE_NAME_TRANSLATIONS[trimmed] && EXERCISE_NAME_TRANSLATIONS[trimmed]['en']) {
    return EXERCISE_NAME_TRANSLATIONS[trimmed]['en'];
  }
  const lower = trimmed.toLowerCase();
  for (const k of Object.keys(EXERCISE_NAME_TRANSLATIONS)) {
    if (k.toLowerCase() === lower && EXERCISE_NAME_TRANSLATIONS[k]['en']) {
      return EXERCISE_NAME_TRANSLATIONS[k]['en'];
    }
  }
  return name;
};

export const translateDayName = (dayName: string | undefined, dayIndex: number, lang: Language): string => {
  const t = translations[lang] || translations.en;
  if (!dayName) return `${t.day} ${dayIndex + 1}`;
  const dayMatch = dayName.match(/(?:Päev|Day|День|Workout|Treening|Тренировка)\s*(\d+)(.*)/i);
  if (dayMatch) {
    const num = dayMatch[1];
    const rest = dayMatch[2].trim();
    if (rest && rest !== ':') {
      const cleanRest = rest.startsWith(':') ? rest.substring(1).trim() : rest;
      return `${t.day} ${num}${cleanRest ? `: ${cleanRest}` : ''}`;
    }
    return `${t.day} ${num}`;
  }
  return dayName;
};