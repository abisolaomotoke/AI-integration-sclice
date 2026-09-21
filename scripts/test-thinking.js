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

async function testWithTokens(maxTokens) {
  const apiKey = process.env.GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(apiKey);
  const imagePath = path.join(process.cwd(), 'public/uploads/cmu8b700u000028i1mpxt3dq4/051c85bd-5b00-41e4-8431-76d8e2e792b8.jpg');
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');

  const model = genAI.getGenerativeModel({
    model: "gemini-3.6-flash",
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: maxTokens,
      responseMimeType: "application/json",
    },
  });

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      console.log(`Testing maxOutputTokens=${maxTokens}, attempt ${attempt}...`);
      const result = await model.generateContent([
        SYSTEM_PROMPT,
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Image,
          },
        },
      ]);
      const response = result.response;
      console.log("finishReason:", response.candidates?.[0]?.finishReason);
      console.log("usageMetadata:", response.usageMetadata);
      const text = response.text();
      console.log("Response text length:", text.length);
      console.log("Response text:", text);
      const parsed = JSON.parse(text);
      console.log("Parsed successfully! Title:", parsed.title);
      return;
    } catch (err) {
      console.log(`Attempt ${attempt} error:`, err.message);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

testWithTokens(4000).catch(console.error);
