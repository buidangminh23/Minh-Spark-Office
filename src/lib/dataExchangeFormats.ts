import type { ConversionTarget } from './conversionTypes';

export const DATA_EXCHANGE_EXTENSIONS = ['xml', 'slk', 'dif', 'dbf', 'numbers'] as const;
export type DataExchangeFormat = typeof DATA_EXCHANGE_EXTENSIONS[number];

export function isDataExchangeFormat(extension: string): extension is DataExchangeFormat {
  return DATA_EXCHANGE_EXTENSIONS.some(value => value === extension);
}

export const dataExchangeTargets: Record<DataExchangeFormat, ConversionTarget> = {
  xml: { id: 'xml', label: 'Excel XML 2003 (.xml)', description: 'Lưu các trang tính, dữ liệu, ô gộp và công thức theo chuẩn SpreadsheetML 2003.' },
  slk: { id: 'slk', label: 'Symbolic Link (.slk)', description: 'Mỗi trang tính thành một tệp SYLK, giữ dữ liệu và các công thức cùng trang được hỗ trợ.' },
  dif: { id: 'dif', label: 'Data Interchange Format (.dif)', description: 'Mỗi trang tính thành một tệp DIF chứa các hàng, cột và giá trị ô.' },
  dbf: { id: 'dbf', label: 'Bảng dBASE (.dbf)', description: 'Xuất mỗi trang tính thành một bảng dBASE. Có tệp CPG đi kèm khi bảng chứa chữ Unicode.' },
  numbers: { id: 'numbers', label: 'Apple Numbers (.numbers)', description: 'Tạo tệp Numbers chứa nhiều trang tính. Công thức được xuất thành giá trị hoặc biểu thức dạng chữ.' },
};
