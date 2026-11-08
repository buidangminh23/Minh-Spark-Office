import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  docSoTien,
  buildVietQrPayload,
  crc16Ccitt,
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
    assert.equal(docSoTien(1000005), 'Một triệu không trăm lẻ năm đồng chẵn');
    assert.equal(docSoTien('1.500.000'), 'Một triệu năm trăm nghìn đồng chẵn');
    assert.equal(docSoTien('1.500.000,50'), 'Một triệu năm trăm nghìn đồng chẵn');
    assert.equal(docSoTien(-2000), 'Âm hai nghìn đồng chẵn');
    assert.equal(docSoTien(24), 'Hai mươi tư đồng chẵn');
  });

  it('buildVietQrPayload builds an EMVCo NAPAS 247 payload with a valid CRC', () => {
    assert.equal(crc16Ccitt('123456789'), '29B1');
    const payload = buildVietQrPayload({ bankBin: '970436', accountNumber: '0123 456 789', amount: 500000, memo: 'Thanh toán đơn 102' });
    assert.ok(payload.startsWith('000201010212'));
    assert.ok(payload.includes('0010A000000727'));
    assert.ok(payload.includes('0006970436010101234567890208QRIBFTTA'.slice(0, 10)));
    assert.ok(payload.includes('01100123456789'));
    assert.ok(payload.includes('5406500000'));
    assert.ok(payload.includes('0818Thanh toan don 102'));
    assert.equal(payload.slice(-4), crc16Ccitt(payload.slice(0, -4)));
    const staticQr = buildVietQrPayload({ bankBin: '970422', accountNumber: '0123456789' });
    assert.ok(staticQr.startsWith('000201010211'));
    assert.ok(!staticQr.includes('5406'));
    assert.throws(() => buildVietQrPayload({ bankBin: '97', accountNumber: '1' }));
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
    assert.equal(validateTaxCode('01001091060-01').valid, false);
    assert.equal(validateTaxCode('0100109106-000').valid, false);
    assert.equal(validateTaxCode('0300588569').valid, true);
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

    const resOr = runSheetSql(headers, rows, "SELECT MaNV WHERE KhuVuc = 'HCM' AND DoanhThu > 100 OR HoTen LIKE 'Le%' ORDER BY MaNV");
    assert.deepEqual(resOr.rows, [['NV02'], ['NV03']]);

    const grouped = runSheetSql(headers, rows, 'SELECT KhuVuc, SUM(DoanhThu), COUNT(*) GROUP BY KhuVuc ORDER BY SUM(DoanhThu) DESC');
    assert.deepEqual(grouped.headers, ['KhuVuc', 'SUM(DoanhThu)', 'COUNT(*)']);
    assert.deepEqual(grouped.rows, [['HN', 450, 2], ['HCM', 280, 2]]);

    assert.match(runSheetSql(headers, rows, 'SELECT * WHERE KhuVucX = HN').error ?? '', /Không có cột/);
    assert.match(runSheetSql(headers, rows, 'SELECT * WHERE DoanhThu ~ 5').error ?? '', /Không hiểu điều kiện/);
    assert.match(runSheetSql(headers, rows, 'SELECT HoTen, SUM(DoanhThu)').error ?? '', /GROUP BY/);

    const spaced = runSheetSql(['Mã KH', 'Số tiền'], [['A', 5], ['B', null], ['C', 7]], 'SELECT "Mã KH" WHERE [Số tiền] IS NOT NULL ORDER BY "Số tiền" DESC');
    assert.equal(spaced.error, undefined);
    assert.deepEqual(spaced.rows, [['C'], ['A']]);
    assert.equal(runSheetSql(['Số tiền'], [[null], [3]], 'SELECT * WHERE "Số tiền" > -5').rows.length, 1);
  });
});
