import type { ReactNode } from 'react';
import { Icon } from '@/components/AOS/widgets';

type EasyPageShellProps = {
  title: string;
  subtitle?: string;
  onBack: () => void;
  backLabel?: string;
  children: ReactNode;
};

export function EasyPageShell({
  title,
  subtitle,
  onBack,
  backLabel = 'Mağazama dön',
  children,
}: EasyPageShellProps) {
  return (
    <div className="easy-page">
      <header className="easy-page__head">
        <button type="button" className="easy-page__back" onClick={onBack}>
          <Icon name="chevleft" size={14} />
          {backLabel}
        </button>
        <h1 className="easy-page__title">{title}</h1>
        {subtitle && <p className="easy-page__sub">{subtitle}</p>}
      </header>
      <div className="easy-page__body">{children}</div>
    </div>
  );
}
