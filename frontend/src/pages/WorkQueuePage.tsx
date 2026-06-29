// @ts-nocheck
// ============================================================
// TicOSClaw — Görevler & Onaylar (birleşik iş kuyruğu)
// ============================================================
import React, { useEffect, useRef } from 'react';
import { Icon } from '@/components/AOS/widgets';
import { useStorePage } from '@/lib/aos/adapter';
import { useStore } from '@/stores/useStore';
import ApprovalsPage from '@/pages/ApprovalsPage';
import { TasksPage } from '@/pages/legacy/TasksPage';

type WorkQueuePageProps = {
  navigate?: (page: string) => void;
  embedded?: boolean;
};

const WorkQueuePage = ({ navigate, embedded = false }: WorkQueuePageProps) => {
  const [route, setRoute] = useStorePage();
  const setPage = navigate || setRoute;
  const tasks = useStore((s: any) => s.tasks);
  const approvals = useStore((s: any) => s.approvals);
  const loadTasksFromBackend = useStore((s: any) => s.loadTasksFromBackend);
  const loadApprovalsFromBackend = useStore((s: any) => s.loadApprovalsFromBackend);
  const bootstrapApprovalsIfEmpty = useStore((s: any) => s.bootstrapApprovalsIfEmpty);
  const onboardingComplete = useStore((s: any) => s.onboardingComplete);
  const autoTabRef = useRef(false);

  useEffect(() => {
    void loadTasksFromBackend();
    void loadApprovalsFromBackend().then(() => {
      if (onboardingComplete) void bootstrapApprovalsIfEmpty();
    });
  }, [loadTasksFromBackend, loadApprovalsFromBackend, bootstrapApprovalsIfEmpty, onboardingComplete]);

  const goalLinkedTasks = tasks.filter((t: any) => t.goal_id).length;

  const tab: 'tasks' | 'approvals' = route === 'approvals' ? 'approvals' : 'tasks';

  const runningTasks = tasks.filter((t: any) =>
    ['in_progress', 'assigned', 'waiting_tool_result', 'waiting_human_approval'].includes(t.status),
  ).length;
  const failedTasks = tasks.filter((t: any) => t.status === 'failed').length;
  const pendingApprovals = approvals.filter((a: any) =>
    a.status === 'pending' || a.status === 'estimating',
  ).length;

  useEffect(() => {
    if (autoTabRef.current) return;
    if (route === 'tasks' && pendingApprovals > 0) {
      autoTabRef.current = true;
      setPage('approvals');
    }
  }, [pendingApprovals, route, setPage]);

  const switchTab = (next: 'tasks' | 'approvals') => {
    setPage(next);
  };

  const body = (
    <>
      {!embedded && (
        <>
          <div className="page__breadcrumb mono">
            HOME <span>›</span> GÖREVLER &amp; ONAYLAR
          </div>
          <div className="page__header">
            <div>
              <h1 className="page__title">
                İş Kuyruğu
                <span className="page__title-tag">TASKS · APPROVALS</span>
              </h1>
              <p className="page__sub">
                TicOSClaw görevlerini izle, başarısız koşuları yeniden çalıştır ve otonomi onaylarını tek ekrandan yönet.
                {goalLinkedTasks > 0 && (
                  <> · <span className="mono">{goalLinkedTasks} hedef bağlı görev</span></>
                )}
              </p>
            </div>
          </div>
        </>
      )}

      <div className="tabs">
        <div
          className={`tab ${tab === 'tasks' ? 'tab--active' : ''}`}
          onClick={() => switchTab('tasks')}
          role="tab"
          aria-selected={tab === 'tasks'}
        >
          <Icon name="graph" size={12} /> Görevler
          {runningTasks > 0 && <span className="tab__count">{runningTasks}</span>}
          {failedTasks > 0 && (
            <span className="chip chip--rose" style={{ marginLeft: 6, fontSize: 10 }}>
              {failedTasks} hata
            </span>
          )}
        </div>
        <div
          className={`tab ${tab === 'approvals' ? 'tab--active' : ''}`}
          onClick={() => switchTab('approvals')}
          role="tab"
          aria-selected={tab === 'approvals'}
        >
          <Icon name="approvals" size={12} /> Onaylar
          {pendingApprovals > 0 && (
            <span className="tab__count" style={{ color: 'var(--amber)' }}>
              {pendingApprovals}
            </span>
          )}
        </div>
      </div>

      <div role="tabpanel">
        {tab === 'tasks' ? <TasksPage embedded /> : <ApprovalsPage embedded />}
      </div>
    </>
  );

  if (embedded) return body;
  return <div className="page">{body}</div>;
};

export default WorkQueuePage;
