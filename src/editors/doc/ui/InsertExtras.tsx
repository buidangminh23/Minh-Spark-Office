import { useEffect } from 'react';
import { useDoc, type DialogId } from '../DocContext';
import { setFieldInfo } from '../insertNodes';
import { IconsDialog, Model3dDialog, SmartArtDialog, WordArtDialog } from './insert/GraphicDialogs';
import { BookmarksDialog, DateTimeDialog, DrawTableDialog, DropCapDialog, EsignDialog, FieldsDialog, ObjectDialog, PageNumberDialog, QuickPartsDialog, VideoDialog } from './insert/TextDialogs';

export default function InsertExtras({ dialog, onClose }: { dialog: DialogId | null; onClose: () => void }) {
  const { editor, title, page } = useDoc();
  useEffect(() => {
    setFieldInfo(editor, { title, properties: page.properties ?? {} });
  }, [editor, title, page.properties]);
  switch (dialog) {
    case 'smartart': return <SmartArtDialog onClose={onClose} />;
    case 'wordart': return <WordArtDialog onClose={onClose} />;
    case 'icons': return <IconsDialog onClose={onClose} />;
    case 'model3d': return <Model3dDialog onClose={onClose} />;
    case 'video': return <VideoDialog onClose={onClose} />;
    case 'object': return <ObjectDialog onClose={onClose} />;
    case 'bookmarks': return <BookmarksDialog onClose={onClose} />;
    case 'quickparts': return <QuickPartsDialog onClose={onClose} />;
    case 'fields': return <FieldsDialog onClose={onClose} />;
    case 'datetime': return <DateTimeDialog onClose={onClose} />;
    case 'dropcap': return <DropCapDialog onClose={onClose} />;
    case 'pagenumber': return <PageNumberDialog onClose={onClose} />;
    case 'drawtable': return <DrawTableDialog onClose={onClose} />;
    case 'esign': return <EsignDialog onClose={onClose} />;
    default: return null;
  }
}
