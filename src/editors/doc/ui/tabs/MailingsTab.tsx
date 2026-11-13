import { AlertTriangle, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Database, Download, Eye, FileStack, Highlighter, ListChecks, Mail, MapPin, PencilLine, Printer, RefreshCw, Search, Send, Settings2, Tag, Users, Wand2, FilePlus2 } from 'lucide-react';
import { useDoc } from '../../DocContext';
import { MERGE_TYPES, activeRecords, type BlockKind } from '../../mailMerge';
import { finishMerge } from '../../mailingsRun';
import { updateLabels } from '../MailDialogs';
import { setRuleKind } from '../MergeDialogs';
import { Big, Dropdown, Group, MenuHeading, MenuItem, MenuSeparator, Rows, Small } from '../RibbonParts';

const RULES: { kind: BlockKind; label: string }[] = [
  { kind: 'if', label: 'Nếu…Thì…Không thì…' }, { kind: 'skipif', label: 'Bỏ qua bản ghi nếu…' }, { kind: 'nextif', label: 'Bản ghi tiếp nếu…' },
  { kind: 'next', label: 'Bản ghi tiếp' }, { kind: 'recnum', label: 'Số bản ghi' }, { kind: 'seqnum', label: 'Số thứ tự trộn' }, { kind: 'fillin', label: 'Điền khi trộn…' },
];

