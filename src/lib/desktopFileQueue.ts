export type DesktopFile = { name: string; id: number };
export type DesktopFileBatch = { files: DesktopFile[]; errors: string[]; hasMore: boolean };

type QueueOptions = {
  isEditing: () => boolean;
  drain: () => Promise<DesktopFileBatch>;
  read: (file: DesktopFile) => Promise<ArrayBuffer>;
  open: (file: File) => Promise<boolean>;
  notify: (message: string, error?: boolean) => void;
};

export function createDesktopFileQueue(options: QueueOptions) {
  let alive = true;
  let running: Promise<void> | null = null;
  let requested = false;
  let hasMore = false;
  const pending: Array<{ file: DesktopFile; bytes?: ArrayBuffer }> = [];

  const run = async () => {
    while (alive && !options.isEditing()) {
      if (!pending.length) {
        requested = false;
        const batch = await options.drain();
        if (!alive) return;
        for (const error of batch.errors) options.notify(error, true);
        pending.push(...batch.files.map((file) => ({ file })));
        hasMore = batch.hasMore;
      }
      if (options.isEditing()) return;
      const next = pending[0];
      if (next) {
        try {
          next.bytes ??= await options.read(next.file);
        } catch (error) {
          if (!alive) return;
          pending.shift();
          options.notify(typeof error === 'string' ? error : 'Không đọc được nội dung tệp.', true);
          continue;
        }
        if (!alive || options.isEditing()) return;
        pending.shift();
        try {
          await options.open(new File([next.bytes], next.file.name));
        } catch (error) {
          if (alive) options.notify(error instanceof Error ? error.message : 'Không thể mở tệp này', true);
        }
        if (!alive) return;
      }
      if (!hasMore && !pending.length && !requested) return;
    }
  };

  const request = (notify = false): Promise<void> => {
    if (!alive) return Promise.resolve();
    requested = true;
    if (options.isEditing()) {
      if (notify) options.notify('Đã nhận tệp. Tệp sẽ mở sau khi thao tác hiện tại hoàn tất.');
      return running ?? Promise.resolve();
    }
    if (running) return running;
    running = run().catch(() => {
      if (alive) options.notify('Chưa mở được tệp từ hệ điều hành. Có thể dùng nút Mở tệp từ máy để thử lại.', true);
    }).finally(() => {
      running = null;
      if (alive && requested && !options.isEditing()) void request();
    });
    return running;
  };

  return {
    request,
    resume() {
      return request();
    },
    stop() { alive = false; },
  };
}
