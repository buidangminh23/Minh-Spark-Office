import { useCallback, useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';

type Recognition = { lang: string; continuous: boolean; interimResults: boolean; start: () => void; stop: () => void; onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null };

const COMMANDS: [RegExp, string][] = [
  [/\s*(dấu chấm|chấm câu)\s*/gi, '. '],
  [/\s*dấu phẩy\s*/gi, ', '],
  [/\s*dấu hỏi\s*/gi, '? '],
  [/\s*dấu chấm than\s*/gi, '! '],
  [/\s*dấu hai chấm\s*/gi, ': '],
];

export function useDictation(editor: Editor | null, notify: (text: string, error?: boolean) => void) {
  const [listening, setListening] = useState(false);
  const recognition = useRef<Recognition | null>(null);
  const wanted = useRef(false);
  const stop = useCallback(() => {
    wanted.current = false;
    recognition.current?.stop();
    setListening(false);
  }, []);
  const start = useCallback(() => {
    const Ctor = (window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition;
    if (!Ctor || !editor) {
      notify('Trình duyệt này chưa hỗ trợ nhập bằng giọng nói (dùng Chrome hoặc Edge)', true);
      return;
    }
    const rec = new Ctor();
    rec.lang = 'vi-VN';
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (event) => {
      let text = '';
      for (let i = event.resultIndex; i < event.results.length; i++) if (event.results[i].isFinal) text += event.results[i][0].transcript;
      if (/xuống dòng/i.test(text)) {
        text.split(/xuống dòng/i).forEach((part, i) => {
          if (i) editor.chain().focus().splitBlock().run();
          if (part.trim()) editor.chain().focus().insertContent(COMMANDS.reduce((s, [re, rep]) => s.replace(re, rep), part.trim()) + ' ').run();
        });
        return;
      }
      if (text.trim()) editor.chain().focus().insertContent(COMMANDS.reduce((s, [re, rep]) => s.replace(re, rep), text.trim()) + ' ').run();
    };
    rec.onerror = (event) => {
      if (event.error === 'not-allowed') notify('Chưa cấp quyền micro cho trang này', true);
      if (event.error === 'not-allowed' || event.error === 'audio-capture') stop();
    };
    rec.onend = () => {
      if (wanted.current) rec.start();
      else setListening(false);
    };
    wanted.current = true;
    rec.start();
    recognition.current = rec;
    setListening(true);
    notify('Đang nghe — nói “dấu phẩy”, “dấu chấm”, “xuống dòng” để chèn dấu');
  }, [editor, notify, stop]);
  useEffect(() => stop, [stop]);
  return { listening, toggle: () => (listening ? stop() : start()) };
}

export function useReadAloud(editor: Editor | null, notify: (text: string, error?: boolean) => void) {
  const [speaking, setSpeaking] = useState(false);
  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);
  const start = useCallback(() => {
    if (!('speechSynthesis' in window) || !editor) {
      notify('Trình duyệt không hỗ trợ đọc to', true);
      return;
    }
    const { from, to, empty } = editor.state.selection;
    const text = empty ? editor.getText({ blockSeparator: '\n' }) : editor.state.doc.textBetween(from, to, '\n');
    if (!text.trim()) return notify('Không có nội dung để đọc', true);
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((v) => v.lang.toLowerCase().startsWith('vi')) ?? null;
    if (!voice) notify('Máy chưa cài giọng tiếng Việt — đang dùng giọng mặc định');
    const chunks = text.match(/[^.!?\n]+[.!?\n]*/g) ?? [text];
    window.speechSynthesis.cancel();
    chunks.forEach((chunk, i) => {
      const utter = new SpeechSynthesisUtterance(chunk);
      utter.lang = 'vi-VN';
      if (voice) utter.voice = voice;
      if (i === chunks.length - 1) utter.onend = () => setSpeaking(false);
      window.speechSynthesis.speak(utter);
    });
    setSpeaking(true);
  }, [editor, notify]);
  useEffect(() => stop, [stop]);
  return { speaking, toggle: () => (speaking ? stop() : start()) };
}
