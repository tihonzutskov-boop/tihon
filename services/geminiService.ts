import { AiDaySuggestion, Language, GymZone, Gym } from "../types";
import { API_BASE } from "./api";

// All Gemini calls are proxied through the backend so the API key never
// reaches the browser. See server/gemini.js for the actual model calls.

export const generateFullProgramFromPreferences = async (
  preferences: { goal: string; level: string; time: string; focus: string; frequency: string },
  zones: GymZone[],
  lang: Language = 'en'
): Promise<AiDaySuggestion[]> => {
  try {
    const response = await fetch(`${API_BASE}/gemini/full-program`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferences, zones, lang }),
    });
    if (!response.ok) throw new Error(`Status: ${response.status}`);
    const data = await response.json();
    return data.days || [];
  } catch (error) {
    console.error("Gemini Multi-Day Program Error:", error);
    return [];
  }
};

export const generateExercisesForEquipment = async (
  equipmentName: string,
  goal: string = "general fitness",
  lang: Language = 'en'
): Promise<any[]> => {
  try {
    const response = await fetch(`${API_BASE}/gemini/exercises-for-equipment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ equipmentName, goal, lang }),
    });
    if (!response.ok) throw new Error(`Status: ${response.status}`);
    const data = await response.json();
    return data.exercises || [];
  } catch (error) {
    console.error("Gemini API Error:", error);
    return [];
  }
};

export const generateProgramAnalysis = async (
  exercises: { name: string; targetMuscle: string }[],
  lang: Language = 'en'
): Promise<string> => {
  try {
    const response = await fetch(`${API_BASE}/gemini/program-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exercises, lang }),
    });
    if (!response.ok) throw new Error(`Status: ${response.status}`);
    const data = await response.json();
    return data.analysis || "Could not analyze program.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Error analyzing program.";
  }
};

export const parseFloorPlan = async (
  base64Data: string,
  fileType: string
): Promise<any> => {
  const response = await fetch(`${API_BASE}/gemini/parse-floor-plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Data, fileType }),
  });
  if (!response.ok) {
    throw new Error(`Gemini floor plan request failed: ${response.status}`);
  }
  return response.json();
};
