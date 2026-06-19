import test from 'node:test';
import assert from 'node:assert/strict';

import { buildGeminiPayload, extractGeminiText } from '../src/providers/gemini.js';
import { buildOpenAIResponsePayload, callOpenAI, extractOpenAIText } from '../src/providers/openai.js';

const images = [
  { mimeType: 'image/jpeg', data: 'abc123' }
];

test('buildGeminiPayload includes text, images, system instruction, and JSON mode', () => {
  const payload = buildGeminiPayload({
    prompt: '生成标题',
    systemInstruction: '你是摄影主理人',
    images,
    expectJson: true
  });

  assert.equal(payload.contents[0].parts[0].text, '生成标题');
  assert.deepEqual(payload.contents[0].parts[1], {
    inlineData: { mimeType: 'image/jpeg', data: 'abc123' }
  });
  assert.equal(payload.systemInstruction.parts[0].text, '你是摄影主理人');
  assert.equal(payload.generationConfig.responseMimeType, 'application/json');
});

test('extractGeminiText reads the first output text', () => {
  const text = extractGeminiText({
    candidates: [{ content: { parts: [{ text: 'hello' }] } }]
  });

  assert.equal(text, 'hello');
});

test('buildOpenAIResponsePayload defaults to gpt-5.5 with text and image inputs', () => {
  const payload = buildOpenAIResponsePayload({
    prompt: '写文案',
    systemInstruction: '保持温柔',
    images,
    expectJson: true
  });

  assert.equal(payload.model, 'gpt-5.5');
  assert.equal(payload.instructions, '保持温柔');
  assert.equal(payload.input[0].content[0].type, 'input_text');
  assert.equal(payload.input[0].content[0].text, '写文案');
  assert.equal(payload.input[0].content[1].type, 'input_image');
  assert.equal(payload.input[0].content[1].image_url, 'data:image/jpeg;base64,abc123');
  assert.equal(payload.text.format.type, 'json_object');
});

test('extractOpenAIText reads output_text from response output', () => {
  const text = extractOpenAIText({
    output: [
      {
        type: 'message',
        content: [
          { type: 'output_text', text: '文案内容' }
        ]
      }
    ]
  });

  assert.equal(text, '文案内容');
});

test('callOpenAI preserves quota error details without labeling it as rate limit', async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 429,
    statusText: 'Too Many Requests',
    async json() {
      return {
        error: {
          code: 'insufficient_quota',
          message: 'You exceeded your current quota.'
        }
      };
    }
  });

  await assert.rejects(
    callOpenAI({
      apiKey: 'sk-test',
      prompt: 'hello',
      images: [],
      fetchImpl
    }),
    /OPENAI_QUOTA:insufficient_quota:You exceeded your current quota/
  );
});
