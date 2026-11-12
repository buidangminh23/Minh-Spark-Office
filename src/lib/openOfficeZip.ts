export async function openOfficeZip(buffer: ArrayBuffer) {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(buffer);
  const files = Object.values(zip.files);
  if (files.length > 10_000) throw new Error('Tệp Office có quá nhiều thành phần.');
  let total = 0;
  for (const file of files) {
    const entry = file as unknown as { _data?: { uncompressedSize?: number } };
    total += entry._data?.uncompressedSize ?? 0;
    if (total > 200 * 1024 * 1024) throw new Error('Nội dung giải nén của tệp vượt giới hạn 200 MB.');
  }
  return zip;
}
