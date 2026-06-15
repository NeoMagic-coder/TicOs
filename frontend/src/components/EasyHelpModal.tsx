import { X } from 'lucide-react';

type EasyHelpModalProps = {
  open: boolean;
  onClose: () => void;
};

export function EasyHelpModal({ open, onClose }: EasyHelpModalProps) {
  if (!open) return null;

  return (
    <div className="easy-help-backdrop" onClick={onClose} role="presentation">
      <div
        className="easy-help easy-help--minimal"
        role="dialog"
        aria-labelledby="easy-help-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="easy-help__head">
          <h2 id="easy-help-title">Kullanım</h2>
          <button type="button" className="easy-help__close" onClick={onClose} aria-label="Kapat">
            <X size={18} />
          </button>
        </header>
        <p className="easy-help__one-liner">
          <strong>1.</strong> Sorunuzu yazın.<br />
          <strong>2.</strong> <em>Gönder</em> düğmesine basın.<br />
          <strong>3.</strong> Cevabı okuyun.
        </p>
        <button type="button" className="easy-help__cta" onClick={onClose}>
          Tamam
        </button>
      </div>
    </div>
  );
}
