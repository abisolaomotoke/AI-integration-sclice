require('dotenv').config();

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const data = await res.json();
  if (data.models) {
    console.log("Available models supporting generateContent:");
    for (const m of data.models) {
      if (m.supportedGenerationMethods?.includes("generateContent")) {
        console.log(m.name, m.displayName);
      }
    }
  } else {
    console.log("Response:", JSON.stringify(data, null, 2));
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
