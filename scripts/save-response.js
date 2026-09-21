require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function run() {
  const apiKey = process.env.GEMINI_API_KEY;
  const imagePath = path.join(process.cwd(), 'public/uploads/cmu8b700u000028i1mpxt3dq4/051c85bd-5b00-41e4-8431-76d8e2e792b8.jpg');
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');

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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
  const body = {
    contents: [
      {
        parts: [
          { text: SYSTEM_PROMPT },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1000,
      responseMimeType: "application/json"
    }
  };

  for (let attempt = 1; attempt <= 5; attempt++) {
    console.log(`Attempt ${attempt}...`);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const json = await res.json();
    if (res.status === 200) {
      fs.writeFileSync('scripts/last-response.json', JSON.stringify(json, null, 2));
      console.log('Success! Saved to scripts/last-response.json');
      return;
    } else {
      console.log(`Status ${res.status}:`, json.error?.message);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

run().catch(console.error);
