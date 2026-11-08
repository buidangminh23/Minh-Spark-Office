import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectProvinceColumn, provinceOf, summarizeByProvince } from '../src/lib/vnProvinces';

describe('vnProvinces', () => {
  it('recognises provinces, cities, old and new names, aliases and addresses', () => {
    assert.equal(provinceOf('TP.HCM')?.region, 'south');
    assert.equal(provinceOf('Thành phố Hồ Chí Minh')?.province, 'Hồ Chí Minh');
    assert.equal(provinceOf('ha noi')?.region, 'north');
    assert.equal(provinceOf('Tỉnh Thừa Thiên Huế')?.region, 'central');
    assert.equal(provinceOf('Bà Rịa - Vũng Tàu')?.region, 'south');
    assert.equal(provinceOf('12 Trần Phú, Phường 1, Đắk Lắk')?.province, 'Đắk Lắk');
    assert.equal(provinceOf('Hoà Bình')?.region, 'north');
    assert.equal(provinceOf('Paris'), null);
    assert.equal(provinceOf(''), null);
  });

  it('sums values per province and per region and lists what it could not match', () => {
    const rows = [['Hà Nội', 100], ['HCM', 300], ['Đà Nẵng', 50], ['Hà Nội', 20], ['Mars', 9], ['Cần Thơ', 'x']];
    const s = summarizeByProvince(rows, 0, 1);
    assert.deepEqual(s.regions, { north: 120, central: 50, south: 300 });
    assert.equal(s.total, 470);
    assert.equal(s.provinces[0].province, 'Hồ Chí Minh');
    assert.deepEqual(s.unmatched, [{ text: 'Mars', rows: 1 }]);
    assert.equal(summarizeByProvince(rows, 0, null).regions.north, 2);
    assert.equal(detectProvinceColumn(['Tiền', 'Nơi'], rows.map((r) => [r[1], r[0]])), 1);
  });
});
