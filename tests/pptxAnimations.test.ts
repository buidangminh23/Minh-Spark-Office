import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import { importFromPptx } from '../src/lib/pptxImport.ts';
import { buildAnimationTimeline, hiddenElementIds, matchMorphElements } from '../src/lib/slideEffects.ts';

const shape = (id: number, name: string, text: string, y: number) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="914400" y="${y}"/><a:ext cx="3657600" cy="914400"/></a:xfrm><a:prstGeom prst="rect"/></p:spPr><p:txBody><a:bodyPr/><a:p><a:r><a:t>${text}</a:t></a:r></a:p><a:p><a:r><a:t>${text} 2</a:t></a:r></a:p></p:txBody></p:sp>`;

const morph = '<mc:AlternateContent xmlns:mc="mc"><mc:Choice xmlns:p159="p159" Requires="p159"><p:transition spd="slow" p14:dur="900"><p159:morph option="byObject"/></p:transition></mc:Choice><mc:Fallback><p:transition spd="slow"><p:fade/></p:transition></mc:Fallback></mc:AlternateContent>';

const effect = (id: number, presetId: number, cls: string, spid: number, delay: number, extra = '', para?: number) => {
  const tgt = para === undefined ? `<p:spTgt spid="${spid}"/>` : `<p:spTgt spid="${spid}"><p:txEl><p:pRg st="${para}" end="${para}"/></p:txEl></p:spTgt>`;
  return `<p:par><p:cTn id="${id}" presetID="${presetId}" presetClass="${cls}" presetSubtype="8" fill="hold" nodeType="withEffect"${extra}><p:stCondLst><p:cond delay="${delay}"/></p:stCondLst><p:childTnLst><p:set><p:cBhvr><p:cTn id="${id + 100}" dur="1"/><p:tgtEl>${tgt}</p:tgtEl></p:cBhvr></p:set><p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="${id + 200}" dur="600"/><p:tgtEl>${tgt}</p:tgtEl></p:cBhvr></p:animEffect></p:childTnLst></p:cTn></p:par>`;
};

const timing = (effects: string) =>
  `<p:timing><p:tnLst><p:par><p:cTn id="1" nodeType="tmRoot"><p:childTnLst><p:seq><p:cTn id="2" nodeType="mainSeq"><p:childTnLst><p:par><p:cTn id="3"><p:childTnLst><p:par><p:cTn id="4"><p:childTnLst>${effects}</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:seq></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>`;

async function deck(slides: string[]): Promise<ArrayBuffer> {
  const zip = new JSZip();
  const ids = slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join('');
  zip.file('ppt/presentation.xml', `<p:presentation xmlns:p="p" xmlns:r="r"><p:sldIdLst>${ids}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/></p:presentation>`);
  zip.file('ppt/_rels/presentation.xml.rels', `<Relationships>${slides.map((_, i) => `<Relationship Id="rId${i + 2}" Type="http://x/slide" Target="slides/slide${i + 1}.xml"/>`).join('')}</Relationships>`);
  slides.forEach((body, i) => {
    zip.file(`ppt/slides/slide${i + 1}.xml`, `<p:sld xmlns:p="p" xmlns:a="a" xmlns:p14="p14"><p:cSld><p:spTree>${body}`);
  });
  return zip.generateAsync({ type: 'arraybuffer' });
}

test('morph transitions, !! names and entrance animations from generated decks are imported', async () => {
  const first = `${shape(2, '!!title', 'Tên nhóm', 457200)}</p:spTree></p:cSld></p:sld>`;
  const second = `${shape(2, '!!title', 'Thành viên', 914400)}${shape(5, 'TextBox 5', 'Ý chính', 2743200)}${shape(7, '!!btn', 'Bắt đầu', 4572000)}</p:spTree></p:cSld>${morph}`
    + timing(effect(10, 2, 'entr', 5, 0, '', 0) + effect(11, 2, 'entr', 5, 220, '', 1) + effect(12, 53, 'entr', 7, 300) + effect(13, 6, 'emph', 7, 1250, ' repeatCount="2000" autoRev="1"'))
    + '</p:sld>';
  const presentation = await importFromPptx(await deck([first, second]), 'nhom.pptx');
  const [one, two] = presentation.slides;

  assert.equal(two.transition.type, 'morph');
  assert.equal(two.transition.morphMode, 'objects');
  assert.equal(two.transition.duration, 0.9);

  const titleBefore = one.elements.find((el) => el.name === '!!title');
  const titleAfter = two.elements.find((el) => el.name === '!!title');
  assert.ok(titleBefore && titleAfter);
  assert.ok(matchMorphElements(one.elements, two.elements)[titleAfter.id], 'titles with the same !! name pair across slides');

  const bullets = two.elements.find((el) => el.text?.startsWith('Ý chính'));
  assert.equal(bullets?.animations?.length, 1);
  assert.deepEqual(
    { type: bullets?.animations?.[0].type, direction: bullets?.animations?.[0].direction, text: bullets?.animations?.[0].animateText, trigger: bullets?.animations?.[0].trigger },
    { type: 'fly-in', direction: 'left', text: 'paragraph', trigger: 'with-previous' }
  );

  const button = two.elements.find((el) => el.name === '!!btn');
  assert.deepEqual(button?.animations?.map((anim) => [anim.type, anim.category, anim.delay]), [
    ['basic-zoom-in', 'entrance', 0.3],
    ['pulse', 'emphasis', 1.25],
  ]);
  assert.equal(button?.animations?.[1].repeat, 2);
  assert.equal(button?.animations?.[1].autoReverse, true);
  assert.equal(titleAfter.animations, undefined);

  const steps = buildAnimationTimeline(two.elements);
  assert.equal(steps.length, 1, 'every effect plays automatically when the slide opens');
  assert.deepEqual(hiddenElementIds(steps, 0, false).sort(), [bullets!.id, button!.id].sort());
  assert.deepEqual(hiddenElementIds(steps, 0, true), []);
});

test('slides without timing keep their elements static and unknown transitions still fall back to fade', async () => {
  const only = `${shape(2, 'Title 1', 'Một', 457200)}</p:spTree></p:cSld><p:transition><p:unknownEffect/></p:transition></p:sld>`;
  const [slide] = (await importFromPptx(await deck([only]), 'tinh.pptx')).slides;
  assert.equal(slide.transition.type, 'fade');
  assert.equal(slide.transition.morphMode, undefined);
  assert.equal(slide.elements[0].animations, undefined);
  assert.equal(slide.elements[0].name, undefined);
});
