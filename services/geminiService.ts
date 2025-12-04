import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODEL_ID } from "../constants";

// Safe access to process.env for browser environments
const getApiKey = () => {
  try {
    // Check global scope first (browser polyfill)
    if (typeof window !== 'undefined' && (window as any).process?.env?.API_KEY) {
      return (window as any).process.env.API_KEY;
    }
    // Fallback to standard process.env if available
    return process.env.API_KEY;
  } catch (e) {
    console.warn("Could not access process.env:", e);
    return undefined;
  }
};

export const getBestMove = async (fen: string, validMoves: string[]): Promise<string | null> => {
  try {
    const apiKey = getApiKey();
    
    if (!apiKey) {
      console.warn("API_KEY missing. Returning random move.");
      return validMoves[Math.floor(Math.random() * validMoves.length)];
    }

    const ai = new GoogleGenAI({ apiKey: apiKey });
    
    // Using a system instruction to force strict behavior
    const prompt = `
      You are a Grandmaster Chess Engine. 
      The current board state is FEN: "${fen}".
      The valid moves for the current player are: ${validMoves.join(', ')}.
      
      Analyze the position and select the absolute best move from the list of valid moves provided.
      Respond ONLY with the move in SAN format (Standard Algebraic Notation). 
      Do not explain. Do not use quotes.
    `;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL_ID,
      contents: prompt,
      config: {
        temperature: 0.1, // Low temperature for deterministic/logical play
        maxOutputTokens: 10,
      }
    });

    const move = response.text?.trim();

    if (move && validMoves.includes(move)) {
      return move;
    }

    console.warn("Gemini returned invalid or unparseable move:", move);
    // Fallback to random if AI hallucinates or fails
    return validMoves[Math.floor(Math.random() * validMoves.length)];

  } catch (error) {
    console.error("Gemini API Error:", error);
    // CRITICAL: Always fallback to random move on error to keep game going
    return validMoves[Math.floor(Math.random() * validMoves.length)];
  }
};