export default function MailingsTab() {
  const ctx = useDoc();
  const { merge, mergePreview, setMergePreview, editor, view, setView, page } = ctx;
  const total = merge ? activeRecords(merge).length : 0;
  const type = page.mergeType ?? 'letters';
  const need = (run: () => void) => () => (merge ? run() : ctx.ui.toast('Hãy chọn danh sách người nhận trước', true));
  const goto = (index: number) => setMergePreview(Math.max(0, Math.min(total - 1, index)));
  const muted = merge ? '#2b579a' : '#9aa3b2';
  return (
    <>
      <Group label="Tạo">
        <Big icon={<Mail size={22} color="#2b579a" />} label="Phong bì" title="Tạo và in phong bì" onClick={() => ctx.openDialog('envelopes')} />
        <Big icon={<Tag size={22} color="#2b579a" />} label="Nhãn" title="Tạo và in nhãn địa chỉ" onClick={() => ctx.openDialog('labels')} />
      </Group>
      <Group label="Bắt đầu trộn thư">
        <Dropdown large title="Bắt đầu trộn thư" trigger={<><FileStack size={22} color="#2b579a" /><span>Bắt đầu trộn</span></>} width={300}>
          {(close) => (
            <>
              {MERGE_TYPES.map((item) => <MenuItem key={item.id} active={type === item.id} label={<span><strong>{item.label}</strong><br /><small>{item.detail}</small></span>} onClick={() => {
                close();
                ctx.setPage({ mergeType: item.id });
                if (item.id === 'envelopes') ctx.openDialog('envelopes');
                if (item.id === 'labels') ctx.openDialog('labels');
              }} />)}
              <MenuSeparator />
              <MenuItem icon={<Wand2 size={14} />} label="Trộn thư từng bước…" onClick={() => { close(); ctx.openDialog('mergewizard'); }} />
            </>
          )}
        </Dropdown>
        <Big icon={<Database size={22} color="#2b579a" />} label="Chọn danh sách" title="Chọn danh sách người nhận (CSV, Excel hoặc 23 Sheets)" onClick={() => ctx.openDialog('mailmerge')} />
        <Big icon={<Users size={22} color={muted} />} label="Sửa danh sách" title="Chọn, lọc, sắp xếp và sửa người nhận" disabled={!merge} onClick={() => ctx.openDialog('mergerecipients')} />
      </Group>
      <Group label="Soạn & chèn trường">
        <Big icon={<Highlighter size={22} color={muted} />} label="Tô sáng trường" title="Tô vàng mọi trường trộn trong tài liệu" active={view.highlightMerge} onClick={() => setView({ highlightMerge: !view.highlightMerge })} />
        <Big icon={<MapPin size={22} color={muted} />} label="Khối địa chỉ" title="Chèn địa chỉ người nhận đã định dạng" onClick={need(() => ctx.openDialog('mergeaddress'))} />
        <Big icon={<Wand2 size={22} color={muted} />} label="Dòng chào" title="Chèn lời chào như “Kính gửi Ông Nguyễn Văn A,”" onClick={need(() => ctx.openDialog('mergegreeting'))} />
        <Dropdown large title="Chèn trường trộn" trigger={<><PencilLine size={22} color={muted} /><span>Chèn trường</span></>}>
          {(close) => merge ? merge.headers.map((h) => <MenuItem key={h} label={`«${h}»`} onClick={() => { close(); editor.chain().focus().insertMergeField(h).run(); }} />) : <div className="ribbon-menu-empty">Hãy chọn danh sách người nhận trước.</div>}
        </Dropdown>
        <Rows>
          <Dropdown title="Quy tắc" trigger={<><ListChecks size={14} /><span>Quy tắc</span></>} width={240}>
            {(close) => RULES.map((rule) => <MenuItem key={rule.kind} label={rule.label} onClick={() => { close(); setRuleKind(rule.kind); ctx.openDialog('mergerule'); }} />)}
          </Dropdown>
          <Small icon={<Settings2 size={14} />} label="Khớp trường" title="Ghép cột trong danh sách với Họ tên, Địa chỉ…" disabled={!merge} onClick={() => ctx.openDialog('mergematch')} />
          <Small icon={<RefreshCw size={14} />} label="Cập nhật nhãn" title="Chép nhãn đầu tiên sang mọi nhãn" disabled={type !== 'labels'} onClick={() => updateLabels(ctx)} />
        </Rows>
      </Group>
      <Group label="Xem trước">
        <Big icon={<Eye size={22} color={muted} />} label="Xem kết quả" title="Hiện dữ liệu thật thay cho «trường»" active={mergePreview !== null} disabled={!merge} onClick={() => setMergePreview(mergePreview === null ? 0 : null)} />
        <Rows>
          <div className="merge-nav">
            <Small icon={<ChevronFirst size={14} />} title="Bản ghi đầu" disabled={!total || mergePreview === null || mergePreview <= 0} onClick={() => goto(0)} />
            <Small icon={<ChevronLeft size={14} />} title="Bản ghi trước" disabled={!total || mergePreview === null || mergePreview <= 0} onClick={() => goto((mergePreview ?? 0) - 1)} />
            <input className="ribbon-select merge-record" aria-label="Số bản ghi" type="number" min={1} max={total || 1} disabled={!total} value={mergePreview === null ? '' : mergePreview + 1} placeholder="—" onChange={(e) => { const n = Number(e.target.value); if (n >= 1) goto(n - 1); }} />
            <Small icon={<ChevronRight size={14} />} title="Bản ghi sau" disabled={!total || mergePreview === null || mergePreview >= total - 1} onClick={() => goto((mergePreview ?? -1) + 1)} />
            <Small icon={<ChevronLast size={14} />} title="Bản ghi cuối" disabled={!total || mergePreview === null || mergePreview >= total - 1} onClick={() => goto(total - 1)} />
          </div>
          <Small icon={<Search size={14} />} label="Tìm người nhận" title="Tìm và xem bản ghi" disabled={!merge} onClick={() => ctx.openDialog('mergefind')} />
          <Small icon={<AlertTriangle size={14} />} label="Kiểm tra lỗi" title="Kiểm tra trường thiếu, dữ liệu trống, email sai" disabled={!merge} onClick={() => ctx.openDialog('mergecheck')} />
        </Rows>
      </Group>
      <Group label="Hoàn tất">
        <Dropdown large title="Hoàn tất & trộn" trigger={<><Send size={22} color={merge ? '#107c41' : '#9aa3b2'} /><span>Hoàn tất & trộn</span></>} width={300}>
          {(close) => merge ? (
            <>
              <MenuHeading>{total} người nhận</MenuHeading>
              <MenuItem icon={<FilePlus2 size={14} />} label="Sửa từng tài liệu: tạo tài liệu mới chứa mọi bản" onClick={() => { close(); void finishMerge(ctx, 'single'); }} />
              <MenuItem icon={<Printer size={14} />} label="In tài liệu…" onClick={() => { close(); void finishMerge(ctx, 'print'); }} />
              <MenuItem icon={<Send size={14} />} label="Gửi email…" onClick={() => { close(); ctx.openDialog('mergeemail'); }} />
              <MenuSeparator />
              <MenuItem icon={<Download size={14} />} label="Tải mỗi bản thành một .docx" onClick={() => { close(); void finishMerge(ctx, 'files'); }} />
            </>
          ) : <div className="ribbon-menu-empty">Hãy chọn danh sách người nhận trước.</div>}
        </Dropdown>
      </Group>
    </>
  );
}
