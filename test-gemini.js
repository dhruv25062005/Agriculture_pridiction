import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("❌ GEMINI_API_KEY is missing");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

const models = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
  "gemini-3.1-flash-lite-image",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3.8-flash",
  "gemini-flash-latest",
  "gemini-flash-lite-latest"
];

for (const model of models) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Testing: ${model}`);

  const start = Date.now();

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: 'Reply with ONLY this JSON: {"status":"success"}'
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 50
      }
    });

    console.log(`✅ SUCCESS in ${Date.now() - start} ms`);
    console.log(`Response: ${response.text}`);

  } catch (error) {
    console.log(`❌ FAILED in ${Date.now() - start} ms`);
    console.log(`Status: ${error?.status ?? "unknown"}`);
    console.log(`Message: ${error?.message ?? "unknown error"}`);
  }
}

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("Testing completed.");