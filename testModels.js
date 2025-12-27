import Groq from "groq-sdk";
import dotenv from "dotenv";
dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const listModels = async () => {
  try {
    const models = await groq.models.list();
    console.log("Available Models:", models.data.map(m => m.id));
  } catch (err) {
    console.error(err);
  }
};

listModels();
