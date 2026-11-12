import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  type DocumentData,
  type DocumentReference,
  type Query,
  type DocumentSnapshot,
  type Firestore,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from 'firebase/firestore';
import { decodeCloudPayload, encodeCloudPayload } from './cloudCodec';
import type { FileContent, FileMeta } from './storage';
import {
  INVITE_TTL_MS,
  TEAM_ITEM_MAX_COMPRESSED,
  TEAM_ITEM_MAX_UNCOMPRESSED,
  isTeamRole,
  normalizeEmail,
  randomId,
  type Team,
  type TeamInvite,
  type TeamItem,
  type TeamItemKind,
  type TeamItemType,
  type TeamMember,
  type TeamMembership,
  type TeamRole,
} from './teams';

export type TeamUser = { uid: string; email: string; name: string; photoURL: string };
export type Unsubscribe = () => void;
export type PublishInput = { type: TeamItemType; name: string; kind: TeamItemKind; description: string; category: string; content: FileContent };

const BATCH_LIMIT = 400;
const WATCH_RETRIES = 5;
const WATCH_BACKOFF_MS = 800;

type Watchable = DocumentReference<DocumentData> | Query<DocumentData>;
type Listen = (target: Watchable, onNext: (snapshot: never) => void, onError: (error: unknown) => void) => Unsubscribe;
const listen = onSnapshot as unknown as Listen;

export function watchWithRetry<T>(target: Watchable, onNext: (snapshot: T) => void, onError: (error: unknown) => void): Unsubscribe {
  let attempt = 0;
  let stop: Unsubscribe | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;
  const start = () => {
    stop = listen(target, (snapshot: T) => { attempt = 0; onNext(snapshot); }, (error: unknown) => {
      const code = String((error as { code?: string })?.code ?? '');
      if (closed) return;
      if (code.includes('permission-denied') && attempt < WATCH_RETRIES) {
        attempt++;
        timer = setTimeout(() => { if (!closed) start(); }, WATCH_BACKOFF_MS * 2 ** (attempt - 1));
        return;
      }
      onError(error);
    });
  };
  start();
  return () => { closed = true; if (timer) clearTimeout(timer); stop?.(); };
}
const CHUNK_BATCH = 8;

const millis = (value: unknown) => (value instanceof Timestamp ? value.toMillis() : typeof value === 'number' ? value : Date.now());
const text = (value: unknown, max = 2000) => (typeof value === 'string' ? value.slice(0, max) : '');

function toTeam(snapshot: DocumentSnapshot<DocumentData>): Team | null {
  const data = snapshot.data();
  if (!data) return null;
  return {
    id: snapshot.id,
    name: text(data.name, 80),
    description: text(data.description, 500),
    color: text(data.color, 7) || '#2563eb',
    ownerUid: text(data.ownerUid, 128),
    createdAt: millis(data.createdAt),
    updatedAt: millis(data.updatedAt),
  };
}

function toMember(snapshot: QueryDocumentSnapshot<DocumentData>): TeamMember | null {
  const data = snapshot.data();
  if (!isTeamRole(data.role)) return null;
  return { uid: snapshot.id, email: text(data.email, 320), name: text(data.name, 120), photoURL: text(data.photoURL, 2048), role: data.role, joinedAt: millis(data.joinedAt) };
}

function toInvite(snapshot: DocumentSnapshot<DocumentData>): TeamInvite | null {
  const data = snapshot.data();
  const teamId = snapshot.ref.parent.parent?.id;
  if (!data || !teamId || (data.role !== 'admin' && data.role !== 'editor' && data.role !== 'viewer')) return null;
  return {
    id: snapshot.id,
    teamId,
    email: text(data.email, 254),
    role: data.role,
    invitedBy: text(data.invitedBy, 128),
    invitedByName: text(data.invitedByName, 120),
    teamName: text(data.teamName, 80),
    createdAt: millis(data.createdAt),
    expireAt: millis(data.expireAt),
  };
}

