import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build'
    }
  }
});

const langMap = { et: 'Estonian', en: 'English', ru: 'Russian' };
const resolveLang = (lang) => langMap[lang] || langMap.en;

const exerciseItemSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: 'Name of the exercise' },
    sets: { type: Type.INTEGER, description: 'Number of sets' },
    reps: { type: Type.STRING, description: "Rep range, e.g., '8-12' or '30s'" },
    targetMuscle: { type: Type.STRING, description: 'Primary muscle group targeted' },
    notes: { type: Type.STRING, description: 'Short form tip or cue' },
    equipmentId: { type: Type.STRING, description: 'The ID of the zone to use' },
    machineId: { type: Type.STRING, description: 'The ID of the specific machine to use (from the provided list)' },
    videoUrl: { type: Type.STRING, description: 'A high-quality YouTube embed URL or YouTube Shorts link for this exercise, e.g. https://www.youtube.com/embed/ultWZbUMPL8' },
  },
  required: ['name', 'sets', 'reps', 'targetMuscle', 'notes', 'equipmentId', 'videoUrl'],
};

const multiDaySchema = {
  type: Type.OBJECT,
  properties: {
    days: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          dayName: { type: Type.STRING, description: "Descriptive name for the day, e.g. 'Day 1: Upper Body Focus'" },
          exercises: {
            type: Type.ARRAY,
            items: exerciseItemSchema,
          },
        },
        required: ['dayName', 'exercises'],
      },
    },
  },
  required: ['days'],
};

export const generateFullProgramFromPreferences = async (preferences, zones, lang = 'en') => {
  try {
    const daysCount = preferences.frequency.replace('freq', '');

    const layoutContext = zones.map(z =>
      `Zone: ${z.name} (ID: ${z.id}) machines: ${z.machines?.map(m => `${m.name} (ID: ${m.id})`).join(', ') || 'General area'}`
    ).join('\n');

    const prompt = `
      Act as a world-class fitness coach. Build a complete multi-day weekly workout split for a user:
      - Weekly Frequency: ${daysCount} days per week
      - Overall Goal: ${preferences.goal}
      - Experience Level: ${preferences.level}
      - Session Duration: ${preferences.time}
      - Preferred Focus: ${preferences.focus}

      The gym has the following available zones and specific machines:
      ${layoutContext}

      Rules:
      1. Create a logical weekly split based on ${daysCount} days.
      2. Match exercises to specific machine IDs provided above. If an exercise is best for a zone (like Turf) but no machine exists, leave machineId blank.
      3. Provide a valid YouTube embed URL or YouTube Shorts embed URL for EVERY exercise in the videoUrl field (e.g. https://www.youtube.com/embed/ultWZbUMPL8).
      4. For each day, match the number of exercises to the session duration.
      5. All text fields (dayName, name, targetMuscle, notes) MUST be in ${resolveLang(lang)}.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: multiDaySchema,
        systemInstruction: `You are an expert fitness coach. Respond entirely in ${resolveLang(lang)}.`,
      },
    });

    const jsonText = response.text;
    if (!jsonText) return [];

    const parsed = JSON.parse(jsonText);
    return parsed.days || [];
  } catch (error) {
    console.error('Gemini Multi-Day Program Error:', error);
    return [];
  }
};

export const generateExercisesForEquipment = async (equipmentName, goal = 'general fitness', lang = 'en') => {
  try {
    const prompt = `Suggest 3 effective exercises using the following equipment: ${equipmentName}. Provide a YouTube Shorts embed URL for each. The user's goal is: ${goal}. Provide all response fields in the ${resolveLang(lang)} language.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            exercises: {
              type: Type.ARRAY,
              items: exerciseItemSchema,
            }
          },
          required: ['exercises']
        },
        systemInstruction: `You are an expert fitness coach. Respond entirely in ${resolveLang(lang)}.`,
      },
    });

    const jsonText = response.text;
    if (!jsonText) return [];

    const parsed = JSON.parse(jsonText);
    return parsed.exercises || [];
  } catch (error) {
    console.error('Gemini API Error:', error);
    return [];
  }
};

