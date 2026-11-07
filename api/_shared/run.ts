import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { CHATGPT_MODEL, CLAUDE_MODEL, MAX_OUTPUT_TOKENS, anthropicMessages, openAiInput, systemPrompt, type AddinRequest } from './addin.js';

const NAME = { claude: 'Claude', chatgpt: 'ChatGPT' } as const;

export class AddinProviderError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function describeFailure(request: AddinRequest, error: unknown): AddinProviderError {
  const name = NAME[request.provider];
  if (error instanceof AddinProviderError) return error;
  if (error instanceof Error && error.name === 'AbortError') return new AddinProviderError('Đã dừng.', 499);
  const status = typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number' ? error.status : 0;
  if (status === 401 || status === 403) return new AddinProviderError(`API key ${name} không hợp lệ hoặc không có quyền dùng model này.`, 401);
  if (status === 429) return new AddinProviderError(`${name} đang giới hạn tốc độ hoặc hết hạn mức của API key. Thử lại sau ít phút.`, 429);
  if (status === 413) return new AddinProviderError('Nội dung gửi đi quá lớn.', 413);
  if (status >= 500) return new AddinProviderError(`${name} đang gặp sự cố (${status}). Thử lại sau.`, 502);
  if (status === 0) return new AddinProviderError(`Không kết nối được tới ${name}. Kiểm tra mạng rồi thử lại.`, 502);
  const message = error instanceof Error ? error.message : String(error);
  return new AddinProviderError(`${name} báo lỗi ${status}: ${message}`, 502);
}

async function runClaude(request: AddinRequest, apiKey: string, onText: (chunk: string) => void, signal: AbortSignal, browser: boolean) {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: browser });
  const stream = client.beta.messages.stream({
    model: CLAUDE_MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium' },
    system: systemPrompt(request.provider, request.app, request.documentName),
    messages: anthropicMessages(request) as Anthropic.Beta.BetaMessageParam[],
  }, { signal });
  stream.on('text', onText);
  const message = await stream.finalMessage();
  if (message.stop_reason === 'refusal') onText('\n\n_Claude không xử lý yêu cầu này._');
  if (message.stop_reason === 'max_tokens') onText('\n\n_Câu trả lời dài quá giới hạn và đã bị cắt._');
}

async function runChatGpt(request: AddinRequest, apiKey: string, onText: (chunk: string) => void, signal: AbortSignal, browser: boolean) {
  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: browser });
  const stream = await client.responses.create({
    model: CHATGPT_MODEL,
    instructions: systemPrompt(request.provider, request.app, request.documentName),
    input: openAiInput(request) as OpenAI.Responses.ResponseInput,
    max_output_tokens: MAX_OUTPUT_TOKENS,
    stream: true,
  }, { signal });
  for await (const event of stream) {
    if (event.type === 'response.output_text.delta' || event.type === 'response.refusal.delta') onText(event.delta);
    else if (event.type === 'response.incomplete') onText('\n\n_Câu trả lời dài quá giới hạn và đã bị cắt._');
    else if (event.type === 'response.failed') throw new AddinProviderError(`ChatGPT không trả lời được: ${event.response.error?.message ?? 'lỗi không rõ'}`, 502);
    else if (event.type === 'error') throw new AddinProviderError(`ChatGPT báo lỗi: ${event.message}`, 502);
  }
}

export async function runProvider(request: AddinRequest, apiKey: string, onText: (chunk: string) => void, signal: AbortSignal, browser = false) {
  try {
    if (request.provider === 'claude') await runClaude(request, apiKey, onText, signal, browser);
    else await runChatGpt(request, apiKey, onText, signal, browser);
  } catch (error) {
    throw describeFailure(request, error);
  }
}
