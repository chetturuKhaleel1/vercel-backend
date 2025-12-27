import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY, // auto detects if ENV is set
});

export async function generateFlashcards({ notes, transcript }) {
  try {
    const prompt = `
You are an educational expert.
Generate flashcards in STRICT JSON format:

[
  {
    "front": "",
    "back": "",
    "hints": [],
    "difficulty": "",
    "tags": []
  }
]

Use BOTH notes and transcript.
Do NOT include markdown, backticks, or explanation.

---
NOTES:
${notes}

TRANSCRIPT:
${transcript}
---
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    let text = response.text;
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    return JSON.parse(text);

  } catch (err) {
    console.error("Flashcard Generation Error:", err);
    return [];
  }
}
