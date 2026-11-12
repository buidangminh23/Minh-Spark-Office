import { useEffect, useState } from 'react';
import { CheckCircle2, CloudOff, Eye, Loader2, Radio, Wifi } from 'lucide-react';
import type { LivePeer, MeshStatus } from '../../lib/live/peerMesh';
import type { SaveState } from '../../lib/live/liveDoc';
import { PersonAvatar } from './TeamParts';
import './teams.css';

const STATUS_TEXT: Record<MeshStatus, string> = {
  alone: 'Chỉ mình bạn đang mở',
  connecting: 'Đang kết nối với mọi người…',
  online: 'Đang sửa cùng nhau theo thời gian thực',
  degraded: 'Mạng chặn kết nối trực tiếp — vẫn đồng bộ, chậm hơn vài giây',
};

const SAVE_TEXT: Record<SaveState, string> = {
  saved: 'Đã lưu lên nhóm',
  pending: 'Có thay đổi chưa lưu',
  saving: 'Đang lưu lên nhóm…',
  error: 'Chưa lưu được, đang thử lại',
  readonly: 'Chỉ xem',
};

export function uniquePeople(peers: LivePeer[]) {
  const byUid = new Map<string, LivePeer>();
  for (const peer of peers) {
    const current = byUid.get(peer.uid);
    if (!current || (peer.self && !current.self) || (peer.connected && !current.connected)) byUid.set(peer.uid, peer);
  }
  return [...byUid.values()].sort((a, b) => Number(b.self) - Number(a.self) || a.name.localeCompare(b.name, 'vi'));
}

export function LiveBar({ peers, status, saveState, savedAt }: { peers: LivePeer[]; status: MeshStatus; saveState: SaveState; savedAt: number }) {
  const people = uniquePeople(peers);
  const [, tick] = useState(0);
  useEffect(() => { const timer = setInterval(() => tick((value) => value + 1), 30_000); return () => clearInterval(timer); }, []);
  const time = new Date(savedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const StatusIcon = status === 'online' ? Radio : status === 'degraded' ? CloudOff : Wifi;
  return (
    <div className="tm-livebar" role="group" aria-label="Người đang sửa tài liệu">
      <span className="tm-live-people">
        {people.slice(0, 6).map((peer) => (
          <span key={peer.uid} className={`tm-live-person ${peer.connected || peer.self ? '' : 'is-pending'}`} style={{ '--tm-ring': peer.color } as React.CSSProperties} title={`${peer.name}${peer.self ? ' (bạn)' : ''}${peer.role === 'viewer' ? ' · chỉ xem' : ''}`}>
            <PersonAvatar uid={peer.uid} name={peer.name} photoURL={peer.photoURL} size={26} />
          </span>
        ))}
        {people.length > 6 && <span className="tm-live-more">+{people.length - 6}</span>}
      </span>
      <span className={`tm-live-status is-${status}`} title={STATUS_TEXT[status]}>
        <StatusIcon size={14} aria-hidden="true" />
        <span className="tm-live-label">{status === 'alone' ? 'Một mình' : status === 'online' ? `${people.length} người đang sửa` : status === 'degraded' ? 'Đồng bộ chậm' : 'Đang kết nối'}</span>
      </span>
      <span className={`tm-live-save is-${saveState}`} title={saveState === 'saved' ? `${SAVE_TEXT.saved} lúc ${time}` : SAVE_TEXT[saveState]}>
        {saveState === 'readonly' ? <Eye size={14} aria-hidden="true" /> : saveState === 'saving' ? <Loader2 size={14} className="tm-spin" aria-hidden="true" /> : <CheckCircle2 size={14} aria-hidden="true" />}
        <span className="tm-live-label">{saveState === 'saved' ? `Đã lưu ${time}` : SAVE_TEXT[saveState]}</span>
      </span>
    </div>
  );
}
