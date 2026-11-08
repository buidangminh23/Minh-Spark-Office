import { useState } from 'react';
import { X, Volume2, Clock, Sparkles, Play } from 'lucide-react';
import type {
  SlideElement,
  ElementAnimation,
  AnimationDirection,
  AnimationTrigger,
  TransitionSound,
} from '../../lib/slideTypes';
import { playTransitionSound } from '../../lib/slideAudio';

interface SlideAnimationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  element: SlideElement | null;
  animation: ElementAnimation | null;
  slideElements: SlideElement[];
  onSave: (elementId: string, updatedAnimation: ElementAnimation) => void;
  defaultTab?: 'effect' | 'timing';
}

const SOUNDS_LIST: { id: TransitionSound; label: string }[] = [
  { id: 'none', label: '[Không có âm thanh]' },
  { id: 'applause', label: 'Tiếng vỗ tay (Applause)' },
  { id: 'camera', label: 'Tiếng máy ảnh (Camera)' },
  { id: 'chime', label: 'Tiếng chuông ngân (Chime)' },
  { id: 'click', label: 'Tiếng bấm chuột (Click)' },
  { id: 'coin', label: 'Tiếng đồng xu (Coin)' },
  { id: 'drum', label: 'Tiếng trống cuộn (Drum Roll)' },
  { id: 'laser', label: 'Tia Laser (Laser)' },
  { id: 'whoosh', label: 'Tiếng vụt qua (Whoosh)' },
  { id: 'wind', label: 'Gió thổi (Wind)' },
  { id: 'bomb', label: 'Tiếng bom nổ (Bomb)' },
  { id: 'typewriter', label: 'Máy đánh chữ (Typewriter)' },
  { id: 'voltage', label: 'Xung điện (Voltage)' },
];

export function SlideAnimationDialog(props: SlideAnimationDialogProps) {
  const { isOpen, element, animation } = props;
  if (!isOpen || !element || !animation) return null;
  return (
    <SlideAnimationDialogBody
      key={`${element.id}:${animation.id}:${props.defaultTab ?? 'effect'}`}
      {...props}
      element={element}
      animation={animation}
    />
  );
}

type SlideAnimationDialogBodyProps = SlideAnimationDialogProps & {
  element: SlideElement;
  animation: ElementAnimation;
};

