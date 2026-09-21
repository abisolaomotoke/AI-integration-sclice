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

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log('API Key present?', Boolean(apiKey), 'Key prefix:', apiKey?.slice(0, 8));
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const imagePath = path.join(process.cwd(), 'public/uploads/cmu8b700u000028i1mpxt3dq4/051c85bd-5b00-41e4-8431-76d8e2e792b8.jpg');
  console.log('Image path exists?', fs.existsSync(imagePath));
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');

  const model = genAI.getGenerativeModel({
    model: "gemini-3.6-flash",
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1000,
      responseMimeType: "application/json",
    },
  });

  console.log('Calling Gemini generateContent...');
  try {
    const result = await model.generateContent([
      SYSTEM_PROMPT,
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Image,
        },
      },
    ]);

    console.log('Response candidates:', JSON.stringify(result.response?.candidates, null, 2));
    console.log('Usage metadata:', JSON.stringify(result.response?.usageMetadata, null, 2));
    console.log('Prompt feedback:', JSON.stringify(result.response?.promptFeedback, null, 2));
    
    const rawText = result.response.text();
    console.log('--- RAW TEXT START ---');
    console.log(rawText);
    console.log('--- RAW TEXT END ---');
    console.log('Raw text length:', rawText.length);

    try {
      const parsed = JSON.parse(rawText);
      console.log('JSON parse succeeded!', parsed);
    } catch (parseErr) {
      console.error('JSON.parse failed:', parseErr.message);
      console.error('Char around 130:');
      console.error(rawText.slice(Math.max(0, 100), 160));
    }
  } catch (err) {
    console.error('Gemini call failed:', err);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
