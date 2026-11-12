import type { ElementAnimation, SlideElement, SlideTransition } from '../../lib/slideTypes';
import {
  FX_ANGLE,
  FX_PROGRESS,
  animationEasing,
  animationIterations,
  buildAnimationPlan,
  buildAnimationTimeline,
  buildTransitionPlan,
  transitionDurationOf,
  type FxContext,
  type FxFrame,
  type TimelineItem,
  type TimelineStep,
} from '../../lib/slideEffects';

export interface SlideSize {
  width: number;
  height: number;
}

const MIN_DURATION_MS = 10;
const PREVIEW_STEP_GAP_MS = 150;
const PREVIEW_HOLD_MS = 500;

let propertiesRegistered = false;

function registerProperty(name: string, syntax: string, initialValue: string) {
  try {
    CSS.registerProperty({ name, syntax, inherits: false, initialValue });
  } catch (error) {
    if (!(error instanceof DOMException)) throw error;
  }
}

export function ensureFxProperties() {
  if (propertiesRegistered) return;
  propertiesRegistered = true;
  if (typeof CSS === 'undefined' || typeof CSS.registerProperty !== 'function') return;
  registerProperty(FX_PROGRESS, '<percentage>', '100%');
  registerProperty(FX_ANGLE, '<angle>', '360deg');
}

export function findElementNode(root: ParentNode | null, elementId: string): HTMLElement | null {
  if (!root) return null;
  return root.querySelector<HTMLElement>(`[data-el-id="${CSS.escape(elementId)}"]`);
}

function contextFor(element: SlideElement, size: SlideSize): FxContext {
  return {
    slideW: size.width,
    slideH: size.height,
    x: (element.x / 100) * size.width,
    y: (element.y / 100) * size.height,
    w: (element.width / 100) * size.width,
    h: (element.height / 100) * size.height,
  };
}

const isEndless = (anim: ElementAnimation) =>
  anim.repeat === 'until-next-click' || anim.repeat === 'until-end-of-slide';

export function playElementAnimation(
  node: HTMLElement,
  element: SlideElement,
  anim: ElementAnimation,
  size: SlideSize
): { animation: Animation; persist: boolean } | null {
  ensureFxProperties();
  const plan = buildAnimationPlan(anim, contextFor(element, size));
  if (!plan) return null;
  const animation = node.animate(plan.frames as Keyframe[], {
    duration: Math.max(MIN_DURATION_MS, (anim.duration || 0.5) * 1000),
    iterations: isEndless(anim) ? Infinity : animationIterations(anim),
    direction: anim.autoReverse ? 'alternate' : 'normal',
    easing: animationEasing(anim, plan.easing ?? 'linear'),
    fill: 'both',
  });
  return { animation, persist: Boolean(plan.persist) };
}

export interface FxStepHooks {
  onStart?: (item: TimelineItem) => void;
  onFinish?: (item: TimelineItem) => void;
  onStepDone?: () => void;
}

interface PendingStart {
  timer: number;
  fire: () => void;
}

export class SlideFxPlayer {
  private readonly running = new Map<string, Animation>();
  private readonly endless = new Set<string>();
  private pending: PendingStart[] = [];
  private stepToken = 0;

  private readonly getRoot: () => ParentNode | null;
  private readonly getSize: () => SlideSize;

  constructor(getRoot: () => ParentNode | null, getSize: () => SlideSize) {
    this.getRoot = getRoot;
    this.getSize = getSize;
  }

  playStep(step: TimelineStep, elements: SlideElement[], hooks: FxStepHooks = {}) {
    const token = ++this.stepToken;
    let remaining = step.items.length;
    const settle = () => {
      remaining--;
      if (remaining === 0 && token === this.stepToken) hooks.onStepDone?.();
    };
    if (remaining === 0) {
      hooks.onStepDone?.();
      return;
    }
    for (const item of step.items) {
      const fire = () => this.startItem(item, elements, hooks, settle);
      const startDelay = Math.max(0, item.start * 1000);
      if (startDelay === 0) {
        fire();
        continue;
      }
      const entry: PendingStart = {
        timer: window.setTimeout(() => {
          this.pending = this.pending.filter((candidate) => candidate !== entry);
          fire();
        }, startDelay),
        fire,
      };
      this.pending.push(entry);
    }
  }

  private startItem(item: TimelineItem, elements: SlideElement[], hooks: FxStepHooks, settle: () => void) {
    const element = elements.find((candidate) => candidate.id === item.elementId);
    const node = findElementNode(this.getRoot(), item.elementId);
    hooks.onStart?.(item);
    const played = element && node ? playElementAnimation(node, element, item.anim, this.getSize()) : null;
    if (!played) {
      hooks.onFinish?.(item);
      settle();
      return;
    }
    const { animation, persist } = played;
    this.running.get(item.anim.id)?.cancel();
    this.running.set(item.anim.id, animation);
    if (isEndless(item.anim)) {
      this.endless.add(item.anim.id);
      settle();
      return;
    }
    animation.finished
      .then(() => {
        hooks.onFinish?.(item);
        if (!persist && item.anim.category !== 'exit') {
          animation.cancel();
          this.running.delete(item.anim.id);
        }
        settle();
      })
      .catch(() => settle());
  }

