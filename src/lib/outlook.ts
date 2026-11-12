import { isDesktop } from './desktop';

export type MailAttachment = { name: string; data: string };
export type OutgoingMail = { to: string; cc?: string; bcc?: string; subject: string; body: string; html: boolean; attachments?: MailAttachment[] };
export type OutlookMode = 'send' | 'draft' | 'display';

let status: Promise<boolean> | null = null;

export function outlookAvailable(): Promise<boolean> {
  if (!isDesktop() || !/Windows/i.test(navigator.userAgent)) return Promise.resolve(false);
  status ??= import('@tauri-apps/api/core')
    .then(({ invoke }) => invoke<boolean>('outlook_status'))
    .catch(() => false);
  return status;
}

export async function sendWithOutlook(messages: OutgoingMail[], mode: OutlookMode): Promise<number> {
  const { invoke } = await import('@tauri-apps/api/core');
  try {
    const result = await invoke<{ done: number }>('outlook_send', {
      messages: messages.map((message) => ({ cc: '', bcc: '', attachments: [], ...message })),
      mode,
    });
    return result.done;
  } catch (error) {
    throw new Error(typeof error === 'string' ? error : 'Không gửi được thư qua Microsoft Outlook.');
  }
}