export const generateProgramAnalysis = async (exercises, lang = 'en') => {
  try {
    const exerciseList = exercises.map(e => `${e.name} (${e.targetMuscle})`).join(', ');
    const prompt = `Analyze this workout program: ${exerciseList}. Give a short 2-sentence summary of what it's good for and what might be missing. Provide the analysis in ${resolveLang(lang)}.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        maxOutputTokens: 200,
      },
    });

    return response.text || 'Could not analyze program.';
  } catch (error) {
    console.error('Gemini Analysis Error:', error);
    return 'Error analyzing program.';
  }
};

const floorPlanSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: 'Suggested name for the gym' },
    dimensions: {
      type: Type.OBJECT,
      properties: {
        width: { type: Type.INTEGER, description: 'Suggested width of the main gym hall in pixels, between 600 and 1000 pixels (e.g., 780).' },
        height: { type: Type.INTEGER, description: 'Suggested height of the main gym hall in pixels, between 400 and 850 pixels (e.g., 580).' },
        walls: {
          type: Type.ARRAY,
          description: 'List of architectural wall/boundary segments detected in the gym floor plan layout.',
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING, description: "Unique wall ID, e.g., 'wall-1'." },
              type: { type: Type.STRING, description: "Style of wall: 'straight' or 'curved'." },
              wallType: { type: Type.STRING, description: "Type of wall/element: 'exterior', 'interior', 'window', 'door', 'corridor', 'staircase', 'elevator'." },
              x1: { type: Type.INTEGER, description: 'X coordinate of the starting point (0 to width).' },
              y1: { type: Type.INTEGER, description: 'Y coordinate of the starting point (0 to height).' },
              x2: { type: Type.INTEGER, description: 'X coordinate of the ending point (0 to width).' },
              y2: { type: Type.INTEGER, description: 'Y coordinate of the ending point (0 to height).' },
              controlX: { type: Type.INTEGER, description: "X coordinate of quadratic Bezier control point, only if type is 'curved'." },
              controlY: { type: Type.INTEGER, description: "Y coordinate of quadratic Bezier control point, only if type is 'curved'." },
              thickness: { type: Type.INTEGER, description: 'Thickness of the wall line (typically 4-12 pixels).' },
              confidence: { type: Type.STRING, description: "Detection confidence: 'high' or 'low' (use 'low' for unclear, faint or estimated parts)." }
            },
            required: ['id', 'type', 'wallType', 'x1', 'y1', 'x2', 'y2']
          }
        }
      },
      required: ['width', 'height']
    },
    entrance: {
      type: Type.OBJECT,
      properties: {
        side: { type: Type.STRING, description: "Entrance side ('top', 'bottom', 'left', or 'right')" },
        offset: { type: Type.INTEGER, description: 'Offset from start in pixels (must be inside main hall bounds)' },
        width: { type: Type.INTEGER, description: 'Entrance doorway width in pixels (typically 80)' }
      },
      required: ['side', 'offset', 'width']
    },
    zones: {
      type: Type.ARRAY,
      description: 'List of identified training zones or sections in the gym layout',
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Name of the zone/room (e.g., 'Cardio Zone', 'Reception', 'Lobby', 'Gym Floor', 'Group Fitness Studio', 'Changing Rooms', 'Showers', 'Toilets', 'Sauna', 'Pool', 'Office', 'Storage', 'Café')" },
          type: { type: Type.STRING, description: "The category matching EquipmentType (e.g., 'Cardio', 'Free Weights', 'Machine', 'Power Rack', 'Functional', 'Corridor', 'Facility', 'Reception', 'Lobby', 'Gym Floor', 'Group Fitness Studio', 'Changing Rooms', 'Showers', 'Toilets', 'Sauna', 'Pool', 'Office', 'Storage', 'Café')" },
          x: { type: Type.INTEGER, description: 'X position in pixels relative to the main hall' },
          y: { type: Type.INTEGER, description: 'Y position in pixels relative to the main hall' },
          width: { type: Type.INTEGER, description: 'Zone width in pixels (must be smaller than main hall)' },
          height: { type: Type.INTEGER, description: 'Zone height in pixels (must be smaller than main hall)' },
          color: { type: Type.STRING, description: 'Visual representation pastel color hex code' },
          icon: { type: Type.STRING, description: "Lucide icon name (e.g., 'Dumbbell', 'Activity', 'Zap', 'Target', 'Cpu', 'Layers', 'Box', 'Wind', 'RotateCcw', 'Circle', 'Waves')" },
          description: { type: Type.STRING, description: 'Brief description of the zone purpose' },
          machines: {
            type: Type.ARRAY,
            description: 'List of equipment pieces inside this zone',
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: "Name of the machine, e.g. 'Treadmill 1'" },
                x: { type: Type.INTEGER, description: "X relative to the zone's top-left corner (0 to zone width)" },
                y: { type: Type.INTEGER, description: "Y relative to the zone's top-left corner (0 to zone height)" },
                width: { type: Type.INTEGER, description: 'Width in pixels (typically 30-60)' },
                height: { type: Type.INTEGER, description: 'Height in pixels (typically 30-60)' },
                icon: { type: Type.STRING, description: "Lucide icon name (e.g. 'Dumbbell', 'Activity', 'Zap')" },
                longDescription: { type: Type.STRING, description: 'Usage or setup tips' },
                status: { type: Type.STRING, description: "Default status ('active' or 'maintenance')" }
              },
              required: ['name', 'x', 'y', 'width', 'height', 'icon']
            }
          }
        },
        required: ['name', 'type', 'x', 'y', 'width', 'height', 'color', 'icon']
      }
    },
    annexes: {
      type: Type.ARRAY,
      description: 'Any rectangular side rooms attached to the main hall',
      items: {
        type: Type.OBJECT,
        properties: {
          x: { type: Type.INTEGER, description: 'X offset from main hall top-left' },
          y: { type: Type.INTEGER, description: 'Y offset from main hall top-left' },
          width: { type: Type.INTEGER, description: 'Annex room width in pixels' },
          height: { type: Type.INTEGER, description: 'Annex room height in pixels' }
        },
        required: ['x', 'y', 'width', 'height']
      }
    }
  },
  required: ['name', 'dimensions', 'entrance', 'zones']
};

export const parseFloorPlan = async (base64Data, fileType) => {
  const prompt = `
    You are an expert architect and gym layout planner. Analyze the uploaded floor plan drawing (which can be a PDF or an image) to recreate a highly detailed, editable digital version of it.

    Perform detailed visual analysis and OCR text detection:
    1. CRITICAL - OCR Room Detection: Scan the uploaded drawing for all readable labels and room names. Map them exactly as zones of matching EquipmentType. If you see text labels like:
       - "Reception" / "Front Desk" / "Entrance Area" -> Create a zone with type "Reception" and name "Reception".
       - "Lobby" / "Waiting Area" / "Lounge" -> Create a zone with type "Lobby" and name "Lobby".
       - "Gym Floor" / "Main Hall" / "Workout Area" / "Strength Area" -> Create a zone with type "Gym Floor" and name "Gym Floor".
       - "Studio" / "Group Class" / "Yoga" / "Spinning" -> Create a zone with type "Group Fitness Studio" and name "Group Fitness Studio".
       - "Changing Rooms" / "Locker Room" / "Lockers" / "Mens Changing" / "Womens Changing" -> Create a zone with type "Changing Rooms" and name "Changing Rooms".
       - "Showers" -> Create a zone with type "Showers" and name "Showers".
       - "Toilets" / "WC" / "Restrooms" -> Create a zone with type "Toilets" and name "Toilets".
       - "Sauna" -> Create a zone with type "Sauna" and name "Sauna".
       - "Pool" / "Swimming" / "Spa" -> Create a zone with type "Pool" and name "Pool".
       - "Office" / "Staff" / "Admin" -> Create a zone with type "Office" and name "Office".
       - "Storage" / "Utility" / "Janitor" -> Create a zone with type "Storage" and name "Storage".
       - "Café" / "Juice Bar" / "Kitchen" -> Create a zone with type "Café" and name "Café".
       - Any other labeled room should be created as a zone with a matching custom name, preserving original text names.

    2. Detailed Wall & Barrier Structure:
       - Trace ALL exterior building borders and interior room-dividing wall segments with high precision.
       - For any visible staircases, draw wall segments with wallType: "staircase".
       - For any visible elevators, draw wall segments with wallType: "elevator".
       - Windows should be wallType: "window".
       - Openings, doors, and doorways should be wallType: "door".
       - Traced corridors, passageways, and hallways should be wallType: "corridor".
       - For curved or rounded walls, set type: "curved" and specify quadratic Bezier "controlX" and "controlY" coordinates.

    3. Training Zones & Equipment:
       - Identify gym/workout areas (Cardio, Free Weights, Machine, Power Rack, Functional, etc.) and create matching zones.
       - Locate individual machines/equipment visible in the drawing and place them as machines in their respective zones (using x,y coordinates relative to their parent zone's top-left corner).

    Keep inside these coordinate rules:
    - Main room dimensions: suggested width (600-1000px) and height (400-850px) at a scale of 10px = 1m.
    - All wall coordinates (x1, y1, x2, y2) MUST fit within the main room boundaries.
    - Place the main entrance door accurately on one of the outer walls with correct side and offset.
    - Generate realistic pastel color codes for each room type and map appropriate lucide icon names.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3.5-flash',
    contents: [
      {
        inlineData: {
          mimeType: fileType,
          data: base64Data,
        },
      },
      prompt,
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: floorPlanSchema,
      systemInstruction: 'You are a professional AI gym designer. You output high-quality, perfectly matching JSON gym configurations based on floor plan images/PDFs.',
    },
  });

  const jsonText = response.text;
  if (!jsonText) {
    throw new Error('No response content from Gemini.');
  }

  return JSON.parse(jsonText);
};
