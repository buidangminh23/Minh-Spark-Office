import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { gmailComposeUrl, inviteGroupBody, inviteLink, parseEmailList, parseInviteToken, PUBLIC_WEB_ORIGIN, shareOrigin, TEAM_ITEM_KINDS, teamTypeForKind } from '../src/lib/teams';

const ORIGIN = 'https://office.minhspark.com';
const TEAM_ID = 'T'.repeat(20);

describe('team invite helpers', () => {
  it('lists every recipient with their own link in a group invite', () => {
    const entries = [
      { email: 'a@congty.vn', link: inviteLink(ORIGIN, TEAM_ID, 'A'.repeat(24)) },
      { email: 'b@gmail.com', link: inviteLink(ORIGIN, TEAM_ID, 'B'.repeat(24)) },
    ];
    const body = inviteGroupBody({ teamName: 'Phòng Kỹ thuật', inviterName: 'Minh', role: 'editor', entries, expireAt: Date.UTC(2026, 10, 19) });
    assert.ok(body.includes(`a@congty.vn: ${entries[0].link}`));
    assert.ok(body.includes(`b@gmail.com: ${entries[1].link}`));
    assert.ok(body.includes('Phòng Kỹ thuật'));
  });

  it('puts all recipients into one Gmail compose window', () => {
    const url = new URL(gmailComposeUrl('a@congty.vn,b@gmail.com', 'Mời', 'Nội dung'));
    assert.equal(url.searchParams.get('to'), 'a@congty.vn,b@gmail.com');
    assert.equal(url.searchParams.get('view'), 'cm');
  });

  it('splits pasted lists and rejects invalid addresses', () => {
    assert.deepEqual(parseEmailList('A@congty.vn, b@gmail.com;sai-email a@congty.vn'), { valid: ['a@congty.vn', 'b@gmail.com'], invalid: ['sai-email'] });
  });

  it('round-trips invite tokens through the link', () => {
    const link = inviteLink(ORIGIN, TEAM_ID, 'A'.repeat(24));
    const token = new URL(link).searchParams.get('invite') ?? '';
    assert.deepEqual(parseInviteToken(token), { teamId: TEAM_ID, inviteId: 'A'.repeat(24) });
  });

  it('never builds invite links on the desktop app origin', () => {
    for (const origin of ['tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost', 'file:///Applications', 'not a url']) {
      assert.ok(inviteLink(origin, TEAM_ID, 'A'.repeat(24)).startsWith(`${PUBLIC_WEB_ORIGIN}/?invite=`), origin);
    }
  });

  it('keeps the public site and local development origins', () => {
    assert.equal(shareOrigin('https://office.minhspark.com'), 'https://office.minhspark.com');
    assert.equal(shareOrigin('https://preview-abc.vercel.app'), 'https://preview-abc.vercel.app');
    assert.equal(shareOrigin('http://localhost:5173'), 'http://localhost:5173');
    assert.equal(shareOrigin('http://127.0.0.1:4173'), 'http://127.0.0.1:4173');
  });

  it('lets teams share PDF files', () => {
    assert.ok(TEAM_ITEM_KINDS.includes('pdf'));
    assert.equal(teamTypeForKind('pdf'), 'template');
    assert.equal(teamTypeForKind('sheet'), 'document');
    assert.equal(teamTypeForKind('doc'), 'document');
  });
});
