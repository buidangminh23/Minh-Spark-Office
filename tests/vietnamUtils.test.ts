import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  docSoTien,
  generateVietQrUrl,
  validateTaxCode,
  fuzzyMatch,
  runSheetSql,
} from '../src/lib/vietnamUtils';

describe('Vietnam Business & Localization Utilities', () => {
  it('docSoTien correctly converts numbers into standard Vietnamese words', () => {
    assert.equal(docSoTien(0), 'Không đồng chẵn');
    assert.equal(docSoTien(1000), 'Một nghìn đồng chẵn');
    assert.equal(docSoTien(1500000), 'Một triệu năm trăm nghìn đồng chẵn');
    assert.equal(docSoTien(150000000), 'Một trăm năm mươi triệu đồng chẵn');
    assert.equal(docSoTien('2500000000'), 'Hai tỷ năm trăm triệu đồng chẵn');
    assert.equal(docSoTien(105), 'Một trăm lẻ năm đồng chẵn');
    assert.equal(docSoTien(125), 'Một trăm hai mươi lăm đồng chẵn');
    assert.equal(docSoTien(121), 'Một trăm hai mươi mốt đồng chẵn');
    assert.equal(docSoTien(115), 'Một trăm mười lăm đồng chẵn');
  });

  it('generateVietQrUrl produces valid NAPAS 247 image URL', () => {
    const url = generateVietQrUrl({
      bankBin: '970436',
      accountNumber: '1234567890',
      amount: 500000,
      memo: 'Thanh toan don 102',
    });
    assert.ok(url.startsWith('https://img.vietqr.io/image/970436-1234567890-compact2.png'));
    assert.ok(url.includes('amount=500000'));
    assert.ok(url.includes('addInfo=Thanh+toan+don+102') || url.includes('addInfo=Thanh%20toan%20don%20102'));
  });

  it('validateTaxCode validates 10-digit and 13-digit MST with Modulo 11', () => {
    // Valid 10-digit test with known tax codes
    // Modulo 11 check: weights [31, 29, 23, 19, 17, 13, 7, 5, 3]
    // 0100109106: Viettel
    const r1 = validateTaxCode('0100109106');
    assert.equal(r1.valid, true);
    assert.equal(r1.type, 'enterprise');

    // Invalid format
    const r2 = validateTaxCode('12345');
    assert.equal(r2.valid, false);

    // Invalid checksum
    const r3 = validateTaxCode('0100109109');
    assert.equal(r3.valid, false);

    // 13-digit branch
    const r4 = validateTaxCode('0100109106-001');
    assert.equal(r4.valid, true);
    assert.equal(r4.type, 'branch');
  });

  it('fuzzyMatch computes similarity and matches Vietnamese names regardless of accents', () => {
    const score1 = fuzzyMatch('Công ty TNHH Ánh Dương', 'Cty TNHH Anh Duong');
    assert.ok(score1 > 0.7);

    const scoreExact = fuzzyMatch('Nguyễn Văn A', 'nguyen van a');
    assert.equal(scoreExact, 1.0);

    const scoreDifferent = fuzzyMatch('Hà Nội', 'Đà Nẵng');
    assert.ok(scoreDifferent < 0.5);
  });

  it('runSheetSql parses and executes SELECT queries with WHERE and ORDER BY', () => {
    const headers = ['MaNV', 'HoTen', 'KhuVuc', 'DoanhThu'];
    const rows = [
      ['NV01', 'Nguyen Van A', 'HN', 150],
      ['NV02', 'Tran Thi B', 'HCM', 200],
      ['NV03', 'Le Van C', 'HN', 300],
      ['NV04', 'Pham Van D', 'HCM', 80],
    ];

    const res1 = runSheetSql(headers, rows, 'SELECT HoTen, DoanhThu WHERE KhuVuc = HN ORDER BY DoanhThu DESC');
    assert.equal(res1.error, undefined);
    assert.equal(res1.rows.length, 2);
    assert.equal(res1.rows[0][0], 'Le Van C');
    assert.equal(res1.rows[0][1], 300);
    assert.equal(res1.rows[1][0], 'Nguyen Van A');
    assert.equal(res1.rows[1][1], 150);

    const resAll = runSheetSql(headers, rows, 'SELECT * WHERE DoanhThu >= 150');
    assert.equal(resAll.rows.length, 3);
  });
});
