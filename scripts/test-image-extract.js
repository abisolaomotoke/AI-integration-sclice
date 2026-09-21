require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const SYSTEM_PROMPT = `You transcribe and structure handwritten notes from images.
Read the handwriting carefully, including cross-outs and margin notes.
Extract:
- a short title summarizing the page's topic
- the main points as bullet points, in the order they appear
- any action items (tasks, to-dos, "must", "need to") as a separate list
- any dates mentioned, in the format they appear in the note

If the handwriting is illegible in places, note that in the relevant bullet
point rather than guessing at words you cannot make out. Do not invent
content that is not on the page.

Respond with ONLY valid JSON matching this exact shape, no other text:
{ "title": string, "bulletPoints": string[], "actionItems": string[], "datesMentioned": string[] }`;

async function testImageExtraction() {
  const apiKey = process.env.GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(apiKey);
  const imagePath = path.join(process.cwd(), 'public/uploads/cmu8b700u000028i1mpxt3dq4/051c85bd-5b00-41e4-8431-76d8e2e792b8.jpg');
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');

  const model = genAI.getGenerativeModel({
    model: "gemini-3.6-flash",
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
    },
  });

  const startTime = Date.now();
  const res = await model.generateContent([
    SYSTEM_PROMPT,
    {
      inlineData: {
        mimeType: "image/jpeg",
        data: base64Image,
      },
    },
  ]);
  const duration = Date.now() - startTime;
  console.log(`Success in ${duration}ms!`);
  console.log("Usage:", res.response.usageMetadata);
  console.log("Text:", res.response.text());
}

testImageExtraction().catch(console.error);
