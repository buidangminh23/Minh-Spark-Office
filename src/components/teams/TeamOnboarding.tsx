import { useState } from 'react';
import { Building2, FilePlus2, MailPlus, ShieldCheck, Users } from 'lucide-react';
import { TEAM_COLORS } from '../../lib/teams';
import { TeamAvatar, TmButton, TmField } from './TeamParts';

const STEPS = [
  { icon: <Building2 size={20} />, title: 'Tạo nhóm hoặc tổ chức', text: 'Đặt tên cho phòng ban, công ty hay dự án. Bạn là chủ sở hữu.' },
  { icon: <MailPlus size={20} />, title: 'Mời đồng nghiệp qua email', text: 'Mỗi lời mời gắn với một email và hết hạn sau 7 ngày.' },
  { icon: <FilePlus2 size={20} />, title: 'Chia sẻ mẫu, sửa chung', text: 'Đăng mẫu văn bản, bảng tính, slide để cả nhóm dùng và cùng chỉnh sửa.' },
  { icon: <ShieldCheck size={20} />, title: 'Phân quyền rõ ràng', text: 'Chủ sở hữu, quản trị, biên tập, người xem — máy chủ kiểm từng thao tác.' },
];

export function TeamCreateForm({ onCreate, onCancel, busy }: { onCreate: (input: { name: string; description: string; color: string }) => void; onCancel?: () => void; busy: boolean }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<string>(TEAM_COLORS[0]);
  const trimmed = name.trim();
  return (
    <form className="tm-create-form" onSubmit={(event) => { event.preventDefault(); if (trimmed) onCreate({ name: trimmed, description, color }); }}>
      <div className="tm-create-preview">
        <TeamAvatar name={trimmed || 'Nhóm mới'} color={color} size={56} />
        <div>
          <strong>{trimmed || 'Tên nhóm của bạn'}</strong>
          <span>{description.trim() || 'Mô tả ngắn về nhóm'}</span>
        </div>
      </div>
      <TmField label="Tên nhóm hoặc tổ chức">
        <input className="tm-input" value={name} maxLength={80} required autoFocus placeholder="Ví dụ: Phòng Kỹ thuật – Công ty Sông Hồng" onChange={(event) => setName(event.target.value)} />
      </TmField>
      <TmField label="Mô tả" hint="Không bắt buộc. Hiện cho mọi thành viên.">
        <textarea className="tm-input" rows={3} value={description} maxLength={500} placeholder="Nhóm dùng chung mẫu biên bản, bảng dự toán, báo cáo…" onChange={(event) => setDescription(event.target.value)} />
      </TmField>
      <fieldset className="tm-field tm-colors">
        <legend className="tm-field-label">Màu nhận diện</legend>
        <div className="tm-swatches">
          {TEAM_COLORS.map((value) => (
            <button key={value} type="button" className={`tm-swatch ${value === color ? 'is-active' : ''}`} style={{ background: value }} aria-label={`Chọn màu ${value}`} aria-pressed={value === color} onClick={() => setColor(value)} />
          ))}
        </div>
      </fieldset>
      <div className="tm-form-actions">
        {onCancel && <TmButton onClick={onCancel} disabled={busy}>Hủy</TmButton>}
        <TmButton type="submit" variant="primary" disabled={!trimmed || busy}>{busy ? 'Đang tạo…' : 'Tạo nhóm'}</TmButton>
      </div>
    </form>
  );
}

export function TeamOnboarding({ onCreate, busy }: { onCreate: (input: { name: string; description: string; color: string }) => void; busy: boolean }) {
  return (
    <div className="tm-onboarding">
      <section className="tm-onboarding-intro">
        <span className="tm-eyebrow"><Users size={16} aria-hidden="true" />Làm việc nhóm</span>
        <h1>Cùng nhau soạn thảo, dùng chung mẫu</h1>
        <p>Tạo một nhóm cho phòng ban hoặc tổ chức của bạn, mời mọi người bằng email, rồi chia sẻ mẫu và cùng chỉnh sửa tài liệu theo thời gian thực.</p>
        <ol className="tm-steps">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <span className="tm-step-icon" aria-hidden="true">{step.icon}</span>
              <div>
                <strong><span className="tm-step-no">{index + 1}</span>{step.title}</strong>
                <span>{step.text}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section className="tm-card tm-onboarding-form" aria-labelledby="tm-create-title">
        <h2 id="tm-create-title">Tạo nhóm đầu tiên</h2>
        <TeamCreateForm onCreate={onCreate} busy={busy} />
      </section>
    </div>
  );
}
