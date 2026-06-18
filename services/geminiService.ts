import { GoogleGenAI, Type } from "@google/genai";
import { AiDaySuggestion, Language, GymZone } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Response schema for a single day of exercises
const exerciseItemSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "Name of the exercise" },
    sets: { type: Type.INTEGER, description: "Number of sets" },
    reps: { type: Type.STRING, description: "Rep range, e.g., '8-12' or '30s'" },
    targetMuscle: { type: Type.STRING, description: "Primary muscle group targeted" },
    notes: { type: Type.STRING, description: "Short form tip or cue" },
    equipmentId: { type: Type.STRING, description: "The ID of the zone to use" },
    machineId: { type: Type.STRING, description: "The ID of the specific machine to use (from the provided list)" },
    videoUrl: { type: Type.STRING, description: "A high-quality YouTube embed URL for this exercise, e.g. https://www.youtube.com/embed/XXXXX" },
  },
  required: ["name", "sets", "reps", "targetMuscle", "notes", "equipmentId", "videoUrl"],
};

// Response schema for multiple days
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
        required: ["dayName", "exercises"],
      },
    },
  },
  required: ["days"],
};

export const generateFullProgramFromPreferences = async (
  preferences: { goal: string; level: string; time: string; focus: string; frequency: string },
  zones: GymZone[],
  lang: Language = 'et'
): Promise<AiDaySuggestion[]> => {
  try {
    const langMap = { et: 'Estonian', en: 'English', ru: 'Russian' };
    const daysCount = preferences.frequency.replace('freq', '');
    
    const layoutContext = zones.map(z => 
      `Zone: ${z.name} (ID: ${z.id}) machines: ${z.machines?.map(m => `${m.name} (ID: ${m.id})`).join(", ") || 'General area'}`
    ).join("\n");

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
      3. Provide a valid YouTube embed URL for EVERY exercise in the videoUrl field.
      4. For each day, match the number of exercises to the session duration.
      5. All text fields (dayName, name, targetMuscle, notes) MUST be in ${langMap[lang]}.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: multiDaySchema,
        systemInstruction: `You are an expert fitness coach. Respond entirely in ${langMap[lang]}.`,
      },
    });

    const jsonText = response.text;
    if (!jsonText) return [];

    const parsed = JSON.parse(jsonText);
    return parsed.days || [];
  } catch (error) {
    console.error("Gemini Multi-Day Program Error:", error);
    return [];
  }
};

export const generateExercisesForEquipment = async (
  equipmentName: string,
  goal: string = "general fitness",
  lang: Language = 'et'
): Promise<any[]> => {
  try {
    const langMap = { et: 'Estonian', en: 'English', ru: 'Russian' };
    const prompt = `Suggest 3 effective exercises using the following equipment: ${equipmentName}. Provide a YouTube embed URL for each. The user's goal is: ${goal}. Provide all response fields in the ${langMap[lang]} language.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            exercises: {
              type: Type.ARRAY,
              items: exerciseItemSchema,
            }
          },
          required: ["exercises"]
        },
        systemInstruction: `You are an expert fitness coach. Respond entirely in ${langMap[lang]}.`,
      },
    });

    const jsonText = response.text;
    if (!jsonText) return [];

    const parsed = JSON.parse(jsonText);
    return parsed.exercises || [];
  } catch (error) {
    console.error("Gemini API Error:", error);
    return [];
  }
};

export const generateProgramAnalysis = async (
  exercises: { name: string; targetMuscle: string }[],
  lang: Language = 'et'
): Promise<string> => {
  try {
    const langMap = { et: 'Estonian', en: 'English', ru: 'Russian' };
    const exerciseList = exercises.map(e => `${e.name} (${e.targetMuscle})`).join(", ");
    const prompt = `Analyze this workout program: ${exerciseList}. Give a short 2-sentence summary of what it's good for and what might be missing. Provide the analysis in ${langMap[lang]}.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        maxOutputTokens: 200,
      },
    });

    return response.text || "Could not analyze program.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Error analyzing program.";
  }
};