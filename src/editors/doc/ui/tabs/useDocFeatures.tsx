import { Combine, FileDown, FileImage, FileSignature, MonitorPlay, PenTool, QrCode, Split } from 'lucide-react';
import { useMemo } from 'react';
import { useDoc } from '../../DocContext';
import { mergeDocument, splitDocument } from '../../actions';
import { exportFormat } from '../../exportFormats';
import type { FeatureItem } from '../../../../components/FeatureMenu';

export function useDocFeatures(): FeatureItem[] {
  const ctx = useDoc();
  return useMemo(() => [
    { id: 'save-pdf', group: '23 PDF', label: 'Lưu PDF', description: 'Lưu tài liệu thành PDF qua hộp thoại in', icon: <FileDown size={16} color="#d7473c" />, run: ctx.print },
    { id: 'split', group: '23 PDF', label: 'Tách tài liệu', description: 'Tách theo tiêu đề thành nhiều tệp', icon: <Split size={16} color="#d98e04" />, run: () => void splitDocument(ctx) },
    { id: 'merge', group: '23 PDF', label: 'Ghép tài liệu', description: 'Ghép thêm tệp vào cuối tài liệu', icon: <Combine size={16} color="#0891b2" />, run: () => void mergeDocument(ctx) },
    { id: 'to-png', group: 'Chuyển đổi', label: 'Xuất thành ảnh', description: 'Xuất từng trang thành ảnh PNG', icon: <FileImage size={16} color="#107c41" />, run: () => void exportFormat(ctx, 'png') },
    { id: 'to-slides', group: 'Chuyển đổi', label: 'Tạo bài thuyết trình', description: 'Dựng slide PowerPoint từ các tiêu đề', icon: <MonitorPlay size={16} color="#ea580c" />, run: () => void exportFormat(ctx, 'pptx') },
    { id: 'sign', group: 'Chữ ký', label: 'Ký tên', description: 'Vẽ chữ ký tay và chèn vào tài liệu', icon: <PenTool size={16} color="#4338ca" />, run: () => ctx.openDialog('signature') },
    { id: 'esign', group: 'Chữ ký', label: 'Trường chữ ký điện tử', description: 'Đặt ô chữ ký, tên, ngày cho từng người ký', icon: <FileSignature size={16} color="#2b579a" />, run: () => { ctx.setEditing(null); ctx.openDialog('esign'); } },
    { id: 'qr', group: 'Chèn nhanh', label: 'Mã QR', description: 'Tạo mã QR từ đường dẫn hoặc nội dung', icon: <QrCode size={16} color="#0f172a" />, run: () => ctx.openDialog('qr') },
  ], [ctx]);
}
