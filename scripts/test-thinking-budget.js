require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testThinkingBudget() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  
  // Test with thinkingBudget in generationConfig
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-3.6-flash",
      generationConfig: {
        maxOutputTokens: 2000,
        responseMimeType: "application/json",
        // @ts-ignore
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
    const res = await model.generateContent("Respond with JSON: { \"hello\": \"world\" }");
    console.log("thinkingBudget 0 response:", res.response.text());
    console.log("usageMetadata:", res.response.usageMetadata);
  } catch (e) {
    console.log("thinkingBudget 0 failed:", e.message);
  }
}

testThinkingBudget().catch(console.error);
