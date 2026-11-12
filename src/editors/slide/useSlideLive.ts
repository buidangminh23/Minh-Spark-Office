import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import type * as Y from 'yjs';
import type { Awareness } from 'y-protocols/awareness';
import type { CommentItem } from '../../lib/storage';
import type { PresentationData } from '../../lib/slideTypes';
import { readFlat, writeFlat } from '../../lib/live/flatSync';
import { flattenPresentation, SLIDE_MAP, unflattenPresentation } from '../../lib/live/slideSync';
import { useLocalPresence, useLocalUser, useRemotePresence, type LiveUser } from '../../lib/live/presence';

export type SlideLiveBinding = {
  ydoc: Y.Doc;
  awareness: Awareness;
  user: LiveUser;
  readOnly: boolean;
  bar: ReactNode;
};

type SlidePresence = { slideId: string; ids: string[] };

const LOCAL_ORIGIN = 'slide-local';
const WRITE_DELAY_MS = 80;

export function useSlideLive(
  live: SlideLiveBinding | undefined,
  presentation: PresentationData,
  comments: CommentItem[] | undefined,
  onRemote: (next: PresentationData) => void,
  presence: SlidePresence,
) {
  const latest = useRef({ presentation, comments });
  latest.current = { presentation, comments };
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteRef = useRef(onRemote);
  remoteRef.current = onRemote;
  const ydoc = live?.ydoc;
  const awareness = live?.awareness;
  const readOnly = live?.readOnly ?? true;

  const flush = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (!ydoc || readOnly) return;
    const { presentation: current, comments: notes } = latest.current;
    writeFlat(ydoc.getMap(SLIDE_MAP), flattenPresentation({ kind: 'slide', presentation: current, comments: notes }), LOCAL_ORIGIN);
  }, [ydoc, readOnly]);

  useEffect(() => {
    if (!ydoc || readOnly || timer.current) return;
    timer.current = setTimeout(flush, WRITE_DELAY_MS);
  }, [ydoc, readOnly, presentation, flush]);

  useEffect(() => () => flush(), [flush]);

  useEffect(() => {
    if (!ydoc) return;
    const map = ydoc.getMap(SLIDE_MAP);
    const pull = (_event: Y.YMapEvent<unknown>, transaction: Y.Transaction) => {
      if (transaction.origin === LOCAL_ORIGIN) return;
      if (timer.current) flush();
      const next = unflattenPresentation(readFlat(map));
      if (next && JSON.stringify(next.presentation) !== JSON.stringify(latest.current.presentation)) remoteRef.current(next.presentation);
    };
    map.observe(pull);
    return () => map.unobserve(pull);
  }, [ydoc, flush]);

  useLocalUser(awareness ?? null, live?.user ?? null);
  useLocalPresence(awareness ?? null, 'slide', live ? presence : null);
  const peers = useRemotePresence<SlidePresence>(awareness ?? null, 'slide', live?.user.uid ?? '');

  const slideId = presence.slideId;
  return useMemo(() => {
    const marks: Record<string, Array<{ key: string; name: string; color: string }>> = {};
    for (const peer of peers) (marks[peer.value.slideId] ??= []).push({ key: peer.key, name: peer.name, color: peer.color });
    const onSlide = peers.filter((peer) => peer.value.slideId === slideId).map((peer) => ({ key: peer.key, name: peer.name, color: peer.color, ids: peer.value.ids }));
    return { marks, onSlide };
  }, [peers, slideId]);
}
