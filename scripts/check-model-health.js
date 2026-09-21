require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testModelAvailability() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const models = [
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.8-flash",
    "gemini-2.5-flash-lite",
    "gemini-flash-latest"
  ];

  for (const m of models) {
    try {
      const model = genAI.getGenerativeModel({ model: m });
      const res = await model.generateContent("Say ok");
      console.log(`${m}: OK -> ${res.response.text().trim()}`);
    } catch (e) {
      console.log(`${m}: FAILED -> ${e.message.slice(0, 150)}`);
    }
  }
}

testModelAvailability().catch(console.error);