function toItem(snapshot: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>): TeamItem | null {
  const data = snapshot.data();
  const teamId = snapshot.ref.parent.parent?.id;
  if (!data || !teamId) return null;
  return {
    id: snapshot.id,
    teamId,
    type: data.type === 'document' ? 'document' : 'template',
    name: text(data.name, 200),
    kind: data.kind === 'sheet' || data.kind === 'slide' ? data.kind : 'doc',
    description: text(data.description, 1000),
    category: text(data.category, 60),
    authorUid: text(data.authorUid, 128),
    authorName: text(data.authorName, 120),
    createdAt: millis(data.createdAt),
    updatedAt: millis(data.updatedAt),
    updatedBy: text(data.updatedBy, 128),
    updatedByName: text(data.updatedByName, 120),
    revision: text(data.revision, 64),
    chunkCount: Number(data.chunkCount) || 0,
    compressedBytes: Number(data.compressedBytes) || 0,
    uncompressedBytes: Number(data.uncompressedBytes) || 0,
    sha256: text(data.sha256, 64),
    preview: text(data.preview, 2000),
    size: Number(data.size) || 0,
  };
}

export function contentPreview(content: FileContent) {
  const parts: string[] = [];
  const walk = (node: unknown) => {
    if (parts.join(' ').length > 400 || !node || typeof node !== 'object') return;
    const value = node as { text?: unknown; content?: unknown };
    if (typeof value.text === 'string') parts.push(value.text);
    if (Array.isArray(value.content)) value.content.forEach(walk);
  };
  if (content.kind === 'doc' && typeof content.json === 'object') walk(content.json);
  if (content.kind === 'sheet') parts.push(...content.workbook.sheetOrder.map((id) => content.workbook.sheets[id]?.name ?? '').filter(Boolean));
  if (content.kind === 'slide') {
    for (const slide of content.presentation.slides) {
      for (const element of (slide as { elements?: Array<{ text?: unknown }> }).elements ?? []) if (typeof element.text === 'string') parts.push(element.text.replace(/<[^>]+>/g, ' '));
    }
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim().slice(0, 400);
}

function payloadMeta(itemId: string, kind: TeamItemKind, name: string): FileMeta {
  return { id: itemId, name: name.slice(0, 200) || 'Mẫu', kind, createdAt: 0, updatedAt: 0, openedAt: 0, starred: false, deletedAt: null, size: 0, preview: '' };
}

export function createTeamStore(db: Firestore, user: TeamUser) {
  const teamRef = (teamId: string) => doc(db, 'teams', teamId);
  const memberRef = (teamId: string, uid: string) => doc(db, 'teams', teamId, 'members', uid);
  const inviteRef = (teamId: string, inviteId: string) => doc(db, 'teams', teamId, 'invites', inviteId);
  const itemRef = (teamId: string, itemId: string) => doc(db, 'teams', teamId, 'items', itemId);
  const chunkRef = (teamId: string, itemId: string, revision: string, index: number) => doc(db, 'teams', teamId, 'items', itemId, 'chunks', `${revision}_${index}`);
  const email = normalizeEmail(user.email);

  const subscribeMemberships = (onChange: (memberships: TeamMembership[]) => void, onError: (error: unknown) => void): Unsubscribe => {
    const teamStops = new Map<string, Unsubscribe>();
    const teams = new Map<string, Team>();
    const roles = new Map<string, TeamRole>();
    const emit = () => onChange([...roles.entries()].flatMap(([teamId, role]) => {
      const team = teams.get(teamId);
      return team ? [{ team, role }] : [];
    }).sort((a, b) => a.team.name.localeCompare(b.team.name, 'vi')));
    const stop = onSnapshot(query(collectionGroup(db, 'members'), where('uid', '==', user.uid)), (snapshot) => {
      const seen = new Set<string>();
      for (const member of snapshot.docs) {
        const teamId = member.ref.parent.parent?.id;
        const role = member.data().role;
        if (!teamId || !isTeamRole(role)) continue;
        seen.add(teamId);
        roles.set(teamId, role);
        if (!teamStops.has(teamId)) {
          teamStops.set(teamId, watchWithRetry<DocumentSnapshot<DocumentData>>(teamRef(teamId), (teamSnapshot) => {
            const team = toTeam(teamSnapshot);
            if (team) teams.set(teamId, team); else teams.delete(teamId);
            emit();
          }, () => { teams.delete(teamId); emit(); }));
        }
      }
      for (const [teamId, stopTeam] of teamStops) {
        if (seen.has(teamId)) continue;
        stopTeam();
        teamStops.delete(teamId);
        teams.delete(teamId);
        roles.delete(teamId);
      }
      emit();
    }, onError);
    return () => { stop(); teamStops.forEach((stopTeam) => stopTeam()); teamStops.clear(); };
  };

  const subscribeMembers = (teamId: string, onChange: (members: TeamMember[]) => void, onError: (error: unknown) => void): Unsubscribe =>
    watchWithRetry<QuerySnapshot<DocumentData>>(collection(db, 'teams', teamId, 'members'), (snapshot) => onChange(snapshot.docs.flatMap((entry) => toMember(entry) ?? [])), onError);

  const subscribeInvites = (teamId: string, onChange: (invites: TeamInvite[]) => void, onError: (error: unknown) => void): Unsubscribe =>
    watchWithRetry<QuerySnapshot<DocumentData>>(collection(db, 'teams', teamId, 'invites'), (snapshot) => onChange(snapshot.docs.flatMap((entry) => toInvite(entry) ?? []).sort((a, b) => b.createdAt - a.createdAt)), onError);

  const subscribeItems = (teamId: string, onChange: (items: TeamItem[]) => void, onError: (error: unknown) => void): Unsubscribe =>
    watchWithRetry<QuerySnapshot<DocumentData>>(query(collection(db, 'teams', teamId, 'items'), orderBy('updatedAt', 'desc')), (snapshot) => onChange(snapshot.docs.flatMap((entry) => toItem(entry) ?? [])), onError);

  const subscribeItem = (teamId: string, itemId: string, onChange: (item: TeamItem | null) => void, onError: (error: unknown) => void): Unsubscribe =>
    watchWithRetry<DocumentSnapshot<DocumentData>>(itemRef(teamId, itemId), (snapshot) => onChange(snapshot.exists() ? toItem(snapshot) : null), onError);

  const subscribeMyInvites = (onChange: (invites: TeamInvite[]) => void, onError: (error: unknown) => void): Unsubscribe => {
    if (!email) { onChange([]); return () => undefined; }
    return onSnapshot(query(collectionGroup(db, 'invites'), where('email', '==', email)), (snapshot) => onChange(snapshot.docs.flatMap((entry) => toInvite(entry) ?? []).filter((invite) => invite.expireAt > Date.now())), onError);
  };

  const createTeam = async (input: { name: string; description: string; color: string }) => {
    const teamId = randomId(20);
    const batch = writeBatch(db);
    batch.set(teamRef(teamId), { name: input.name.trim().slice(0, 80), description: input.description.trim().slice(0, 500), color: input.color, ownerUid: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    batch.set(memberRef(teamId, user.uid), { uid: user.uid, email, name: user.name.slice(0, 120), photoURL: user.photoURL.slice(0, 2048), role: 'owner', joinedAt: serverTimestamp(), inviteId: '' });
    await batch.commit();
    return teamId;
  };

  const updateTeam = async (team: Team, patch: Partial<Pick<Team, 'name' | 'description' | 'color'>>) => {
    const batch = writeBatch(db);
    batch.set(teamRef(team.id), {
      name: (patch.name ?? team.name).trim().slice(0, 80),
      description: (patch.description ?? team.description).trim().slice(0, 500),
      color: patch.color ?? team.color,
      ownerUid: team.ownerUid,
      createdAt: Timestamp.fromMillis(team.createdAt),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  };

  const createInvite = async (team: Team, inviteEmail: string, role: Exclude<TeamRole, 'owner'>) => {
    const inviteId = randomId(24);
    const expireAt = Date.now() + INVITE_TTL_MS - 60_000;
    const batch = writeBatch(db);
    batch.set(inviteRef(team.id, inviteId), { email: normalizeEmail(inviteEmail), role, invitedBy: user.uid, invitedByName: user.name.slice(0, 120), teamName: team.name, createdAt: serverTimestamp(), expireAt: Timestamp.fromMillis(expireAt) });
    await batch.commit();
    return { id: inviteId, teamId: team.id, email: normalizeEmail(inviteEmail), role, invitedBy: user.uid, invitedByName: user.name, teamName: team.name, createdAt: Date.now(), expireAt } satisfies TeamInvite;
  };

  const getInvite = async (teamId: string, inviteId: string) => {
    const snapshot = await getDoc(inviteRef(teamId, inviteId));
    return snapshot.exists() ? toInvite(snapshot) : null;
  };

  const acceptInvite = async (invite: TeamInvite) => {
    const batch = writeBatch(db);
    batch.set(memberRef(invite.teamId, user.uid), { uid: user.uid, email, name: user.name.slice(0, 120), photoURL: user.photoURL.slice(0, 2048), role: invite.role, joinedAt: serverTimestamp(), inviteId: invite.id });
    batch.delete(inviteRef(invite.teamId, invite.id));
    await batch.commit();
  };

  const deleteInvite = (teamId: string, inviteId: string) => deleteDoc(inviteRef(teamId, inviteId));

  const changeRole = async (teamId: string, member: TeamMember, role: Exclude<TeamRole, 'owner'>) => {
    const batch = writeBatch(db);
    batch.update(memberRef(teamId, member.uid), { role });
    await batch.commit();
  };

  const removeMember = (teamId: string, uid: string) => deleteDoc(memberRef(teamId, uid));
  const leaveTeam = (teamId: string) => deleteDoc(memberRef(teamId, user.uid));

  const transferOwnership = async (team: Team, target: TeamMember) => {
    const batch = writeBatch(db);
    batch.set(teamRef(team.id), { name: team.name, description: team.description, color: team.color, ownerUid: target.uid, createdAt: Timestamp.fromMillis(team.createdAt), updatedAt: serverTimestamp() });
    batch.update(memberRef(team.id, target.uid), { role: 'owner' });
    batch.update(memberRef(team.id, user.uid), { role: 'admin' });
    await batch.commit();
  };

  const syncProfile = async (teamId: string, member: TeamMember) => {
    if (member.name === user.name.slice(0, 120) && member.photoURL === user.photoURL.slice(0, 2048)) return;
    const batch = writeBatch(db);
    batch.update(memberRef(teamId, user.uid), { name: user.name.slice(0, 120), photoURL: user.photoURL.slice(0, 2048) });
    await batch.commit();
  };

  const writeChunks = async (teamId: string, itemId: string, revision: string, chunks: string[]) => {
    for (let start = 0; start < chunks.length; start += CHUNK_BATCH) {
      const batch = writeBatch(db);
      chunks.slice(start, start + CHUNK_BATCH).forEach((data, offset) => batch.set(chunkRef(teamId, itemId, revision, start + offset), { revision, index: start + offset, data }));
      await batch.commit();
    }
  };

  const removeChunks = async (teamId: string, itemId: string, revision: string, count: number) => {
    for (let start = 0; start < count; start += BATCH_LIMIT) {
      const batch = writeBatch(db);
      for (let index = start; index < Math.min(count, start + BATCH_LIMIT); index++) batch.delete(chunkRef(teamId, itemId, revision, index));
      await batch.commit();
    }
  };

  const encode = (itemId: string, kind: TeamItemKind, name: string, content: FileContent) =>
    encodeCloudPayload(content, [], payloadMeta(itemId, kind, name), { compressed: TEAM_ITEM_MAX_COMPRESSED, uncompressed: TEAM_ITEM_MAX_UNCOMPRESSED });

  const storedFields = (revision: string, encoded: Awaited<ReturnType<typeof encode>>, content: FileContent) => ({
    revision,
    chunkCount: encoded.chunks.length,
    compressedBytes: encoded.compressedBytes,
    uncompressedBytes: encoded.uncompressedBytes,
    sha256: encoded.sha256,
    preview: contentPreview(content).slice(0, 2000),
    size: encoded.uncompressedBytes,
  });

  const publishItem = async (teamId: string, input: PublishInput) => {
    const itemId = randomId(20);
    const revision = crypto.randomUUID();
    const encoded = await encode(itemId, input.kind, input.name, input.content);
    await writeChunks(teamId, itemId, revision, encoded.chunks);
    const batch = writeBatch(db);
    batch.set(itemRef(teamId, itemId), {
      type: input.type,
      name: input.name.trim().slice(0, 200),
      kind: input.kind,
      description: input.description.trim().slice(0, 1000),
      category: input.category.trim().slice(0, 60),
      authorUid: user.uid,
      authorName: user.name.slice(0, 120),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
      updatedByName: user.name.slice(0, 120),
      ...storedFields(revision, encoded, input.content),
    });
    try { await batch.commit(); }
    catch (error) { await removeChunks(teamId, itemId, revision, encoded.chunks.length).catch(() => undefined); throw error; }
    return itemId;
  };

  const itemFields = (item: TeamItem, patch: Partial<Pick<TeamItem, 'name' | 'description' | 'category'>>) => ({
    type: item.type,
    name: (patch.name ?? item.name).trim().slice(0, 200),
    kind: item.kind,
    description: (patch.description ?? item.description).trim().slice(0, 1000),
    category: (patch.category ?? item.category).trim().slice(0, 60),
    authorUid: item.authorUid,
    authorName: item.authorName,
    createdAt: Timestamp.fromMillis(item.createdAt),
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
    updatedByName: user.name.slice(0, 120),
  });

  const updateItemInfo = async (item: TeamItem, patch: Partial<Pick<TeamItem, 'name' | 'description' | 'category'>>) => {
    const batch = writeBatch(db);
    batch.set(itemRef(item.teamId, item.id), {
      ...itemFields(item, patch),
      revision: item.revision,
      chunkCount: item.chunkCount,
      compressedBytes: item.compressedBytes,
      uncompressedBytes: item.uncompressedBytes,
      sha256: item.sha256,
      preview: item.preview,
      size: item.size,
    });
    await batch.commit();
  };

  const replaceItemContent = async (item: TeamItem, content: FileContent, patch: Partial<Pick<TeamItem, 'name' | 'description' | 'category'>> = {}) => {
    const revision = crypto.randomUUID();
    const encoded = await encode(item.id, item.kind, item.name, content);
    await writeChunks(item.teamId, item.id, revision, encoded.chunks);
    const batch = writeBatch(db);
    batch.set(itemRef(item.teamId, item.id), { ...itemFields(item, patch), ...storedFields(revision, encoded, content) });
    try { await batch.commit(); }
    catch (error) { await removeChunks(item.teamId, item.id, revision, encoded.chunks.length).catch(() => undefined); throw error; }
    await removeChunks(item.teamId, item.id, item.revision, item.chunkCount).catch(() => undefined);
    return revision;
  };

  const loadItemContent = async (item: TeamItem): Promise<FileContent> => {
    const chunks: string[] = [];
    for (let index = 0; index < item.chunkCount; index++) {
      const snapshot = await getDoc(chunkRef(item.teamId, item.id, item.revision, index));
      const data = snapshot.data();
      if (!data || typeof data.data !== 'string') throw new Error('team/item-missing-chunk');
      chunks.push(data.data);
    }
    const payload = await decodeCloudPayload({ chunks, compressedBytes: item.compressedBytes, uncompressedBytes: item.uncompressedBytes, sha256: item.sha256 }, payloadMeta(item.id, item.kind, item.name));
    if (!payload.content) throw new Error('team/item-empty');
    return payload.content;
  };

  const deleteItem = async (item: TeamItem) => {
    await deleteDoc(itemRef(item.teamId, item.id));
    await removeChunks(item.teamId, item.id, item.revision, item.chunkCount).catch(() => undefined);
    if (item.type !== 'document') return;
    for (const name of ['live', 'liveChunks', 'peers', 'signals']) {
      const rest = await getDocs(collection(db, 'teams', item.teamId, 'items', item.id, name)).catch(() => null);
      if (!rest?.size) continue;
      const batch = writeBatch(db);
      rest.docs.slice(0, BATCH_LIMIT).forEach((entry) => batch.delete(entry.ref));
      await batch.commit().catch(() => undefined);
    }
  };

  const getMyRole = async (teamId: string): Promise<TeamRole | null> => {
    const snapshot = await getDoc(memberRef(teamId, user.uid));
    const role = snapshot.data()?.role;
    return isTeamRole(role) ? role : null;
  };

  const getItem = async (teamId: string, itemId: string) => {
    const snapshot = await getDoc(itemRef(teamId, itemId));
    return snapshot.exists() ? toItem(snapshot) : null;
  };

  const getTeam = async (teamId: string) => toTeam(await getDoc(teamRef(teamId)));

  const deleteTeam = async (team: Team) => {
    const items = await getDocs(collection(db, 'teams', team.id, 'items'));
    for (const entry of items.docs) {
      const item = toItem(entry);
      if (item) await deleteItem(item);
    }
    const invites = await getDocs(collection(db, 'teams', team.id, 'invites'));
    const members = await getDocs(collection(db, 'teams', team.id, 'members'));
    const refs = [...invites.docs.map((entry) => entry.ref), ...members.docs.filter((entry) => entry.id !== user.uid).map((entry) => entry.ref)];
    for (let start = 0; start < refs.length; start += BATCH_LIMIT) {
      const batch = writeBatch(db);
      refs.slice(start, start + BATCH_LIMIT).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }
    await deleteDoc(teamRef(team.id));
    await deleteDoc(memberRef(team.id, user.uid));
  };

  return {
    db,
    user,
    getMyRole,
    getItem,
    getTeam,
    subscribeMemberships,
    subscribeMembers,
    subscribeInvites,
    subscribeItems,
    subscribeItem,
    subscribeMyInvites,
    createTeam,
    updateTeam,
    deleteTeam,
    createInvite,
    getInvite,
    acceptInvite,
    deleteInvite,
    changeRole,
    removeMember,
    leaveTeam,
    transferOwnership,
    syncProfile,
    publishItem,
    updateItemInfo,
    replaceItemContent,
    loadItemContent,
    deleteItem,
  };
}

export type TeamStore = ReturnType<typeof createTeamStore>;

export async function openTeamStore(user: TeamUser) {
  const [{ initializeAuthentication }, { getFirestore }] = await Promise.all([import('./auth'), import('firebase/firestore')]);
  const auth = await initializeAuthentication();
  if (auth.currentUser?.uid !== user.uid) throw new Error('team/account-changed');
  return createTeamStore(getFirestore(auth.app), user);
}

export function teamErrorMessage(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? String((error as { code: unknown }).code) : error instanceof Error ? error.message : '';
  if (code.includes('permission-denied')) return 'Bạn không có quyền thực hiện thao tác này trong nhóm.';
  if (code.includes('unavailable') || code.includes('network')) return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.';
  if (code.includes('payload-too-large')) return 'Tài liệu quá lớn để chia sẻ (tối đa khoảng 27 MB sau khi nén).';
  if (code.includes('missing-chunk') || code.includes('invalid-data')) return 'Dữ liệu mẫu bị thiếu hoặc hỏng. Hãy nhờ người đăng mẫu đăng lại.';
  if (code.includes('failed-precondition')) return 'Máy chủ chưa sẵn sàng cho truy vấn này. Vui lòng thử lại sau ít phút.';
  return 'Chưa thực hiện được. Vui lòng thử lại.';
}
