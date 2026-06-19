export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export function buildGeminiPayload({ prompt, systemInstruction = '', images = [], expectJson = false }) {
  const parts = [{ text: prompt }];
  for (const image of images) {
    parts.push({
      inlineData: {
        mimeType: image.mimeType,
        data: image.data
      }
    });
  }

  const payload = {
    contents: [{ role: 'user', parts }]
  };

  if (systemInstruction) {
    payload.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  if (expectJson) {
    payload.generationConfig = { responseMimeType: 'application/json' };
  }

  return payload;
}

export function extractGeminiText(result) {
  return result?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

export async function callGemini({ apiKey, model = DEFAULT_GEMINI_MODEL, prompt, systemInstruction, images, expectJson, fetchImpl = fetch }) {
  if (!apiKey) throw new Error('MISSING_GEMINI_KEY');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildGeminiPayload({ prompt, systemInstruction, images, expectJson }))
  });

  if (!response.ok) {
    throw new Error(`GEMINI_HTTP_${response.status}`);
  }

  const result = await response.json();
  return extractGeminiText(result);
}
