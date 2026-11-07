import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const SHELL_SCRIPTS = ['public/install-macos.sh', 'scripts/build-macos.sh'];
const CARRIAGE_RETURN = '\r';

test('shell scripts keep LF line endings in the working tree and in git archives', () => {
  for (const script of SHELL_SCRIPTS) {
    const working = readFileSync(new URL(`../${script}`, import.meta.url), 'utf8');
    assert.ok(!working.includes(CARRIAGE_RETURN), `${script} has CRLF in the working tree`);
    const attribute = execFileSync('git', ['check-attr', 'eol', '--', script], { encoding: 'utf8' });
    assert.match(attribute, /eol: lf/, `${script} is not pinned to eol=lf`);
  }
});
