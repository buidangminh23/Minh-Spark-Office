import { useState } from 'react';
import { Crown, LogOut, Save, Trash2 } from 'lucide-react';
import { useUi } from '../ui';
import { teamErrorMessage, type TeamStore } from '../../lib/teamStore';
import { can, ROLE_LABEL, TEAM_COLORS, type Team, type TeamMember, type TeamRole } from '../../lib/teams';
import { TeamAvatar, TmButton, TmField } from './TeamParts';

export function TeamSettings({ store, team, role, members, onLeft }: { store: TeamStore; team: Team; role: TeamRole; members: TeamMember[]; onLeft: () => void }) {
  const ui = useUi();
  const editable = can(role, 'editTeam');
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description);
  const [color, setColor] = useState(team.color);
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState('');
  const dirty = name.trim() !== team.name || description.trim() !== team.description || color !== team.color;
  const others = members.filter((member) => member.uid !== store.user.uid);

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await store.updateTeam(team, { name, description, color });
      ui.toast('Đã lưu thông tin nhóm.');
    } catch (failure) { ui.toast(teamErrorMessage(failure), true); }
    finally { setBusy(false); }
  };

  const transfer = async () => {
    const member = others.find((entry) => entry.uid === target);
    if (!member) return;
    if (!(await ui.confirm(`Chuyển quyền sở hữu cho ${member.name || member.email}?`, `Bạn sẽ thành ${ROLE_LABEL.admin}. Chỉ chủ sở hữu mới có thể chuyển quyền lại cho bạn.`))) return;
    setBusy(true);
    try {
      await store.transferOwnership(team, member);
      ui.toast('Đã chuyển quyền sở hữu.');
    } catch (failure) { ui.toast(teamErrorMessage(failure), true); }
    finally { setBusy(false); }
  };

  const leave = async () => {
    if (!(await ui.confirm(`Rời nhóm “${team.name}”?`, 'Bạn sẽ không còn thấy mẫu và tài liệu chung của nhóm. Muốn quay lại cần được mời lại.', true))) return;
    try {
      await store.leaveTeam(team.id);
      ui.toast('Bạn đã rời nhóm.');
      onLeft();
    } catch (failure) { ui.toast(teamErrorMessage(failure), true); }
  };

  const destroy = async () => {
    const values = await ui.ask({
      title: `Xoá vĩnh viễn nhóm “${team.name}”?`,
      message: 'Mọi mẫu, tài liệu chung, lời mời và thành viên của nhóm sẽ bị xoá và không khôi phục được. Bản sao trong kho riêng của từng người vẫn giữ nguyên.',
      fields: [{ name: 'confirm', label: 'Gõ chính xác tên nhóm để xác nhận', placeholder: team.name }],
      confirmText: 'Xoá nhóm',
      danger: true,
      validate: (input) => (String(input.confirm).trim() === team.name ? null : 'Tên nhóm chưa khớp.'),
    });
    if (!values) return;
    ui.showBusy('Đang xoá nhóm…');
    try {
      await store.deleteTeam(team);
      ui.toast('Đã xoá nhóm.');
      onLeft();
    } catch (failure) { ui.toast(teamErrorMessage(failure), true); }
    finally { ui.showBusy(null); }
  };

  return (
    <div className="tm-settings">
      <section className="tm-card" aria-labelledby="tm-info-title">
        <h2 id="tm-info-title">Thông tin nhóm</h2>
        <div className="tm-settings-info">
          <TeamAvatar name={name || team.name} color={color} size={64} />
          <div className="tm-settings-fields">
            <TmField label="Tên nhóm">
              <input className="tm-input" value={name} maxLength={80} disabled={!editable} onChange={(event) => setName(event.target.value)} />
            </TmField>
            <TmField label="Mô tả">
              <textarea className="tm-input" rows={3} value={description} maxLength={500} disabled={!editable} onChange={(event) => setDescription(event.target.value)} />
            </TmField>
            {editable && (
              <fieldset className="tm-field tm-colors">
                <legend className="tm-field-label">Màu nhận diện</legend>
                <div className="tm-swatches">
                  {TEAM_COLORS.map((value) => <button key={value} type="button" className={`tm-swatch ${value === color ? 'is-active' : ''}`} style={{ background: value }} aria-label={`Chọn màu ${value}`} aria-pressed={value === color} onClick={() => setColor(value)} />)}
                </div>
              </fieldset>
            )}
            {editable ? (
              <div className="tm-form-actions"><TmButton variant="primary" icon={<Save size={16} aria-hidden="true" />} disabled={!dirty || !name.trim() || busy} onClick={() => void save()}>Lưu thay đổi</TmButton></div>
            ) : <p className="tm-muted">Chỉ chủ sở hữu được đổi thông tin nhóm.</p>}
          </div>
        </div>
      </section>

      {can(role, 'transferOwnership') && (
        <section className="tm-card" aria-labelledby="tm-transfer-title">
          <h2 id="tm-transfer-title">Chuyển quyền sở hữu</h2>
          <p className="tm-muted">Người nhận trở thành chủ sở hữu duy nhất; bạn chuyển thành quản trị viên.</p>
          <div className="tm-inline-form">
            <select className="tm-input" value={target} aria-label="Chọn người nhận quyền sở hữu" onChange={(event) => setTarget(event.target.value)}>
              <option value="">Chọn thành viên…</option>
              {others.map((member) => <option key={member.uid} value={member.uid}>{member.name || member.email} — {ROLE_LABEL[member.role]}</option>)}
            </select>
            <TmButton icon={<Crown size={16} aria-hidden="true" />} disabled={!target || busy} onClick={() => void transfer()}>Chuyển quyền</TmButton>
          </div>
        </section>
      )}

      <section className="tm-card tm-danger-zone" aria-labelledby="tm-danger-title">
        <h2 id="tm-danger-title">Vùng nguy hiểm</h2>
        {role !== 'owner' && (
          <div className="tm-danger-row">
            <div><strong>Rời nhóm</strong><span>Bạn mất quyền truy cập ngay. Bản sao riêng của bạn vẫn còn.</span></div>
            <TmButton variant="danger" icon={<LogOut size={16} aria-hidden="true" />} onClick={() => void leave()}>Rời nhóm</TmButton>
          </div>
        )}
        {can(role, 'deleteTeam') ? (
          <div className="tm-danger-row">
            <div><strong>Xoá nhóm</strong><span>Xoá vĩnh viễn nhóm cùng mọi mẫu và tài liệu chung.</span></div>
            <TmButton variant="danger" icon={<Trash2 size={16} aria-hidden="true" />} onClick={() => void destroy()}>Xoá nhóm</TmButton>
          </div>
        ) : null}
        {role === 'owner' && <p className="tm-muted">Muốn rời nhóm, hãy chuyển quyền sở hữu cho người khác trước.</p>}
      </section>
    </div>
  );
}
