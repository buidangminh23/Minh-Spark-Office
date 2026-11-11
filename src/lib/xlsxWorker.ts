import { readSpreadsheet, writeWorkbookXlsx } from './xlsxCodec';
import type { CodecRequest, CodecResponse } from './xlsxCodecProtocol';

type WorkerScope = {
  onmessage: ((event: MessageEvent<CodecRequest>) => void) | null;
  postMessage: (message: CodecResponse, transfer?: Transferable[]) => void;
};

const scope = self as unknown as WorkerScope;

scope.onmessage = async (event) => {
  const request = event.data;
  try {
    if (request.op === 'read') {
      scope.postMessage({ id: request.id, ok: true, result: await readSpreadsheet(request.buffer, request.fileName) });
      return;
    }
    const buffer = await writeWorkbookXlsx(request.workbook);
    scope.postMessage({ id: request.id, ok: true, result: buffer }, [buffer]);
  } catch (error) {
    scope.postMessage({ id: request.id, ok: false, message: error instanceof Error ? error.message : String(error) });
  }
};
