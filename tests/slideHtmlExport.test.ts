import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { buildStandaloneHtml, serializeJsonForHtml } from '../src/lib/slideHtmlExport.ts';
import type { PresentationData } from '../src/lib/slideTypes.ts';

const HOSTILE_TEXT = 'Tiêu đề </script><script>alert(1)</script> <!-- & \u2028 end';

const deck = (): PresentationData => ({
  aspectRatio: '16:9',
  themeId: 'default',
  title: 'Báo cáo <Q4> & "kế hoạch"',
  slides: [
    {
      id: 's1',
      layout: 'title',
      background: { type: 'gradient', value: 'linear-gradient(135deg, #0072FF 0%, #00C6FF 100%)' },
      elements: [
        { id: 'e1', type: 'text', x: 10, y: 10, width: 80, height: 20, text: HOSTILE_TEXT },
        { id: 'e2', type: 'table', x: 10, y: 40, width: 80, height: 40, tableData: [['A', 'B'], ['1', '2']] },
      ],
      notes: '',
      transition: { type: 'none', duration: 0.5 },
    },
    {
      id: 's2',
      layout: 'blank',
      background: { type: 'solid', value: '#FFFFFF' },
      elements: [],
      notes: '',
      transition: { type: 'none', duration: 0.5 },
      hidden: true,
    },
  ],
});

function extractScripts(html: string) {
  const data = /<script type="application\/json" id="deck-data">([\s\S]*?)<\/script>/.exec(html);
  const player = /<script>([\s\S]*?)<\/script>/.exec(html);
  assert.ok(data, 'deck data script is present');
  assert.ok(player, 'player script is present');
  return { data: data[1], player: player[1] };
}

class FakeNode {
  children: FakeNode[] = [];
  style: Record<string, string> = {};
  className = '';
  textContent = '';
  onclick: (() => void) | null = null;
  constructor(public tagName: string) {}
  appendChild(child: FakeNode) {
    this.children.push(child);
    return child;
  }
  set innerHTML(_value: string) {
    this.children = [];
  }
}

test('serializeJsonForHtml never emits markup that can close a script element', () => {
  const encoded = serializeJsonForHtml({ text: HOSTILE_TEXT });
  assert.ok(!encoded.includes('<'));
  assert.ok(!encoded.includes('>'));
  assert.ok(!encoded.includes('\u2028'));
  assert.deepEqual(JSON.parse(encoded), { text: HOSTILE_TEXT });
});

test('standalone HTML embeds the real deck and has no unresolved template placeholders', () => {
  const presentation = deck();
  const html = buildStandaloneHtml(presentation);
  assert.ok(!html.includes('${'), 'no literal template placeholders');
  assert.equal(html.match(/<\/script/gi)?.length, 2, 'only the two real script closers exist');
  assert.ok(html.includes('<title>Báo cáo &lt;Q4&gt; &amp; &quot;kế hoạch&quot;</title>'));
  const { data, player } = extractScripts(html);
  const parsed = JSON.parse(data) as { aspectRatio: string; slides: PresentationData['slides'] };
  assert.deepEqual(parsed.slides, presentation.slides);
  assert.equal(parsed.aspectRatio, '16:9');
  assert.doesNotThrow(() => new vm.Script(player));
});

test('standalone HTML player renders visible slides and skips hidden ones', () => {
  const html = buildStandaloneHtml(deck());
  const { data, player } = extractScripts(html);
  const nodes: Record<string, FakeNode> = {
    'deck-data': Object.assign(new FakeNode('script'), { textContent: data }),
    stage: new FakeNode('div'),
    pageIndicator: new FakeNode('span'),
    prevBtn: new FakeNode('button'),
    nextBtn: new FakeNode('button'),
  };
  const windowStub: { onkeydown?: (e: { key: string }) => void } = {};
  const context = vm.createContext({
    document: {
      getElementById: (id: string) => nodes[id],
      createElement: (tag: string) => new FakeNode(tag),
    },
    window: windowStub,
    JSON,
    String,
  });
  new vm.Script(player).runInContext(context);
  assert.equal(nodes.pageIndicator.textContent, '1 / 1');
  assert.equal(nodes.stage.children.length, 2);
  assert.equal(nodes.stage.children[0].textContent, HOSTILE_TEXT);
  assert.match(nodes.stage.style.background, /linear-gradient/);
  const table = nodes.stage.children[1].children[0];
  assert.equal(table.tagName, 'table');
  assert.equal(table.children[1].children[1].textContent, '2');
});
