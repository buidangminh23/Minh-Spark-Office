import type { AnyExtension } from '@tiptap/core';
import { CoverAttribute, DocField, DocFieldInfo, ESignField, FileObject, VideoEmbed } from './insertNodes';
import './insertImageEditors';

export const INSERT_EXTENSIONS: AnyExtension[] = [DocFieldInfo, DocField, VideoEmbed, FileObject, ESignField, CoverAttribute];
