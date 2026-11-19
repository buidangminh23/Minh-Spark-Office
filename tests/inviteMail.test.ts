import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildInviteMail, inviteSendable, inviteUrl, parseSendRequest, toInviteRecord, type InviteRecord } from '../api/_shared/inviteMail';
import { inviteLink, PUBLIC_WEB_ORIGIN } from '../src/lib/teams';

const TEAM = 'T'.repeat(20);
const INVITE = 'A'.repeat(24);
const NOW = Date.UTC(2026, 10, 19, 12);
const invite = (patch: Partial<InviteRecord> = {}): InviteRecord => ({
  id: INVITE, teamId: TEAM, email: 'a@congty.vn', role: 'editor', invitedBy: 'owner', invitedByName: 'Minh',
  teamName: 'Phòng <Kỹ thuật>', createdAt: NOW - 60_000, expireAt: NOW + 86_400_000, ...patch,
});

describe('automatic invite email', () => {
  it('accepts only well-formed requests for at most twenty invites', () => {
    assert.deepEqual(parseSendRequest({ teamId: TEAM, inviteIds: [INVITE, INVITE] }), { teamId: TEAM, inviteIds: [INVITE] });
    assert.equal(parseSendRequest({ teamId: TEAM, inviteIds: [] }), null);
    assert.equal(parseSendRequest({ teamId: 'short', inviteIds: [INVITE] }), null);
    assert.equal(parseSendRequest({ teamId: TEAM, inviteIds: ['../x'] }), null);
    const many = Array.from({ length: 21 }, (_, index) => `${String(index).padStart(2, '0')}${'A'.repeat(22)}`);
    assert.equal(parseSendRequest({ teamId: TEAM, inviteIds: many }), null);
  });

  it('reads the Firestore invite and rejects malformed records', () => {
    const fields = { email: { stringValue: 'a@congty.vn' }, role: { stringValue: 'viewer' }, invitedBy: { stringValue: 'owner' }, invitedByName: { stringValue: 'Minh' }, teamName: { stringValue: 'Nhóm' }, createdAt: { timestampValue: new Date(NOW).toISOString() }, expireAt: { timestampValue: new Date(NOW + 1000).toISOString() } };
    assert.equal(toInviteRecord(TEAM, INVITE, { fields })?.email, 'a@congty.vn');
    assert.equal(toInviteRecord(TEAM, INVITE, { fields: { ...fields, role: { stringValue: 'owner' } } }), null);
    assert.equal(toInviteRecord(TEAM, INVITE, { fields: { ...fields, email: { stringValue: 'not-an-email' } } }), null);
  });

  it('sends only the caller\'s own live invites', () => {
    assert.equal(inviteSendable(invite(), 'owner', NOW), true);
    assert.equal(inviteSendable(invite(), 'someone-else', NOW), false);
    assert.equal(inviteSendable(invite({ expireAt: NOW - 1 }), 'owner', NOW), false);
  });

  it('links to the same place as the in-app invite link and escapes the team name', () => {
    assert.equal(inviteUrl(invite()), inviteLink(PUBLIC_WEB_ORIGIN, TEAM, INVITE));
    const mail = buildInviteMail(invite(), 'Bùi Đăng Minh');
    assert.ok(mail.text.includes(inviteUrl(invite())));
    assert.ok(mail.html.includes('Phòng &lt;Kỹ thuật&gt;'));
    assert.ok(!mail.html.includes('<Kỹ thuật>'));
    assert.ok(mail.subject.includes('Bùi Đăng Minh'));
    assert.ok(mail.text.includes('Biên tập viên'));
  });
});
