// Alt menü — telefon uygulaması gibi, büyük dokunma alanları.
import { Icon } from '@/components/AOS/widgets';
import { EASY_NAV_ITEMS } from '@/lib/easyMode';
import { resolveHubPage } from '@/lib/navigation/hubs';

type EasyNavProps = {
  activePage: string;
  navigate: (page: string) => void;
};

export function EasyNav({ activePage, navigate }: EasyNavProps) {
  const resolved = resolveHubPage(activePage);
  const navHighlight =
    resolved === 'easy_features' || resolved === 'tic_products' || resolved === 'tic_orders'
      ? 'dashboard'
      : resolved;

  return (
    <nav className="easy-nav" aria-label="Ana menü">
      {EASY_NAV_ITEMS.map((item) => {
        const isActive = navHighlight === item.page;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`easy-nav__btn ${isActive ? 'easy-nav__btn--active' : ''}`}
            onClick={() => navigate(item.page)}
          >
            <span className="easy-nav__icon" aria-hidden="true">
              <Icon name={item.icon} size={22} />
            </span>
            <span className="easy-nav__label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
