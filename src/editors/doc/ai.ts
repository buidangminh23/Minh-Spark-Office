import { summarize } from './docTools';

export const loadClaude = async () => (await import('@anthropic-ai/sdk')).default;

export type AiAction = 'improve' | 'formal' | 'casual' | 'shorten' | 'expand' | 'summarize' | 'proofread' | 'continue' | 'outline' | 'custom';

export const AI_ACTIONS: { id: AiAction; label: string; instruction: string }[] = [
  { id: 'improve', label: 'Viết hay hơn', instruction: 'Rewrite the text so it reads more clearly and fluently. Keep the meaning and language.' },
  { id: 'formal', label: 'Trang trọng hơn', instruction: 'Rewrite the text in a formal, professional administrative tone. Keep the meaning and language.' },
  { id: 'casual', label: 'Thân thiện hơn', instruction: 'Rewrite the text in a warm, friendly tone. Keep the meaning and language.' },
  { id: 'shorten', label: 'Rút gọn', instruction: 'Shorten the text to about half its length while keeping every key point.' },
  { id: 'expand', label: 'Mở rộng', instruction: 'Expand the text with supporting detail and examples, staying consistent with what it already says.' },
  { id: 'summarize', label: 'Tóm tắt', instruction: 'Summarize the text as 3 to 6 concise bullet points.' },
  { id: 'proofread', label: 'Sửa chính tả & ngữ pháp', instruction: 'Correct spelling, grammar and punctuation. Change nothing else.' },
  { id: 'continue', label: 'Viết tiếp', instruction: 'Continue writing the text naturally for one or two paragraphs in the same style.' },
  { id: 'outline', label: 'Lập dàn ý', instruction: 'Produce a structured outline with numbered headings for a document about this text.' },
];

const SYSTEM_PROMPT = 'You are Minh AI, a writing assistant inside the Minh Docs word processor. Reply with the resulting text only, in the same language as the input unless asked otherwise. Use plain text with simple "-" bullets when a list is needed. Do not add introductions or explanations.';
const KEY_STORAGE = 'minh-docs-anthropic-key';
const MODEL = 'claude-opus-5-5';

export const getApiKey = () => {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
};

export const setApiKey = (value: string) => {
  try {
    if (value.trim()) localStorage.setItem(KEY_STORAGE, value.trim());
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    return;
  }
};

type BuiltinFactory = { availability?: () => Promise<string>; create: (options?: Record<string, unknown>) => Promise<Record<string, (...args: unknown[]) => Promise<string>>> };
const builtin = (name: string) => (globalThis as unknown as Record<string, BuiltinFactory | undefined>)[name];

async function builtinAvailable(name: string) {
  const api = builtin(name);
  if (!api) return false;
  try {
    return !api.availability || (await api.availability()) !== 'unavailable';
  } catch {
    return false;
  }
}

export async function describeProvider() {
  if (getApiKey()) return `Claude (${MODEL})`;
  if (await builtinAvailable('LanguageModel')) return 'AI tích hợp trong Chrome';
  return 'Tóm tắt cục bộ (chưa có API key)';
}

async function runClaude(instruction: string, text: string, onText: (chunk: string) => void, signal: AbortSignal) {
  const Anthropic = await loadClaude();
  const client = new Anthropic({ apiKey: getApiKey(), dangerouslyAllowBrowser: true });
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium' },
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `${instruction}\n\n<text>\n${text}\n</text>` }],
  }, { signal });
  stream.on('text', onText);
  const message = await stream.finalMessage();
  if (message.stop_reason === 'refusal') throw new Error('Claude từ chối xử lý nội dung này.');
  return message.content.map((block) => (block.type === 'text' ? block.text : '')).join('');
}

async function runBuiltin(instruction: string, text: string) {
  const model = await builtin('LanguageModel')!.create({ initialPrompts: [{ role: 'system', content: SYSTEM_PROMPT }] });
  return model.prompt(`${instruction}\n\n${text}`);
}

export async function runAi(action: AiAction, text: string, custom: string, onText: (chunk: string) => void, signal: AbortSignal) {
  const instruction = action === 'custom' ? custom : AI_ACTIONS.find((a) => a.id === action)?.instruction ?? custom;
  if (!text.trim() && action !== 'custom') throw new Error('Hãy chọn đoạn văn hoặc soạn nội dung trước.');
  if (getApiKey()) {
    try {
      return await runClaude(instruction, text, onText, signal);
    } catch (error) {
      const Anthropic = await loadClaude();
      if (error instanceof Anthropic.AuthenticationError) throw new Error('API key Claude không hợp lệ. Mở cài đặt Minh AI để nhập lại.');
      if (error instanceof Anthropic.RateLimitError) throw new Error('Claude đang giới hạn tốc độ, thử lại sau ít phút.');
      if (error instanceof Anthropic.APIConnectionError) throw new Error('Không kết nối được tới Claude. Kiểm tra mạng.');
      if (error instanceof Anthropic.APIError) throw new Error(`Claude báo lỗi ${error.status ?? ''}: ${error.message}`);
      throw error;
    }
  }
  if (await builtinAvailable('LanguageModel')) {
    const result = await runBuiltin(instruction, text);
    onText(result);
    return result;
  }
  if (action === 'summarize') {
    const result = summarize(text, 5).map((s) => `- ${s}`).join('\n');
    onText(result);
    return result;
  }
  throw new Error('Tính năng này cần API key Claude (hoặc Chrome có AI tích hợp). Bấm “Cài đặt” trong Minh AI để nhập key.');
}

export const LANGUAGES = [
  { code: 'en', label: 'Tiếng Anh' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'zh', label: 'Tiếng Trung' },
  { code: 'ja', label: 'Tiếng Nhật' },
  { code: 'ko', label: 'Tiếng Hàn' },
  { code: 'fr', label: 'Tiếng Pháp' },
  { code: 'de', label: 'Tiếng Đức' },
  { code: 'es', label: 'Tiếng Tây Ban Nha' },
  { code: 'ru', label: 'Tiếng Nga' },
  { code: 'th', label: 'Tiếng Thái' },
];

export async function translateText(text: string, target: string, onText: (chunk: string) => void, signal: AbortSignal) {
  const label = LANGUAGES.find((l) => l.code === target)?.label ?? target;
  if (getApiKey()) return runClaude(`Translate the text into ${label} (${target}). Preserve line breaks.`, text, onText, signal);
  const translator = builtin('Translator');
  if (translator) {
    const detector = builtin('LanguageDetector');
    let source = 'vi';
    if (detector) {
      const detected = (await (await detector.create()).detect(text)) as unknown as { detectedLanguage: string }[];
      source = detected[0]?.detectedLanguage ?? source;
    }
    const instance = await translator.create({ sourceLanguage: source, targetLanguage: target });
    const result = await instance.translate(text);
    onText(result);
    return result;
  }
  throw new Error('Cần API key Claude hoặc Chrome có Translator API để dịch ngay trong ứng dụng.');
}