function SlideAnimationDialogBody({
  onClose,
  element,
  animation,
  slideElements,
  onSave,
  defaultTab = 'effect',
}: SlideAnimationDialogBodyProps) {
  const [activeTab, setActiveTab] = useState<'effect' | 'timing'>(defaultTab);

  // Form states
  const [direction, setDirection] = useState<AnimationDirection>(animation.direction || 'bottom');
  const [sound, setSound] = useState<TransitionSound>(animation.sound || 'none');
  const [smoothStart, setSmoothStart] = useState<boolean>(!!animation.smoothStart);
  const [smoothEnd, setSmoothEnd] = useState<boolean>(!!animation.smoothEnd);
  const [bounceEnd, setBounceEnd] = useState<boolean>(!!animation.bounceEnd);
  const [afterAnimation, setAfterAnimation] = useState<
    'dont-dim' | 'dim' | 'hide' | 'hide-on-next-click'
  >(animation.afterAnimation || 'dont-dim');
  const [dimColor, setDimColor] = useState<string>(animation.dimColor || '#94A3B8');
  const [animateText, setAnimateText] = useState<'all' | 'word' | 'letter' | 'paragraph'>(
    animation.animateText || 'all'
  );

  // Timing states
  const [trigger, setTrigger] = useState<AnimationTrigger>(animation.trigger);
  const [delay, setDelay] = useState<number>(animation.delay);
  const [duration, setDuration] = useState<number>(animation.duration);
  const [repeat, setRepeat] = useState<number | 'until-next-click' | 'until-end-of-slide'>(
    animation.repeat || 0
  );
  const [autoReverse, setAutoReverse] = useState<boolean>(!!animation.autoReverse);
  const [triggerElementId, setTriggerElementId] = useState<string>(animation.triggerElementId || '');

  const handleSave = () => {
    const updated: ElementAnimation = {
      ...animation,
      direction,
      sound,
      smoothStart,
      smoothEnd,
      bounceEnd,
      afterAnimation,
      dimColor: afterAnimation === 'dim' ? dimColor : undefined,
      animateText: element.text ? animateText : undefined,
      trigger,
      delay,
      duration,
      repeat,
      autoReverse,
      triggerElementId: triggerElementId || undefined,
    };

    onSave(element.id, updated);
    onClose();
  };

  const handleTestSound = () => {
    if (sound !== 'none') {
      playTransitionSound(sound);
    }
  };

  return (
    <div className="ppt-modal-backdrop" onClick={onClose}>
      <div
        className="ppt-dialog-window"
        style={{ width: '480px', maxWidth: '95vw' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title bar */}
        <div className="ppt-dialog-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} color="#D83B01" />
            <span style={{ fontWeight: 700, fontSize: '13px' }}>
              Tùy chọn Hoạt hình: {animation.type.toUpperCase()}
            </span>
          </div>
          <button className="ppt-dialog-close-btn" onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="ppt-dialog-tabs">
          <button
            className={`ppt-dialog-tab ${activeTab === 'effect' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('effect')}
          >
            <Sparkles size={14} /> Hiệu ứng (Effect)
          </button>
          <button
            className={`ppt-dialog-tab ${activeTab === 'timing' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('timing')}
          >
            <Clock size={14} /> Định thời gian (Timing)
          </button>
        </div>

        {/* Tab Body */}
        <div className="ppt-dialog-body" style={{ padding: '16px', maxHeight: '420px', overflowY: 'auto' }}>
          {activeTab === 'effect' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Direction setting */}
              <div className="ppt-dialog-row">
                <label className="ppt-dialog-label">Hướng (Direction):</label>
                <select
                  className="ppt-dialog-select"
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as AnimationDirection)}
                >
                  <option value="bottom">Từ dưới lên (From Bottom)</option>
                  <option value="top">Từ trên xuống (From Top)</option>
                  <option value="left">Từ trái sang (From Left)</option>
                  <option value="right">Từ phải sang (From Right)</option>
                  <option value="bottom-left">Từ góc dưới trái (From Bottom-Left)</option>
                  <option value="bottom-right">Từ góc dưới phải (From Bottom-Right)</option>
                  <option value="top-left">Từ góc trên trái (From Top-Left)</option>
                  <option value="top-right">Từ góc trên phải (From Top-Right)</option>
                  <option value="horizontal">Theo chiều ngang (Horizontal)</option>
                  <option value="vertical">Theo chiều dọc (Vertical)</option>
                  <option value="in">Thu vào trong (In)</option>
                  <option value="out">Phát ra ngoài (Out)</option>
                </select>
              </div>

              {/* Smooth Start & Smooth End */}
              <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '6px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={smoothStart}
                    onChange={(e) => setSmoothStart(e.target.checked)}
                  />
                  <span>Bắt đầu êm (Smooth Start - Easing In)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={smoothEnd}
                    onChange={(e) => setSmoothEnd(e.target.checked)}
                  />
                  <span>Kết thúc êm (Smooth End - Easing Out)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={bounceEnd}
                    onChange={(e) => setBounceEnd(e.target.checked)}
                  />
                  <span>Nảy bật khi kết thúc (Bounce End)</span>
                </label>
              </div>

              {/* Sound Setting */}
              <div className="ppt-dialog-row">
                <label className="ppt-dialog-label">Âm thanh (Sound):</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                  <select
                    className="ppt-dialog-select"
                    style={{ flex: 1 }}
                    value={sound}
                    onChange={(e) => setSound(e.target.value as TransitionSound)}
                  >
                    {SOUNDS_LIST.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <button
                    className="ppt-stepper-btn"
                    disabled={sound === 'none'}
                    onClick={handleTestSound}
                    title="Nghe thử âm thanh"
                    style={{ height: '30px', width: '32px' }}
                  >
                    <Volume2 size={14} color="#0078D4" />
                  </button>
                </div>
              </div>

              {/* After Animation */}
              <div className="ppt-dialog-row">
                <label className="ppt-dialog-label">Sau khi diễn hoạt:</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                  <select
                    className="ppt-dialog-select"
                    value={afterAnimation}
                    onChange={(e) => setAfterAnimation(e.target.value as typeof afterAnimation)}
                  >
                    <option value="dont-dim">Không làm mờ (Don't Dim)</option>
                    <option value="dim">Đổi màu làm mờ (Dim to color)</option>
                    <option value="hide">Ẩn sau khi hoạt hình (Hide After Animation)</option>
                    <option value="hide-on-next-click">Ẩn ở lần bấm tiếp theo (Hide on Next Click)</option>
                  </select>
                  {afterAnimation === 'dim' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', color: '#64748B' }}>Màu mờ:</span>
                      <input
                        type="color"
                        value={dimColor}
                        onChange={(e) => setDimColor(e.target.value)}
                        style={{ width: '28px', height: '26px', padding: 0, border: 'none', cursor: 'pointer' }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Animate Text (Only if element has text) */}
              {element.text && (
                <div className="ppt-dialog-row">
                  <label className="ppt-dialog-label">Văn bản động:</label>
                  <select
                    className="ppt-dialog-select"
                    value={animateText}
                    onChange={(e) => setAnimateText(e.target.value as typeof animateText)}
                  >
                    <option value="all">Tất cả cùng một lúc (All at once)</option>
                    <option value="paragraph">Theo từng đoạn / gạch đầu dòng (By Paragraph)</option>
                    <option value="word">Theo từng từ (By word)</option>
                    <option value="letter">Theo từng ký tự (By letter - Typewriter)</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {activeTab === 'timing' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Trigger */}
              <div className="ppt-dialog-row">
                <label className="ppt-dialog-label">Bắt đầu (Start):</label>
                <select
                  className="ppt-dialog-select"
                  value={trigger}
                  onChange={(e) => setTrigger(e.target.value as AnimationTrigger)}
                >
                  <option value="on-click">Khi bấm chuột (On Click)</option>
                  <option value="with-previous">Cùng với trước đó (With Previous)</option>
                  <option value="after-previous">Sau trước đó (After Previous)</option>
                </select>
              </div>

              {/* Delay */}
              <div className="ppt-dialog-row">
                <label className="ppt-dialog-label">Độ trễ (Delay):</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="60"
                    className="ppt-dialog-input"
                    style={{ width: '90px' }}
                    value={delay}
                    onChange={(e) => setDelay(Math.max(0, parseFloat(e.target.value) || 0))}
                  />
                  <span style={{ fontSize: '12px', color: '#64748B' }}>giây</span>
                </div>
              </div>

              {/* Duration */}
              <div className="ppt-dialog-row">
                <label className="ppt-dialog-label">Thời lượng (Duration):</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <select
                    className="ppt-dialog-select"
                    style={{ width: '180px' }}
                    value={duration}
                    onChange={(e) => setDuration(parseFloat(e.target.value))}
                  >
                    <option value="0.5">0.5 giây (Rất nhanh)</option>
                    <option value="1.0">1.0 giây (Nhanh)</option>
                    <option value="2.0">2.0 giây (Trung bình)</option>
                    <option value="3.0">3.0 giây (Chậm)</option>
                    <option value="5.0">5.0 giây (Rất chậm)</option>
                  </select>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="60"
                    className="ppt-dialog-input"
                    style={{ width: '70px' }}
                    value={duration}
                    onChange={(e) => setDuration(Math.max(0.1, parseFloat(e.target.value) || 0.5))}
                  />
                  <span style={{ fontSize: '12px', color: '#64748B' }}>s</span>
                </div>
              </div>

              {/* Repeat */}
              <div className="ppt-dialog-row">
                <label className="ppt-dialog-label">Lặp lại (Repeat):</label>
                <select
                  className="ppt-dialog-select"
                  value={repeat}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'until-next-click' || val === 'until-end-of-slide') {
                      setRepeat(val);
                    } else {
                      setRepeat(parseInt(val, 10));
                    }
                  }}
                >
                  <option value="0">(Không có)</option>
                  <option value="2">2 lần</option>
                  <option value="3">3 lần</option>
                  <option value="4">4 lần</option>
                  <option value="5">5 lần</option>
                  <option value="10">10 lần</option>
                  <option value="until-next-click">Đến lần bấm chuột tiếp theo</option>
                  <option value="until-end-of-slide">Đến hết trang chiếu</option>
                </select>
              </div>

              {/* Auto Reverse */}
              <div style={{ padding: '4px 0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={autoReverse}
                    onChange={(e) => setAutoReverse(e.target.checked)}
                  />
                  <span>Tự động đảo chiều (Auto-reverse khi hoàn thành)</span>
                </label>
              </div>

              {/* Triggers Section */}
              <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '6px', border: '1px solid #E2E8F0', marginTop: '4px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                  Bộ kích hoạt (Triggers):
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="triggerType"
                      checked={!triggerElementId}
                      onChange={() => setTriggerElementId('')}
                    />
                    <span>Một phần của chuỗi nhấp chuột (Chuẩn)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="triggerType"
                      checked={!!triggerElementId}
                      onChange={() => {
                        const firstOther = slideElements.find((el) => el.id !== element.id);
                        setTriggerElementId(firstOther ? firstOther.id : element.id);
                      }}
                    />
                    <span>Bắt đầu hiệu ứng khi nhấp vào:</span>
                  </label>
                  {!!triggerElementId && (
                    <select
                      className="ppt-dialog-select"
                      style={{ marginLeft: '20px', width: 'calc(100% - 20px)' }}
                      value={triggerElementId}
                      onChange={(e) => setTriggerElementId(e.target.value)}
                    >
                      {slideElements.map((el, i) => {
                        const name = el.text
                          ? `Văn bản: "${el.text.slice(0, 20)}…"`
                          : el.type === 'shape'
                          ? `Hình vẽ: ${el.shapeType || 'khối'}`
                          : el.type === 'image'
                          ? `Hình ảnh [${i + 1}]`
                          : `Phần tử [${i + 1}]`;
                        return (
                          <option key={el.id} value={el.id}>
                            {name}
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="ppt-dialog-footer">
          <button
            className="ppt-dialog-btn"
            onClick={handleTestSound}
            style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Play size={13} /> Xem trước
          </button>
          <button className="ppt-dialog-btn" onClick={onClose}>
            Hủy bỏ
          </button>
          <button className="ppt-dialog-btn is-primary" onClick={handleSave}>
            Đồng ý (OK)
          </button>
        </div>
      </div>
    </div>
  );
}
