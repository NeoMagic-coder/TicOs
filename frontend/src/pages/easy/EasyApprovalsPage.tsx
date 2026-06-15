import { useEffect } from 'react';
import { EasyPageShell } from '@/components/easy/EasyPageShell';
import { useAdaptedApprovals, storeActions } from '@/lib/aos/adapter';
import { useStore } from '@/stores/useStore';

export default function EasyApprovalsPage({ navigate }: { navigate?: (page: string) => void }) {
  const approvals = useAdaptedApprovals();
  const loadApprovalsFromBackend = useStore((s) => s.loadApprovalsFromBackend);
  const bootstrapApprovalsIfEmpty = useStore((s) => s.bootstrapApprovalsIfEmpty);
  const onboardingComplete = useStore((s) => s.onboardingComplete);

  useEffect(() => {
    void loadApprovalsFromBackend().then(() => {
      if (onboardingComplete) void bootstrapApprovalsIfEmpty();
    });
  }, [loadApprovalsFromBackend, bootstrapApprovalsIfEmpty, onboardingComplete]);

  const pending = approvals.filter((a) => a.status === 'pending' || a.status === 'estimating');

  const back = () => navigate?.('dashboard');

  return (
    <EasyPageShell
      title="Onay bekleyenler"
      subtitle="Onayla veya reddet — büyük düğmeleri kullanın."
      onBack={back}
    >
      {pending.length === 0 ? (
        <p className="easy-empty">Şu an onay bekleyen bir iş yok.</p>
      ) : (
        <ul className="easy-card-list">
          {pending.map((a) => (
            <li key={a.id} className="easy-approval-card">
              <p className="easy-approval-card__title">{a.title}</p>
              <p className="easy-approval-card__meta">{a.delta}</p>
              <div className="easy-approval-card__actions">
                <button
                  type="button"
                  className="easy-btn easy-btn--ok"
                  onClick={() => storeActions.approveItem(a.id)}
                >
                  Onayla
                </button>
                <button
                  type="button"
                  className="easy-btn easy-btn--no"
                  onClick={() => storeActions.rejectItem(a.id, 'Reddedildi')}
                >
                  Reddet
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </EasyPageShell>
  );
}
