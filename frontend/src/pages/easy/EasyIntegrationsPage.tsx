import { EasyPageShell } from '@/components/easy/EasyPageShell';
import { useStore } from '@/stores/useStore';

export default function EasyIntegrationsPage({ navigate }: { navigate?: (page: string) => void }) {
  const integrations = useStore((s) => s.integrations);
  const connectIntegration = useStore((s) => s.connectIntegration);
  const syncIntegration = useStore((s) => s.syncIntegration);

  const back = () => navigate?.('dashboard');

  return (
    <EasyPageShell
      title="Mağaza bağlantıları"
      subtitle="Pazaryerinizi bağlamak için Bağla düğmesine basın."
      onBack={back}
    >
      {integrations.length === 0 ? (
        <p className="easy-empty">Bağlantı listesi yüklenemedi. İnternet bağlantınızı kontrol edin.</p>
      ) : (
        <ul className="easy-card-list">
          {integrations.map((int) => (
            <li key={int.id} className="easy-connect-card">
              <div className="easy-connect-card__row">
                <span className="easy-connect-card__icon">{int.icon}</span>
                <div>
                  <p className="easy-connect-card__name">{int.platform}</p>
                  <p className="easy-connect-card__status">
                    {int.status === 'connected' ? '✓ Bağlı' : 'Bağlı değil'}
                  </p>
                </div>
              </div>
              {int.status === 'connected' ? (
                <button
                  type="button"
                  className="easy-btn easy-btn--ghost"
                  onClick={() => void syncIntegration(int.id)}
                >
                  Yenile
                </button>
              ) : (
                <button
                  type="button"
                  className="easy-btn easy-btn--primary"
                  onClick={() => void connectIntegration(int.platform, int.icon)}
                >
                  Bağla
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </EasyPageShell>
  );
}
