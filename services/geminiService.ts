import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AiSuggestion } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const exerciseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    exercises: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Name of the exercise" },
          sets: { type: Type.INTEGER, description: "Number of sets" },
          reps: { type: Type.STRING, description: "Rep range, e.g., '8-12' or '30s'" },
          targetMuscle: { type: Type.STRING, description: "Primary muscle group targeted" },
          notes: { type: Type.STRING, description: "Short form tip or cue" },
        },
        required: ["name", "sets", "reps", "targetMuscle", "notes"],
      },
    },
  },
  required: ["exercises"],
};

export const generateExercisesForEquipment = async (
  equipmentName: string,
  goal: string = "general fitness"
): Promise<AiSuggestion[]> => {
  try {
    const prompt = `Suggest 3 effective exercises using the following equipment: ${equipmentName}. The user's goal is: ${goal}.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: exerciseSchema,
        systemInstruction: "You are an expert fitness coach. Provide clear, concise exercise recommendations.",
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
  exercises: { name: string; targetMuscle: string }[]
): Promise<string> => {
  try {
    const exerciseList = exercises.map(e => `${e.name} (${e.targetMuscle})`).join(", ");
    const prompt = `Analyze this workout program: ${exerciseList}. Give a short 2-sentence summary of what it's good for and what might be missing.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        // Simple text response for this one
        maxOutputTokens: 200,
      },
    });

    return response.text || "Could not analyze program.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Error analyzing program.";
  }
};
