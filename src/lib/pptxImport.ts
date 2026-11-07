import JSZip from 'jszip';
import type { PresentationData, SlideData } from './slideTypes';
import { createSlideFromLayout } from './slideTemplates';

export async function importFromPptx(
  buffer: ArrayBuffer,
  fileName: string
): Promise<PresentationData> {
  const zip = await JSZip.loadAsync(buffer);

  // Find all slide XML files
  const slideFileNames: string[] = [];
  zip.forEach((relativePath) => {
    if (/^ppt\/slides\/slide\d+\.xml$/i.test(relativePath)) {
      slideFileNames.push(relativePath);
    }
  });

  // Sort slides numerically: slide1.xml, slide2.xml...
  slideFileNames.sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)![0], 10);
    const numB = parseInt(b.match(/\d+/)![0], 10);
    return numA - numB;
  });

  if (slideFileNames.length === 0) {
    // If not a standard PPTX XML zip or no slides found, return a default presentation with the file name
    const defaultPres = createSlideFromLayout('title', 0, 'office-classic', fileName.replace(/\.[^/.]+$/, ''));
    return {
      aspectRatio: '16:9',
      themeId: 'office-classic',
      title: fileName,
      slides: [defaultPres],
    };
  }

  const slides: SlideData[] = [];

  for (let idx = 0; idx < slideFileNames.length; idx++) {
    const slidePath = slideFileNames[idx];
    const xmlText = await zip.file(slidePath)?.async('string');
    if (!xmlText) continue;

    // Parse XML using DOMParser
    let parser: DOMParser;
    if (typeof DOMParser !== 'undefined') {
      parser = new DOMParser();
    } else {
      // Fallback regex extraction if in test/node environment
      parser = null as any;
    }

    const textBlocks: string[] = [];
    if (parser) {
      const doc = parser.parseFromString(xmlText, 'application/xml');
      // Extract paragraphs
      const paragraphs = doc.getElementsByTagName('a:p');
      for (let p = 0; p < paragraphs.length; p++) {
        const textRuns = paragraphs[p].getElementsByTagName('a:t');
        let pText = '';
        for (let r = 0; r < textRuns.length; r++) {
          pText += textRuns[r].textContent || '';
        }
        if (pText.trim()) {
          textBlocks.push(pText.trim());
        }
      }
    } else {
      // Regex fallback
      const matches = xmlText.match(/<a:t>([^<]+)<\/a:t>/g) || [];
      const extracted = matches.map((m) => m.replace(/<\/?a:t>/g, '').trim()).filter(Boolean);
      if (extracted.length > 0) {
        textBlocks.push(...extracted);
      }
    }

    // Try to load corresponding notesSlide
    let notes = '';
    const notesFile = zip.file(`ppt/notesSlides/notesSlide${idx + 1}.xml`);
    if (notesFile) {
      const notesXml = await notesFile.async('string');
      const noteMatches = notesXml.match(/<a:t>([^<]+)<\/a:t>/g) || [];
      notes = noteMatches.map((m) => m.replace(/<\/?a:t>/g, '').trim()).join(' ');
    }

    const titleText = textBlocks[0] || (idx === 0 ? 'TRANG BÌA' : `Trang chiếu ${idx + 1}`);
    const bodyTexts = textBlocks.slice(1);

    const slide: SlideData = {
      id: `imported-slide-${idx + 1}-${Date.now()}`,
      layout: idx === 0 ? 'title' : 'title-content',
      background: {
        type: 'solid',
        value: '#FFFFFF',
      },
      transition: {
        type: 'none',
        duration: 0.5,
      },
      notes,
      elements: [],
    };

    if (idx === 0) {
      slide.elements.push({
        id: `el-title-${idx}`,
        type: 'text',
        x: 10,
        y: 30,
        width: 80,
        height: 24,
        text: titleText,
        fontSize: 40,
        fontWeight: 'bold',
        color: '#D83B01',
        textAlign: 'center',
        isTitle: true,
      });
      if (bodyTexts.length > 0) {
        slide.elements.push({
          id: `el-sub-${idx}`,
          type: 'text',
          x: 15,
          y: 58,
          width: 70,
          height: 18,
          text: bodyTexts.join(' · '),
          fontSize: 20,
          color: '#475569',
          textAlign: 'center',
        });
      }
    } else {
      slide.elements.push({
        id: `el-title-${idx}`,
        type: 'text',
        x: 8,
        y: 8,
        width: 84,
        height: 14,
        text: titleText,
        fontSize: 32,
        fontWeight: 'bold',
        color: '#1E293B',
        isTitle: true,
      });

      const bulletContent = bodyTexts.length > 0
        ? bodyTexts.map((line) => (line.startsWith('•') ? line : `• ${line}`)).join('\n')
        : '• Nội dung trang chiếu';

      slide.elements.push({
        id: `el-content-${idx}`,
        type: 'text',
        x: 8,
        y: 26,
        width: 84,
        height: 64,
        text: bulletContent,
        fontSize: 20,
        color: '#475569',
        lineHeight: 1.6,
      });
    }

    slides.push(slide);
  }

  return {
    aspectRatio: '16:9',
    themeId: 'office-classic',
    title: fileName,
    slides,
  };
}
