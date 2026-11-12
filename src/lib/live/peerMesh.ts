import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  type Firestore,
} from 'firebase/firestore';
import { randomId } from '../teams';

export type LivePeer = {
  peerId: string;
  uid: string;
  name: string;
  photoURL: string;
  color: string;
  role: string;
  lastSeen: number;
  connected: boolean;
  self: boolean;
};

export type MeshSelf = { uid: string; name: string; photoURL: string; color: string; role: string };
export type MeshStatus = 'connecting' | 'online' | 'alone' | 'degraded';
type Message = (channel: number, data: Uint8Array, from: LivePeer) => void;

const HEARTBEAT_MS = 25_000;
const STALE_MS = 80_000;
const CONNECT_TIMEOUT_MS = 20_000;
const RETRY_MS = 45_000;
const ICE_WAIT_MS = 3_000;
const FRAME_BYTES = 15_000;
const ICE_SERVERS: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];

type Link = {
  pc: RTCPeerConnection;
  channel: RTCDataChannel | null;
  open: boolean;
  startedAt: number;
  initiator: boolean;
  assembling: Map<number, { parts: Uint8Array[]; received: number; total: number }>;
  timer: ReturnType<typeof setTimeout> | null;
};

export function encodeFrames(channel: number, data: Uint8Array, messageId: number) {
  const total = Math.max(1, Math.ceil(data.length / FRAME_BYTES));
  const frames: Uint8Array[] = [];
  for (let index = 0; index < total; index++) {
    const slice = data.subarray(index * FRAME_BYTES, Math.min(data.length, (index + 1) * FRAME_BYTES));
    const frame = new Uint8Array(13 + slice.length);
    const view = new DataView(frame.buffer);
    frame[0] = channel;
    view.setUint32(1, messageId);
    view.setUint32(5, index);
    view.setUint32(9, total);
    frame.set(slice, 13);
    frames.push(frame);
  }
  return frames;
}

export function decodeFrame(frame: Uint8Array) {
  if (frame.length < 13) return null;
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  const total = view.getUint32(9);
  const index = view.getUint32(5);
  if (!total || index >= total || total > 100_000) return null;
  return { channel: frame[0], messageId: view.getUint32(1), index, total, data: frame.subarray(13) };
}

function waitForIce(pc: RTCPeerConnection) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise<void>((resolve) => {
    const done = () => { pc.removeEventListener('icegatheringstatechange', check); clearTimeout(timer); resolve(); };
    const check = () => { if (pc.iceGatheringState === 'complete') done(); };
    const timer = setTimeout(done, ICE_WAIT_MS);
    pc.addEventListener('icegatheringstatechange', check);
  });
}

