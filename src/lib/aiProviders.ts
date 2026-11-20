export type AiProviderId =
  | 'groq'
  | 'openrouter'
  | 'cerebras'
  | 'huggingface'
  | 'gemini'
  | 'openai';

interface ProviderSpec {
  id: AiProviderId;
  label: string;
  models: string[];
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

const PROVIDERS: Record<AiProviderId, ProviderSpec> = {
  groq: {
    id: 'groq',
    label: 'Groq Cloud',
    models: [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'openai/gpt-oss-120b',
      'qwen/qwen3-32b',
    ],
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    models: [
      'openrouter/free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'google/gemma-3-27b-it:free',
      'qwen/qwen3-32b:free',
    ],
  },
  cerebras: {
    id: 'cerebras',
    label: 'Cerebras',
    models: ['llama-3.3-70b', 'llama3.1-8b', 'qwen-3-32b'],
  },
  huggingface: {
    id: 'huggingface',
    label: 'Hugging Face',
    models: [
      'meta-llama/Llama-3.3-70B-Instruct',
      'Qwen/Qwen2.5-72B-Instruct',
      'google/gemma-2-27b-it',
    ],
  },
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    models: ['gemini-2.5-flash', 'gemini-2.0-flash'],
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    models: ['gpt-4o-mini', 'gpt-4.1-mini'],
  },
};

const STORAGE_KEY_SINGLE_API = 'smart_umkm_single_ai_key_v1';

export function detectProviderFromKey(apiKey: string): AiProviderId {
  const k = apiKey.trim();
  if (k.startsWith('gsk_')) return 'groq';
  if (k.startsWith('sk-or-')) return 'openrouter';
  if (k.startsWith('csk-')) return 'cerebras';
  if (k.startsWith('hf_')) return 'huggingface';
  if (k.startsWith('AIza')) return 'gemini';
  if (k.startsWith('sk-')) return 'openai';
  return 'groq';
}

export function getProviderLabel(apiKey: string): string {
  if (!apiKey.trim()) return 'Offline';
  return PROVIDERS[detectProviderFromKey(apiKey)].label;
}

export function loadSavedApiKey(): string {
  const envKey =
    (import.meta.env.VITE_GROQ_API_KEY as string | undefined)?.trim() ||
    (import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined)?.trim() ||
    (import.meta.env.VITE_CEREBRAS_API_KEY as string | undefined)?.trim() ||
    (import.meta.env.VITE_HF_API_KEY as string | undefined)?.trim() ||
    (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim() ||
    (import.meta.env.VITE_OPENAI_API_KEY as string | undefined)?.trim() ||
    '';

  try {
    return localStorage.getItem(STORAGE_KEY_SINGLE_API)?.trim() || envKey;
  } catch {
    return envKey;
  }
}

export function saveApiKeyToStorage(apiKey: string): void {
  try {
    const clean = apiKey.trim();
    if (clean) {
      localStorage.setItem(STORAGE_KEY_SINGLE_API, clean);
    } else {
      localStorage.removeItem(STORAGE_KEY_SINGLE_API);
    }
  } catch {
    // Abaikan jika localStorage dibatasi
  }
}

function getEndpoint(provider: Exclude<AiProviderId, 'gemini'>): string {
  switch (provider) {
    case 'groq':
      return 'https://api.groq.com/openai/v1/chat/completions';
    case 'openrouter':
      return 'https://openrouter.ai/api/v1/chat/completions';
    case 'cerebras':
      return 'https://api.cerebras.ai/v1/chat/completions';
    case 'huggingface':
      return 'https://router.huggingface.co/v1/chat/completions';
    case 'openai':
      return 'https://api.openai.com/v1/chat/completions';
  }
}

function parseErrorMessage(status: number, bodyText: string): string {
  try {
    const json = JSON.parse(bodyText) as {
      error?: { message?: string } | string;
      message?: string;
    };
    const msg =
      typeof json.error === 'string' ? json.error : json.error?.message || json.message;
    if (msg) return msg;
  } catch {
    // Gunakan potongan teks mentah
  }
  return `Error ${status}`;
}

function sanitizeReadableReply(raw: string): string {
  return raw
    .replace(/<think>[\s\S]*?<\/think>\s*/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/^\|[\s-:|]+\|$/gm, '')
    .replace(/^\|\s*(.+?)\s*\|$/gm, (_, rowContent: string) =>
      rowContent
        .split('|')
        .map((cell) => cell.trim())
        .filter(Boolean)
        .join(' — ')
    )
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function callOpenAiFormat(
  provider: Exclude<AiProviderId, 'gemini'>,
  apiKey: string,
  model: string,
  systemPrompt: string,
  history: ChatTurn[],
  userQuestion: string
): Promise<string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey.trim()}`,
  };

  if (provider === 'openrouter') {
    headers['HTTP-Referer'] =
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
    headers['X-Title'] = 'SmartUMKM';
  }

  const res = await fetch(getEndpoint(provider), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...history.slice(-4).map((h) => ({ role: h.role, content: h.content })),
        { role: 'user', content: userQuestion },
      ],
      temperature: 0.35,
      max_tokens: 900,
    }),
  });

  if (!res.ok) {
    const raw = await res.text();
    const err = new Error(parseErrorMessage(res.status, raw)) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Respons AI kosong');
  return sanitizeReadableReply(text);
}

async function callGeminiFormat(
  apiKey: string,
  model: string,
  systemPrompt: string,
  history: ChatTurn[],
  userQuestion: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [
        ...history.slice(-4).map((h) => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content }],
        })),
        { role: 'user', parts: [{ text: userQuestion }] },
      ],
      generationConfig: { temperature: 0.35, maxOutputTokens: 900 },
    }),
  });

  if (!res.ok) {
    const raw = await res.text();
    const err = new Error(parseErrorMessage(res.status, raw)) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error('Respons Gemini kosong');
  return sanitizeReadableReply(text);
}

export async function askSmartAi(params: {
  apiKey: string;
  systemPrompt: string;
  history: ChatTurn[];
  userQuestion: string;
}): Promise<{ reply: string; providerLabel: string }> {
  const cleanKey = params.apiKey.trim();
  const providerId = detectProviderFromKey(cleanKey);
  const spec = PROVIDERS[providerId];
  let lastError: Error = new Error('Gagal menghubungi server AI');

  for (const model of spec.models) {
    try {
      const reply =
        providerId === 'gemini'
          ? await callGeminiFormat(
              cleanKey,
              model,
              params.systemPrompt,
              params.history,
              params.userQuestion
            )
          : await callOpenAiFormat(
              providerId,
              cleanKey,
              model,
              params.systemPrompt,
              params.history,
              params.userQuestion
            );
      return { reply, providerLabel: spec.label };
    } catch (err) {
      const typedErr = err as Error & { status?: number };
      lastError = typedErr;
      if (typedErr.status === 401 || typedErr.status === 403) {
        throw new Error(`API Key ${spec.label} ditolak (${typedErr.message}).`);
      }
    }
  }

  throw lastError;
}