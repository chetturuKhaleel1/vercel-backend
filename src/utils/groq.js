// server/src/utils/groq.js
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/**
 * TEXT only (LLaMA 3.3 Groq)
 */
export async function groqText(prompt) {
  try {
    const res = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    });

    return res.choices?.[0]?.message?.content || "";
  } catch (err) {
    console.error("GroqText Error:", err.message);
    return "";
  }
}

export default groq;
