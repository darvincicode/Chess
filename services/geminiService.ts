import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODEL_ID } from "../constants";

export const getBestMove = async (fen: string, validMoves: string[]): Promise<string | null> => {
  if (!process.env.API_KEY) {
    console.warn("API_KEY missing. Returning random move.");
    return validMoves[Math.floor(Math.random() * validMoves.length)];
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
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
    return validMoves[Math.floor(Math.random() * validMoves.length)];
  }
};