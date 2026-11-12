const pendingPrint = new Set<string>();

export const requestPrintOnOpen = (id: string) => {
  pendingPrint.add(id);
};

export const consumePrintOnOpen = (id: string) => pendingPrint.delete(id);
