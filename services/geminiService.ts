
import { GoogleGenAI, Type } from "@google/genai";

const EDIT_MODEL_NAME = 'gemini-2.5-flash-image';
const SUGGEST_MODEL_NAME = 'gemini-3-flash-preview';

export async function editImage(base64Image: string, prompt: string, mimeType: string = 'image/png'): Promise<string> {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Please ensure it is configured correctly.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: EDIT_MODEL_NAME,
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image.split(',')[1],
              mimeType: mimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    });

    let imageUrl = '';
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const base64EncodeString: string = part.inlineData.data;
        imageUrl = `data:image/png;base64,${base64EncodeString}`;
        break;
      }
    }

    if (!imageUrl) {
      throw new Error("The model did not return an edited image. Try a different prompt.");
    }

    return imageUrl;
  } catch (error: any) {
    console.error("Gemini Edit Error:", error);
    throw new Error(error.message || "Failed to process image transformation.");
  }
}

export async function generateSuggestedPrompts(base64Image: string, mimeType: string = 'image/png') {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `Analyze this image and suggest 6 diverse, high-quality, and trending image editing prompts. 
  The prompts should describe a total transformation of the mood or style while ideally preserving the core subject. 
  Styles could include cinematic, retro, futuristic, artistic, fashion editorial, or high-end digital art.
  Return the suggestions as a JSON array.`;

  try {
    const response = await ai.models.generateContent({
      model: SUGGEST_MODEL_NAME,
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image.split(',')[1],
              mimeType: mimeType,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              label: { type: Type.STRING, description: "Short title of the style, e.g., 'Neon Cyberpunk'" },
              icon: { type: Type.STRING, description: "FontAwesome 6 icon class, e.g., 'fa-bolt' or 'fa-film'" },
              prompt: { type: Type.STRING, description: "Detailed instruction for the edit model" },
            },
            required: ["id", "label", "icon", "prompt"],
          },
        },
      },
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Failed to generate suggested prompts:", error);
    return [];
  }
}
