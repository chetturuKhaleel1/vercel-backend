// server/src/utils/openaiVision.js
import OpenAI from "openai";
import fs from "fs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Vision classifier using OpenAI Responses API
 */
export async function visionClassify(prompt, imageBase64) {
  try {
    const res = await openai.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "input_image",
              image: imageBase64,
              format: "base64",
            },
          ],
        },
      ],
    });

    return res.output_text || "";
  } catch (err) {
    console.error("Vision API Error:", err.message);
    return "";
  }
}
