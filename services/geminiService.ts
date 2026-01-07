
import { GoogleGenAI } from "@google/genai";

const MODEL_NAME = 'gemini-2.5-flash-image';

export async function editImage(base64Image: string, prompt: string, mimeType: string = 'image/png'): Promise<string> {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Please ensure it is configured correctly.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image.split(',')[1], // Strip the data:image/...;base64, prefix
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
