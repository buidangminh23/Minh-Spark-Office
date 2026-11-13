import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { isDesktop } from '../lib/desktop';

export function DesktopFileSettings() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  if (!isDesktop()) return null;
  const mac = /Mac/.test(navigator.platform);
  const windows = /Win/.test(navigator.platform);
  const configure = async () => {
    try {
      setError('');
      await invoke('open_default_apps');
    } catch {
      setError(
        'Chưa mở được phần cài đặt. Hãy mở Cài đặt Windows → Ứng dụng → Ứng dụng mặc định → Office 23.'
      );
    }
  };
  return (
    <>
      <button className="desktop-default-button" onClick={() => setOpen(true)}>
        Đặt ứng dụng mặc định
      </button>
      {open && (
        <div className="sync-dialog-backdrop">
          <section
            className="sync-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="default-app-title"
          >
            <img
              className="sync-brand"
              src="/logo-icon.png"
              alt="Office 23"
            />
            <h2 id="default-app-title">
              {windows || mac ? 'Mở tài liệu & hình ảnh bằng Office 23' : 'Mở tài liệu bằng Office 23'}
            </h2>
            {windows || mac ? (
              <p>
                Hỗ trợ DOCX, XLSX, XLSM, XLS, CSV, TSV, PDF, PPTX, TXT, Markdown cùng
                tất cả định dạng ảnh (PNG, JPG, JPEG, WEBP, GIF, SVG, BMP, ICO, AVIF, TIFF...).
              </p>
            ) : (
              <p>Hỗ trợ DOCX, XLSX, XLSM, XLS, CSV, TSV, PDF, PPTX, PPT, TXT và Markdown.</p>
            )}
            {mac ? (
              <p>
                Trong Finder, chọn một tài liệu hoặc tệp ảnh → Lấy thông tin (Get
                Info) → Mở bằng (Open with) → Office 23 → Thay đổi tất cả
                (Change All).
              </p>
            ) : windows ? (
              <p>
                Trong Cài đặt Windows, chọn Office 23 rồi chọn các loại tệp
                muốn mở mặc định. Cũng có thể nhấp chuột phải bất kỳ tệp ảnh hoặc
                tài liệu → Mở bằng (Open with) → Office 23.
              </p>
            ) : (
              <p>
                Sau khi cài gói .deb, trong trình quản lý tệp, nhấp chuột phải
                tài liệu → Thuộc tính (Properties) → Mở bằng (Open With) →
                Office 23 → Đặt làm mặc định (Set as default).
                Với AppImage, mở ứng dụng rồi chọn tài liệu cần dùng.
              </p>
            )}
            {error && (
              <p role="alert" className="update-error">
                {error}
              </p>
            )}
            <div className="sync-dialog-actions">
              <button className="btn" onClick={() => setOpen(false)}>
                Đóng
              </button>
              {windows && (
                <button
                  className="btn btn-primary"
                  onClick={() => void configure()}
                >
                  Mở cài đặt mặc định
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
