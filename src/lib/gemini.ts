import { GoogleGenerativeAI } from "@google/generative-ai";
import { loadEnvConfig } from "@next/env";

if (!process.env.GEMINI_API_KEY) {
  loadEnvConfig(process.cwd());
}

if (!process.env.GEMINI_API_KEY) {
  throw new Error(
    "GEMINI_API_KEY is not set. Add it to .env (see .env.example)."
  );
}

export const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
