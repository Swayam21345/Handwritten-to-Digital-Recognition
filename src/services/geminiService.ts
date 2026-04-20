import { GoogleGenAI, Type } from "@google/genai";
import { Prediction, RecognitionResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function recognizeHandwriting(imageData: string): Promise<RecognitionResult> {
  // Remove data:image/png;base64, prefix
  const base64Data = imageData.split(',')[1];
  
  const prompt = `Analyze this handwritten character or word. 
  Provide the recognized text and a list of top 3 most likely predictions with confidence scores (0-1).
  Also, identify roughly the center coordinates [x, y] (in px, assuming image size) of the most distinctive strokes that led to your conclusion.
  Return as JSON.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: "image/png",
            data: base64Data,
          },
        },
        {
          text: prompt,
        },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING },
          predictions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                char: { type: Type.STRING },
                confidence: { type: Type.NUMBER },
              },
              required: ["char", "confidence"]
            },
          },
          activationPoints: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
                intensity: { type: Type.NUMBER },
              }
            }
          }
        },
        required: ["text", "predictions"]
      },
    },
  });

  const result = JSON.parse(response.text || "{}");
  
  return {
    id: Math.random().toString(36).substr(2, 9),
    text: result.text || "",
    predictions: result.predictions || [],
    timestamp: Date.now(),
    imageUrl: imageData,
    // Store activation points to draw the heatmap later
    heatmapUrl: JSON.stringify(result.activationPoints || []),
  };
}