export function createPeerMesh(db: Firestore, path: { teamId: string; itemId: string }, self: MeshSelf) {
  const peerId = `${self.uid}_${randomId(10)}`;
  const base = ['teams', path.teamId, 'items', path.itemId] as const;
  const peersCol = collection(db, ...base, 'peers');
  const signalsCol = collection(db, ...base, 'signals');
  const links = new Map<string, Link>();
  const known = new Map<string, LivePeer>();
  const lastAttempt = new Map<string, number>();
  const failures = new Set<string>();
  const messageListeners = new Set<Message>();
  const peerListeners = new Set<(peers: LivePeer[]) => void>();
  const joinListeners = new Set<(peer: LivePeer) => void>();
  const stops: Array<() => void> = [];
  let messageCounter = 1;
  let stopped = false;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const selfPeer = (): LivePeer => ({ peerId, ...self, lastSeen: Date.now(), connected: true, self: true });
  const peers = () => [selfPeer(), ...[...known.values()].filter((peer) => Date.now() - peer.lastSeen < STALE_MS).map((peer) => ({ ...peer, connected: Boolean(links.get(peer.peerId)?.open) }))];
  const emitPeers = () => { const list = peers(); peerListeners.forEach((listener) => listener(list)); };

  const writePresence = () => setDoc(doc(peersCol, peerId), { peerId, uid: self.uid, name: self.name.slice(0, 120), photoURL: self.photoURL.slice(0, 2048), color: self.color, role: self.role, at: serverTimestamp() }).catch((error) => console.warn('live: presence write failed', error));

  const closeLink = (remote: string) => {
    const link = links.get(remote);
    if (!link) return;
    if (!link.open) failures.add(remote);
    if (link.timer) clearTimeout(link.timer);
    try { link.channel?.close(); } catch { void 0; }
    try { link.pc.close(); } catch { void 0; }
    links.delete(remote);
    emitPeers();
  };

  const deliver = (remote: string, frame: Uint8Array) => {
    const link = links.get(remote);
    const peer = known.get(remote);
    const decoded = decodeFrame(frame);
    if (!link || !peer || !decoded) return;
    let data = decoded.data;
    if (decoded.total > 1) {
      const entry = link.assembling.get(decoded.messageId) ?? { parts: new Array(decoded.total), received: 0, total: decoded.total };
      if (!entry.parts[decoded.index]) { entry.parts[decoded.index] = decoded.data.slice(); entry.received++; }
      link.assembling.set(decoded.messageId, entry);
      if (entry.received < entry.total) return;
      link.assembling.delete(decoded.messageId);
      const size = entry.parts.reduce((sum, part) => sum + part.length, 0);
      data = new Uint8Array(size);
      let offset = 0;
      for (const part of entry.parts) { data.set(part, offset); offset += part.length; }
    }
    messageListeners.forEach((listener) => listener(decoded.channel, data, { ...peer, connected: true }));
  };

  const attachChannel = (remote: string, channel: RTCDataChannel) => {
    const link = links.get(remote);
    if (!link) return;
    link.channel = channel;
    channel.binaryType = 'arraybuffer';
    channel.onopen = () => {
      link.open = true;
      failures.delete(remote);
      if (link.timer) { clearTimeout(link.timer); link.timer = null; }
      emitPeers();
      const peer = known.get(remote);
      if (peer) joinListeners.forEach((listener) => listener({ ...peer, connected: true }));
    };
    channel.onclose = () => { if (links.get(remote) === link) closeLink(remote); };
    channel.onmessage = (event) => { if (event.data instanceof ArrayBuffer) deliver(remote, new Uint8Array(event.data)); };
  };

  const newLink = (remote: string, initiator: boolean) => {
    closeLink(remote);
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const link: Link = { pc, channel: null, open: false, startedAt: Date.now(), initiator, assembling: new Map(), timer: null };
    links.set(remote, link);
    link.timer = setTimeout(() => { if (!link.open && links.get(remote) === link) closeLink(remote); }, CONNECT_TIMEOUT_MS);
    pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed' || pc.connectionState === 'closed') closeLink(remote); };
    if (!initiator) pc.ondatachannel = (event) => attachChannel(remote, event.channel);
    return link;
  };

  const sendSignal = (to: string, kind: 'offer' | 'answer', sdp: string) =>
    setDoc(doc(signalsCol, randomId(20)), { from: peerId, fromUid: self.uid, to, kind, sdp: sdp.slice(0, 60000), at: serverTimestamp() });

  const initiate = async (remote: string) => {
    lastAttempt.set(remote, Date.now());
    const link = newLink(remote, true);
    attachChannel(remote, link.pc.createDataChannel('live', { ordered: true }));
    try {
      await link.pc.setLocalDescription(await link.pc.createOffer());
      await waitForIce(link.pc);
      if (stopped || links.get(remote) !== link || !link.pc.localDescription) return;
      await sendSignal(remote, 'offer', link.pc.localDescription.sdp);
    } catch (error) { console.warn('live: offer failed', error); closeLink(remote); }
  };

  const answer = async (remote: string, sdp: string) => {
    const link = newLink(remote, false);
    try {
      await link.pc.setRemoteDescription({ type: 'offer', sdp });
      await link.pc.setLocalDescription(await link.pc.createAnswer());
      await waitForIce(link.pc);
      if (stopped || links.get(remote) !== link || !link.pc.localDescription) return;
      await sendSignal(remote, 'answer', link.pc.localDescription.sdp);
    } catch (error) { console.warn('live: answer failed', error); closeLink(remote); }
  };

  const maybeConnect = () => {
    if (stopped || typeof RTCPeerConnection === 'undefined') return;
    for (const peer of known.values()) {
      if (Date.now() - peer.lastSeen >= STALE_MS) { closeLink(peer.peerId); continue; }
      if (links.has(peer.peerId) || peerId < peer.peerId) continue;
      if (Date.now() - (lastAttempt.get(peer.peerId) ?? 0) < RETRY_MS) continue;
      void initiate(peer.peerId);
    }
  };

  const start = () => {
    void writePresence();
    heartbeat = setInterval(() => { void writePresence(); maybeConnect(); emitPeers(); }, HEARTBEAT_MS);
    stops.push(onSnapshot(peersCol, (snapshot) => {
      known.clear();
      for (const entry of snapshot.docs) {
        const data = entry.data();
        if (entry.id === peerId || typeof data.uid !== 'string') continue;
        const at = data.at instanceof Timestamp ? data.at.toMillis() : Date.now();
        known.set(entry.id, { peerId: entry.id, uid: data.uid, name: String(data.name ?? ''), photoURL: String(data.photoURL ?? ''), color: String(data.color ?? '#2563eb'), role: String(data.role ?? 'viewer'), lastSeen: at, connected: false, self: false });
      }
      for (const remote of [...links.keys()]) if (!known.has(remote)) closeLink(remote);
      maybeConnect();
      emitPeers();
    }, (error) => console.warn('live: peers listener failed', error)));
    stops.push(onSnapshot(query(signalsCol, where('to', '==', peerId)), (snapshot) => {
      for (const change of snapshot.docChanges()) {
        if (change.type !== 'added') continue;
        const data = change.doc.data();
        void deleteDoc(change.doc.ref).catch(() => undefined);
        if (typeof data.from !== 'string' || typeof data.sdp !== 'string' || !known.has(data.from) || known.get(data.from)?.uid !== data.fromUid) continue;
        if (data.kind === 'offer') void answer(data.from, data.sdp);
        else if (data.kind === 'answer') {
          const link = links.get(data.from);
          if (link?.initiator && link.pc.signalingState === 'have-local-offer') void link.pc.setRemoteDescription({ type: 'answer', sdp: data.sdp }).catch(() => closeLink(data.from));
        }
      }
    }, (error) => console.warn('live: signal listener failed', error)));
    const leave = () => { void deleteDoc(doc(peersCol, peerId)).catch(() => undefined); };
    window.addEventListener('pagehide', leave);
    stops.push(() => window.removeEventListener('pagehide', leave));
  };

  const send = (channel: number, data: Uint8Array, target?: string) => {
    const frames = encodeFrames(channel, data, messageCounter++ >>> 0);
    for (const [remote, link] of links) {
      if (!link.open || !link.channel || (target && remote !== target)) continue;
      try { for (const frame of frames) link.channel.send(frame as Uint8Array<ArrayBuffer>); }
      catch (error) { console.warn('live: send failed', error); closeLink(remote); }
    }
  };

  const status = (): MeshStatus => {
    const others = peers().filter((peer) => !peer.self);
    if (!others.length) return 'alone';
    if (others.every((peer) => peer.connected)) return 'online';
    return others.some((peer) => !peer.connected && failures.has(peer.peerId)) ? 'degraded' : 'connecting';
  };

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (heartbeat) clearInterval(heartbeat);
    stops.forEach((fn) => fn());
    for (const remote of [...links.keys()]) closeLink(remote);
    void deleteDoc(doc(peersCol, peerId)).catch(() => undefined);
  };

  return {
    peerId,
    start,
    stop,
    send,
    peers,
    status,
    onMessage: (listener: Message) => { messageListeners.add(listener); return () => { messageListeners.delete(listener); }; },
    onPeers: (listener: (peers: LivePeer[]) => void) => { peerListeners.add(listener); listener(peers()); return () => { peerListeners.delete(listener); }; },
    onJoin: (listener: (peer: LivePeer) => void) => { joinListeners.add(listener); return () => { joinListeners.delete(listener); }; },
  };
}

export type PeerMesh = ReturnType<typeof createPeerMesh>;
