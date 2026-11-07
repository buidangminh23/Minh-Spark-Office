import { Extension } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export type SearchOptions = { matchCase: boolean; wholeWord: boolean; regex: boolean };
export type SearchRange = { from: number; to: number };
export type SearchState = { term: string; options: SearchOptions; results: SearchRange[]; index: number; error: string | null };

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    search: {
      setSearch: (term: string, options?: Partial<SearchOptions>) => ReturnType;
      clearSearch: () => ReturnType;
      gotoMatch: (direction: 1 | -1) => ReturnType;
      replaceMatch: (replacement: string) => ReturnType;
      replaceAllMatches: (replacement: string) => ReturnType;
    };
  }
}

export const searchKey = new PluginKey<SearchState>('docSearch');
const OBJECT_CHAR = '￼';
const EMPTY: SearchState = { term: '', options: { matchCase: false, wholeWord: false, regex: false }, results: [], index: -1, error: null };

const buildPattern = (term: string, options: SearchOptions) => {
  const source = options.regex ? term : term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const wrapped = options.wholeWord ? `(?<![\\p{L}\\p{N}_])${source}(?![\\p{L}\\p{N}_])` : source;
  return new RegExp(wrapped, `gu${options.matchCase ? '' : 'i'}`);
};

export function findMatches(doc: PMNode, term: string, options: SearchOptions): { results: SearchRange[]; error: string | null } {
  if (!term) return { results: [], error: null };
  let pattern: RegExp;
  try {
    pattern = buildPattern(term, options);
  } catch (error) {
    return { results: [], error: (error as Error).message };
  }
  const results: SearchRange[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    let text = '';
    const offsets: number[] = [];
    node.forEach((child, childOffset) => {
      const start = pos + 1 + childOffset;
      const chunk = child.isText ? child.text ?? '' : OBJECT_CHAR;
      for (let i = 0; i < chunk.length; i++) offsets.push(start + i);
      text += chunk;
    });
    offsets.push(pos + 1 + node.content.size);
    for (const match of text.matchAll(pattern)) {
      if (!match[0].length) continue;
      const start = match.index ?? 0;
      results.push({ from: offsets[start], to: offsets[start + match[0].length - 1] + 1 });
    }
    return false;
  });
  return { results, error: null };
}

const decorate = (doc: PMNode, state: SearchState) => DecorationSet.create(doc, state.results.map((range, i) => Decoration.inline(range.from, range.to, { class: i === state.index ? 'search-hit current' : 'search-hit' })));

const nearestIndex = (results: SearchRange[], position: number) => {
  const index = results.findIndex((range) => range.from >= position);
  return index >= 0 ? index : results.length ? 0 : -1;
};

export const SearchAndReplace = Extension.create({
  name: 'search',
  addProseMirrorPlugins() {
    return [new Plugin<SearchState>({
      key: searchKey,
      state: {
        init: () => EMPTY,
        apply(tr, previous, _old, newState) {
          const meta = tr.getMeta(searchKey) as Partial<SearchState> | undefined;
          if (!meta && !tr.docChanged) return previous;
          const next = { ...previous, ...meta };
          if (!next.term) return { ...EMPTY, options: next.options };
          const { results, error } = findMatches(newState.doc, next.term, next.options);
          const index = meta?.index !== undefined ? meta.index : Math.min(Math.max(next.index, 0), results.length - 1);
          return { ...next, results, error, index: results.length ? index : -1 };
        },
      },
      props: {
        decorations(state) {
          const current = searchKey.getState(state);
          return current?.results.length ? decorate(state.doc, current) : null;
        },
      },
    })];
  },
  addCommands() {
    return {
      setSearch: (term, options) => ({ state, tr, dispatch }) => {
        const previous = searchKey.getState(state) ?? EMPTY;
        const merged = { ...previous.options, ...options };
        const { results } = findMatches(state.doc, term, merged);
        if (dispatch) dispatch(tr.setMeta(searchKey, { term, options: merged, index: nearestIndex(results, state.selection.from) }));
        return true;
      },
      clearSearch: () => ({ tr, dispatch }) => {
        if (dispatch) dispatch(tr.setMeta(searchKey, { term: '', index: -1 }));
        return true;
      },
      gotoMatch: (direction) => ({ state, tr, dispatch, view }) => {
        const current = searchKey.getState(state);
        if (!current?.results.length) return false;
        const index = (current.index + direction + current.results.length) % current.results.length;
        const range = current.results[index];
        if (dispatch) {
          dispatch(tr.setMeta(searchKey, { index }).setSelection(TextSelection.create(tr.doc, range.from, range.to)).scrollIntoView());
          requestAnimationFrame(() => view.dom.querySelector('.search-hit.current')?.scrollIntoView({ block: 'center' }));
        }
        return true;
      },
      replaceMatch: (replacement) => ({ state, tr, dispatch }) => {
        const current = searchKey.getState(state);
        const range = current?.results[current.index];
        if (!current || !range) return false;
        if (dispatch) {
          tr.insertText(replacement, range.from, range.to);
          dispatch(tr.setMeta(searchKey, { index: current.index }));
        }
        return true;
      },
      replaceAllMatches: (replacement) => ({ state, tr, dispatch }) => {
        const current = searchKey.getState(state);
        if (!current?.results.length) return false;
        if (dispatch) {
          [...current.results].reverse().forEach((range) => tr.insertText(replacement, range.from, range.to));
          dispatch(tr.setMeta(searchKey, { index: 0 }));
        }
        return true;
      },
    };
  },
});
