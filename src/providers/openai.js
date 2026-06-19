export const DEFAULT_OPENAI_MODEL = 'gpt-5.5';

export function buildOpenAIResponsePayload({ model = DEFAULT_OPENAI_MODEL, prompt, systemInstruction = '', images = [], expectJson = false }) {
  const content = [{ type: 'input_text', text: prompt }];
  for (const image of images) {
    content.push({
      type: 'input_image',
      image_url: `data:${image.mimeType};base64,${image.data}`
    });
  }

  const payload = {
    model,
    input: [{ role: 'user', content }]
  };

  if (systemInstruction) {
    payload.instructions = systemInstruction;
  }

  if (expectJson) {
    payload.text = { format: { type: 'json_object' } };
  }

  return payload;
}

export function extractOpenAIText(result) {
  if (typeof result?.output_text === 'string') return result.output_text;
  const parts = result?.output?.flatMap((item) => item.content ?? []) ?? [];
  const textPart = parts.find((part) => part.type === 'output_text' && typeof part.text === 'string');
  return textPart?.text ?? '';
}

async function readOpenAIError(response) {
  const fallback = `OPENAI_HTTP_${response.status}`;
  try {
    const payload = await response.json();
    const error = payload?.error || {};
    const code = error.code || error.type || 'unknown';
    const message = error.message || response.statusText || 'OpenAI request failed';
    if (code === 'insufficient_quota') {
      return `OPENAI_QUOTA:${code}:${message}`;
    }
    return `${fallback}:${code}:${message}`;
  } catch {
    return `${fallback}:unknown:${response.statusText || 'OpenAI request failed'}`;
  }
}

export async function callOpenAI({ apiKey, model = DEFAULT_OPENAI_MODEL, prompt, systemInstruction, images, expectJson, fetchImpl = fetch }) {
  if (!apiKey) throw new Error('MISSING_OPENAI_KEY');
  const response = await fetchImpl('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(buildOpenAIResponsePayload({ model, prompt, systemInstruction, images, expectJson }))
  });

  if (!response.ok) {
    throw new Error(await readOpenAIError(response));
  }

  const result = await response.json();
  return extractOpenAIText(result);
}
