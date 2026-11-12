import { useRef, useState } from 'react';
import { Globe, Loader2, Search } from 'lucide-react';
import { useDoc } from '../DocContext';
import Modal from './Modal';
import { credit, parseResults, searchUrl, type OnlinePicture } from '../onlinePictures';

const toDataUrl = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(String(response.status));
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
};

export default function OnlinePicturesDialog({ onClose }: { onClose: () => void }) {
  const ctx = useDoc();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<OnlinePicture[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [inserting, setInserting] = useState<string | null>(null);
  const searched = useRef('');

  const search = async (more = false) => {
    const term = more ? searched.current : query.trim();
    if (!term) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(searchUrl(term, more ? next ?? 0 : 0));
      if (!response.ok) throw new Error(String(response.status));
      const result = parseResults(await response.json());
      searched.current = term;
      setItems(more ? [...items, ...result.items] : result.items);
      setNext(result.next);
      if (!more && !result.items.length) setError('Không tìm thấy ảnh phù hợp. Thử từ khoá tiếng Anh hoặc từ khác.');
    } catch {
      setError('Không kết nối được thư viện ảnh. Kiểm tra mạng rồi thử lại.');
    } finally {
      setBusy(false);
    }
  };

  const insert = async (picture: OnlinePicture) => {
    setInserting(picture.thumb);
    let src = picture.full;
    try {
      src = await toDataUrl(picture.full);
    } catch {
      src = picture.full;
    }
    ctx.editor.chain().focus().setImage({ src, alt: credit(picture) }).run();
    ctx.ui.toast('Đã chèn ảnh. Thông tin tác giả và giấy phép nằm trong mô tả ảnh');
    onClose();
  };

  return (
    <Modal title="Ảnh trực tuyến" subtitle="Ảnh giấy phép tự do từ Wikimedia Commons. Ghi công tác giả theo giấy phép khi dùng." icon={<Globe size={20} />} onClose={onClose} width={820}
      actions={<>{next !== null && items.length > 0 && <button className="btn" disabled={busy} onClick={() => void search(true)}>Xem thêm</button>}<button className="btn" onClick={onClose}>Đóng</button></>}>
      <form className="online-search" onSubmit={(e) => { e.preventDefault(); void search(); }}>
        <input className="text-field" autoFocus placeholder="Ví dụ: Ha Long Bay, lotus, office" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Từ khoá tìm ảnh" />
        <button className="btn btn-primary" type="submit" disabled={busy || !query.trim()}>{busy ? <Loader2 size={14} className="spin" /> : <Search size={14} />} Tìm</button>
      </form>
      {error && <div className="form-error">{error}</div>}
      <div className="online-grid">
        {items.map((picture) => (
          <button key={picture.thumb} type="button" className="online-item" title={credit(picture)} disabled={inserting !== null} onClick={() => void insert(picture)}>
            <img src={picture.thumb} alt={picture.title} loading="lazy" />
            <span className="online-meta">{inserting === picture.thumb ? 'Đang chèn…' : picture.license || picture.title}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
