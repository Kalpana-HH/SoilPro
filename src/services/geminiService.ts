import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function analyzeSoilData(data: {
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  temperature: number;
  humidity: number;
  weather?: string;
  forecast?: string;
}) {
  try {
    const prompt = `
      As an expert agronomist, analyze the following soil and environmental data:
      - Nitrogen: ${data.nitrogen} mg/kg
      - Phosphorus: ${data.phosphorus} mg/kg
      - Potassium: ${data.potassium} mg/kg
      - Soil Temperature: ${data.temperature}°C
      - Soil Humidity: ${data.humidity}%
      - Current Weather: ${data.weather || 'Unknown'}
      - 3-Day Forecast: ${data.forecast || 'No forecast available'}

      Provide a concise, professional analysis (max 200 words) including:
      1. Overall soil health assessment.
      2. Specific crop recommendations that would thrive in these conditions.
      3. Tactical advice based on the weather forecast (e.g., "Move sensitive plants indoors due to upcoming frost", "Delay watering due to expected rain", "Increase irrigation for upcoming heatwave").
      4. Fertilizer or soil amendment advice.
      
      Format the response in clean markdown.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt,
    });

    return response.text || "No analysis generated.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Unable to perform AI analysis at this time. Please check your sensor connection.";
  }
}
