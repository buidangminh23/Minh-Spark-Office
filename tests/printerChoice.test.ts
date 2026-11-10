import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergePrinters, printerNotes, printerSubtitle, printerTone, resolveChoice, targetFor } from '../src/components/print/printerChoice';
import type { PrinterInfo } from '../src/lib/print/printRun';

const printer = (name: string, patch: Partial<PrinterInfo> = {}): PrinterInfo => ({
  name,
  displayName: name.replace(/_/g, ' '),
  isDefault: false,
  kind: 'usb',
  state: 'ready',
  issues: [],
  location: null,
  model: null,
  installed: true,
  duplex: true,
  color: true,
  ...patch,
});

const office = printer('HP_M404', { isDefault: true, kind: 'network', location: 'Tầng 2' });
const desk = printer('Epson_L3150');
const lobby = printer('Canon_G3010', { installed: false, kind: 'network' });

test('the remembered printer wins while it is connected', () => {
  const resolved = resolveChoice('printer:Epson_L3150', [office, desk], 'windows');
  assert.equal(resolved.printer?.name, 'Epson_L3150');
  assert.equal(resolved.missing, null);
  assert.deepEqual(targetFor(resolved, 'windows'), { kind: 'printer', name: 'Epson_L3150', displayName: 'Epson L3150' });
});

test('a vanished printer falls back to the default and says so', () => {
  const resolved = resolveChoice('printer:Brother_Old', [office, desk], 'mac');
  assert.equal(resolved.printer?.name, 'HP_M404');
  assert.equal(resolved.missing, 'Brother_Old');
  assert.match(printerNotes(resolved, 'one', 'mac')[0], /Brother Old.*chưa kết nối.*HP M404/);
});

test('reconnecting the remembered printer selects it again', () => {
  assert.equal(resolveChoice('printer:Brother_Old', [office], 'mac').printer?.name, 'HP_M404');
  assert.equal(resolveChoice('printer:Brother_Old', [office, printer('Brother_Old')], 'mac').printer?.name, 'Brother_Old');
});

test('no printer installed still lets the user save a PDF', () => {
  const resolved = resolveChoice(null, [], 'mac');
  assert.equal(resolved.choice, 'pdf');
  assert.deepEqual(targetFor(resolved, 'mac'), { kind: 'pdf' });
});

test('a network printer that is not installed goes through the system dialog', () => {
  const resolved = resolveChoice('printer:Canon_G3010', [office, lobby], 'mac');
  assert.equal(resolved.printer?.name, 'Canon_G3010');
  assert.deepEqual(targetFor(resolved, 'mac'), { kind: 'system' });
  assert.ok(printerNotes(resolved, 'one', 'mac').some((note) => note.includes('chưa được cài')));
});

test('web and linux never print directly', () => {
  assert.deepEqual(targetFor(resolveChoice('printer:HP_M404', [office], 'linux'), 'linux'), { kind: 'system' });
  assert.equal(resolveChoice('printer:HP_M404', null, 'web').choice, 'system');
  assert.equal(resolveChoice('pdf', [office], 'linux').choice, 'printer:HP_M404');
});

test('discovered printers stay listed between quick refreshes', () => {
  const merged = mergePrinters([office, desk], [lobby, printer('HP_M404', { installed: false })]);
  assert.deepEqual(merged.map((p) => p.name), ['HP_M404', 'Epson_L3150', 'Canon_G3010']);
});

test('subtitle and tone describe type, state and problems', () => {
  assert.equal(printerSubtitle(office), 'Mặc định · Máy in mạng · Sẵn sàng · Tầng 2');
  const jammed = printer('X', { state: 'error', issues: ['paper-jam', 'toner-low'] });
  assert.equal(printerSubtitle(jammed), 'Cắm USB · Đang báo lỗi, kẹt giấy, sắp hết mực');
  assert.equal(printerTone(jammed), 'bad');
  assert.equal(printerTone(printer('Y', { issues: ['paper-out'] })), 'warn');
  assert.equal(printerTone(office), 'ok');
  assert.equal(printerSubtitle(lobby), 'Tìm thấy trong mạng, chưa cài · Sẵn sàng');
});

test('duplex warning only when the printer reports no duplexer', () => {
  const simplex = resolveChoice('printer:Epson_L3150', [printer('Epson_L3150', { duplex: false })], 'windows');
  assert.ok(printerNotes(simplex, 'auto', 'windows').some((note) => note.includes('hai mặt tự động')));
  assert.equal(printerNotes(simplex, 'one', 'windows').length, 0);
});
