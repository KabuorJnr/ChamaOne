import { useState } from 'react';
import {
  FolderPlus, Target, Coins, TrendingUp, CheckCircle, Clock, Plus, Trash2, CheckCircle2,
  Calendar, Layers, Sparkles
} from 'lucide-react';
import { fmtKES, SecHead, useUI } from './kit';
import { openNewProject, openAllocateProject } from './forms';

export function ProjectsScreen({ store }) {
  const ui = useUI();
  const canMoney = store.canManageMoney();
  const projects = store.getProjects();
  const pool = store.poolBalance();

  const totalBudget = projects.reduce((t, p) => t + (p.targetBudget || 0), 0);
  const totalAllocated = projects.reduce((t, p) => t + (p.allocatedAmount || 0), 0);
  const fundedCount = projects.filter((p) => p.status === 'funded' || p.status === 'completed').length;

  const toggleComplete = (p) => {
    const nextStatus = p.status === 'completed' ? 'active' : 'completed';
    store.updateProject(p.id, { status: nextStatus });
    ui.toast(nextStatus === 'completed' ? `Project "${p.title}" marked as complete!` : `Project reopened`);
  };

  const handleDelete = (p) => {
    ui.confirm(
      `Delete project "${p.title}"?`,
      'This project record will be removed. Pool ledger allocations remain intact for accounting.',
      () => {
        store.deleteProject(p.id);
        ui.toast('Project deleted');
      }
    );
  };

  return (
    <>
      {/* Hero Overview */}
      <div className="cha-hero-card" style={{ background: 'linear-gradient(145deg, #047857 0%, #059669 50%, #0D9488 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="cha-pill" style={{ background: 'rgba(255,255,255,.18)', color: '#fff' }}>
            CHAMA PROJECTS & INVESTMENTS
          </span>
          <span className="cha-pill" style={{ background: 'rgba(255,255,255,.22)', color: '#fff' }}>
            {projects.length} {projects.length === 1 ? 'Project' : 'Projects'}
          </span>
        </div>

        <div className="cha-hero-lb" style={{ marginTop: 12 }}>Total Funds Allocated From Pool</div>
        <div className="cha-hero-amt cha-num" style={{ color: '#fff' }}>{fmtKES(totalAllocated)}</div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,.15)', paddingTop: 10, marginTop: 12 }}>
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.85)' }}>
            Target Budget: <b>{fmtKES(totalBudget)}</b> · <b>{fundedCount}</b> funded
          </div>
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.85)' }}>
            Chama Pool: <b>{fmtKES(pool)}</b>
          </div>
        </div>
      </div>

      {/* Action Buttons for Officers */}
      {canMoney && (
        <div style={{ display: 'flex', gap: 8, margin: '14px 0 6px' }}>
          <button
            className="cha-btn"
            style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            onClick={() => openNewProject(ui, store)}
          >
            <Plus size={16} /> New Project
          </button>
          <button
            className="cha-btn cha-btn-ghost"
            style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            onClick={() => openAllocateProject(ui, store)}
          >
            <Coins size={16} /> Allocate Funds
          </button>
        </div>
      )}

      {/* Projects List */}
      <SecHead title="All Chama Projects" />

      {projects.length === 0 ? (
        <div className="cha-card" style={{ textAlign: 'center', padding: '32px 16px' }}>
          <Layers size={36} style={{ color: 'var(--muted)', margin: '0 auto 10px' }} />
          <div style={{ fontWeight: 700, fontSize: 15 }}>No projects started yet</div>
          <p className="cha-muted cha-small" style={{ maxWidth: 280, margin: '6px auto 14px' }}>
            Pool your Chama funds into joint investments like land buying, poultry farming, welfare kitties, or asset purchases.
          </p>
          {canMoney && (
            <button className="cha-btn cha-btn-sm" onClick={() => openNewProject(ui, store)}>
              <Plus size={14} /> Start First Project
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {projects.map((p) => {
            const allocated = p.allocatedAmount || 0;
            const target = p.targetBudget || 1;
            const pct = Math.min(100, Math.round((allocated / target) * 100));
            const isFunded = allocated >= target;
            const isCompleted = p.status === 'completed';

            return (
              <div key={p.id} className="cha-card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <span
                      className="cha-pill2"
                      style={{
                        fontSize: 10.5,
                        textTransform: 'uppercase',
                        letterSpacing: '.04em',
                        marginBottom: 6,
                        display: 'inline-block',
                      }}
                    >
                      {p.category || 'Investment'}
                    </span>
                    <h3 style={{ margin: '2px 0 4px', fontSize: 16, fontWeight: 800 }}>{p.title}</h3>
                  </div>

                  <span
                    className={`cha-pill2 ${isCompleted ? 'cha-pill-ok' : isFunded ? 'cha-pill-ok' : 'cha-pill-info'}`}
                    style={{ fontSize: 11, fontWeight: 700 }}
                  >
                    {isCompleted ? 'Completed' : isFunded ? 'Fully Funded' : 'In Progress'}
                  </span>
                </div>

                {p.description && (
                  <p className="cha-muted cha-small" style={{ margin: '4px 0 10px' }}>
                    {p.description}
                  </p>
                )}

                {/* Progress bar */}
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span className="cha-num" style={{ fontWeight: 700, color: 'var(--ink)' }}>{fmtKES(allocated)}</span>
                    <span className="cha-muted cha-num">Target: {fmtKES(p.targetBudget)} ({pct}%)</span>
                  </div>
                  <div style={{ height: 7, borderRadius: 99, background: 'var(--line)', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: isFunded ? 'var(--good)' : 'var(--blue)',
                        borderRadius: 99,
                        transition: 'width .3s ease',
                      }}
                    />
                  </div>
                </div>

                {p.targetDate && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--muted)', marginTop: 10 }}>
                    <Calendar size={13} />
                    <span>Target completion: {new Date(p.targetDate).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                )}

                {/* Action footer */}
                {canMoney && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                    {!isFunded && !isCompleted && (
                      <button
                        className="cha-btn cha-btn-sm"
                        style={{ fontSize: 12, padding: '6px 12px' }}
                        onClick={() => openAllocateProject(ui, store, p.id)}
                      >
                        <Coins size={13} /> Allocate Funds
                      </button>
                    )}
                    <button
                      className="cha-btn cha-btn-ghost cha-btn-sm"
                      style={{ fontSize: 12, padding: '6px 10px' }}
                      onClick={() => toggleComplete(p)}
                    >
                      {isCompleted ? 'Reopen' : 'Mark Done'}
                    </button>
                    <button
                      className="cha-btn cha-btn-ghost cha-btn-sm"
                      style={{ color: 'var(--bad)', padding: '6px 10px', marginLeft: 'auto' }}
                      onClick={() => handleDelete(p)}
                      title="Delete project"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
