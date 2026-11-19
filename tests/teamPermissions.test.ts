import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { can, type TeamRole } from '../src/lib/teams';

const roles: TeamRole[] = ['owner', 'admin', 'editor', 'viewer'];

describe('team permissions', () => {
  it('lets every member edit shared documents without asking for a higher role', () => {
    for (const role of roles) assert.equal(can(role, 'editDocument'), true, role);
  });

  it('keeps publishing templates and shared documents to editors and above', () => {
    assert.deepEqual(roles.filter((role) => can(role, 'publish')), ['owner', 'admin', 'editor']);
  });
});