  flush() {
    const queued = this.pending;
    this.pending = [];
    for (const entry of queued) {
      window.clearTimeout(entry.timer);
      entry.fire();
    }
    for (const [id, animation] of this.running) {
      if (this.endless.has(id)) {
        animation.cancel();
        this.running.delete(id);
        this.endless.delete(id);
      } else if (animation.playState !== 'finished') {
        animation.finish();
      }
    }
  }

  applyPlayed(items: TimelineItem[], elements: SlideElement[]) {
    for (const item of items) {
      const element = elements.find((candidate) => candidate.id === item.elementId);
      const node = findElementNode(this.getRoot(), item.elementId);
      if (!element || !node || isEndless(item.anim)) continue;
      const played = playElementAnimation(node, element, item.anim, this.getSize());
      if (!played) continue;
      if (!played.persist) {
        played.animation.cancel();
        continue;
      }
      played.animation.finish();
      this.running.set(item.anim.id, played.animation);
    }
  }

  reset() {
    this.stepToken++;
    for (const entry of this.pending) window.clearTimeout(entry.timer);
    this.pending = [];
    for (const animation of this.running.values()) animation.cancel();
    this.running.clear();
    this.endless.clear();
  }
}

function reverseFrames(frames: FxFrame[]): FxFrame[] {
  return [...frames].reverse().map((frame) =>
    typeof frame.offset === 'number' ? { ...frame, offset: 1 - frame.offset } : frame
  );
}

interface TransitionOptions {
  outgoing: HTMLElement | null;
  incoming: HTMLElement;
  transition: SlideTransition | undefined;
  onDone: () => void;
}

export function playSlideTransition({ outgoing, incoming, transition, onDone }: TransitionOptions): () => void {
  ensureFxProperties();
  const plan = buildTransitionPlan(transition);
  const duration = transitionDurationOf(transition) * 1000;
  if (!plan || duration <= 0) {
    onDone();
    return () => {};
  }
  const timing: KeyframeAnimationOptions = { duration, easing: plan.easing, fill: 'both' };
  const animations: Animation[] = [];
  if (outgoing) {
    outgoing.style.zIndex = plan.outgoingOnTop ? '2' : '1';
    incoming.style.zIndex = plan.outgoingOnTop ? '1' : '2';
    if (plan.outgoing.length > 0) animations.push(outgoing.animate(plan.outgoing as Keyframe[], timing));
    if (plan.incoming.length > 0) animations.push(incoming.animate(plan.incoming as Keyframe[], timing));
  } else {
    const frames = plan.incoming.length > 0 ? plan.incoming : reverseFrames(plan.outgoing);
    animations.push(incoming.animate(frames as Keyframe[], timing));
  }
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timer);
    if (outgoing) outgoing.style.visibility = 'hidden';
    for (const animation of animations) animation.cancel();
    incoming.style.zIndex = '';
    onDone();
  };
  const timer = window.setTimeout(finish, duration + 60);
  return finish;
}

interface PreviewOptions {
  root: ParentNode | null;
  elements: SlideElement[];
  size: SlideSize;
  onlyElementId?: string | null;
  onlyAnimationId?: string | null;
  onDone?: () => void;
}

export function previewSlideAnimations({
  root,
  elements,
  size,
  onlyElementId,
  onlyAnimationId,
  onDone,
}: PreviewOptions): () => void {
  const keep = (item: TimelineItem) =>
    (!onlyElementId || item.elementId === onlyElementId) && (!onlyAnimationId || item.anim.id === onlyAnimationId);
  const steps = buildAnimationTimeline(elements)
    .map((step) => ({ ...step, items: step.items.filter(keep) }))
    .filter((step) => step.items.length > 0);
  const animations: Animation[] = [];
  const timers: number[] = [];
  let cursor = 0;
  for (const step of steps) {
    const base = Math.min(...step.items.map((item) => item.start));
    let stepEnd = 0;
    for (const item of step.items) {
      const element = elements.find((candidate) => candidate.id === item.elementId);
      const node = findElementNode(root, item.elementId);
      if (!element || !node) continue;
      const anim = isEndless(item.anim) ? { ...item.anim, repeat: 2 } : item.anim;
      const startMs = cursor + (item.start - base) * 1000;
      stepEnd = Math.max(stepEnd, (item.start - base + (anim.duration || 0.5) * animationIterations(anim)) * 1000);
      timers.push(
        window.setTimeout(() => {
          const played = playElementAnimation(node, element, anim, size);
          if (played) animations.push(played.animation);
        }, startMs)
      );
    }
    cursor += stepEnd + PREVIEW_STEP_GAP_MS;
  }
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    for (const timer of timers) window.clearTimeout(timer);
    for (const animation of animations) animation.cancel();
    onDone?.();
  };
  timers.push(window.setTimeout(stop, cursor + PREVIEW_HOLD_MS));
  return stop;
}
