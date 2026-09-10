import { useState } from 'react';
import {
  RotateCcw, Gift, CheckCircle2, Clock, ArrowUpRight, ArrowDown, ArrowUp, UserCheck, Sparkles,
  ChevronRight, AlertCircle, Award, HandCoins
} from 'lucide-react';
import { fmtKES, SecHead, Avatar, useUI } from './kit';
import { openDisburseRotation } from './forms';

export function RotationScreen({ store }) {
  const ui = useUI();
  const canMoney = store.canManageMoney();
  const rot = store.getRotation();
  const queue = rot.queue;
  const currentRecipient = rot.recipient;
  const history = rot.history || [];

  const handleSetRecipient = (memberId, name) => {
    store.setRotationRecipient(memberId);
    ui.toast(`${name} is now the next payout recipient`);
  };

  const moveUp = (index) => {
    if (index <= 0) return;
    const newOrder = [...rot.order];
    const temp = newOrder[index - 1];
    newOrder[index - 1] = newOrder[index];
    newOrder[index] = temp;
    store.reorderRotation(newOrder);
    ui.toast('Roster order updated');
  };

  const moveDown = (index) => {
    if (index >= rot.order.length - 1) return;
    const newOrder = [...rot.order];
    const temp = newOrder[index + 1];
    newOrder[index + 1] = newOrder[index];
    newOrder[index] = temp;
    store.reorderRotation(newOrder);
    ui.toast('Roster order updated');
  };

  const potAmount = rot.collected > 0 ? rot.collected : rot.targetPot;
  const isReady = rot.isReady || rot.collected >= rot.targetPot;

  return (
    <>
      {/* Current Turn Hero Card */}
      <div className="cha-hero-card" style={{ background: 'linear-gradient(145deg, #1E40AF 0%, #1D4ED8 50%, #4338CA 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="cha-pill" style={{ background: 'rgba(255,255,255,.18)', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <RotateCcw size={11} /> MERRY-GO-ROUND
          </span>
          <span className="cha-pill" style={{ background: isReady ? 'var(--good)' : 'rgba(255,255,255,.22)', color: '#fff' }}>
            {isReady ? 'Pot Ready for Hand-off' : 'Collecting Contributions'}
          </span>
        </div>

        <div className="cha-hero-lb" style={{ marginTop: 14 }}>Current Cycle Payout Recipient</div>

        {currentRecipient ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, marginBottom: 12 }}>
            <Avatar name={currentRecipient.name} size={46} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{currentRecipient.name}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.75)' }}>{currentRecipient.phone || 'Designated recipient this round'}</div>
            </div>
          </div>
        ) : (
          <div style={{ color: 'rgba(255,255,255,.7)', margin: '10px 0' }}>No members in queue yet</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px solid rgba(255,255,255,.15)', paddingTop: 12 }}>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'rgba(255,255,255,.7)' }}>Payout Pot</div>
            <div className="cha-num" style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>{fmtKES(potAmount)}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.7)' }}>
              Collected: {fmtKES(rot.collected)} / Target: {fmtKES(rot.targetPot)}
            </div>
          </div>

          {canMoney && currentRecipient && (
            <button
              className="cha-btn cha-btn-sm"
              style={{ background: '#fff', color: '#1E40AF', fontWeight: 800, padding: '9px 15px', borderRadius: 10, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              onClick={() => openDisburseRotation(ui, store)}
            >
              <HandCoins size={15} /> Disburse Pot
            </button>
          )}
        </div>
      </div>

      {/* Rotation Queue Roster */}
      <SecHead
        title="Payout Rotation Roster"
        badge={`${queue.length} members`}
      />

      <p className="cha-muted cha-small" style={{ margin: '-4px 0 10px 2px' }}>
        The full pot is given to a single member in turn each cycle. Officers can adjust order or re-assign if members agree.
      </p>

      <div className="cha-list-card">
        {queue.map((m, idx) => {
          const isTurn = m.id === currentRecipient?.id;
          return (
            <div
              key={m.id}
              className="cha-li"
              style={{
                background: isTurn ? 'var(--blue-50)' : 'transparent',
                borderColor: isTurn ? 'var(--blue-100)' : undefined,
                alignItems: 'center',
                padding: '12px 14px',
              }}
            >
              <span
                style={{
                  width: 24,
                  fontSize: 12,
                  fontWeight: 800,
                  color: isTurn ? 'var(--blue)' : 'var(--muted)',
                  textAlign: 'center',
                  marginRight: 4,
                }}
              >
                #{idx + 1}
              </span>

              <Avatar name={m.name} size={36} />

              <div className="cha-lt" style={{ minWidth: 0 }}>
                <b style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {m.name}
                  {isTurn && (
                    <span className="cha-pill2 cha-pill-info" style={{ fontSize: 10.5, padding: '1px 6px', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <Award size={11} /> Next in line
                    </span>
                  )}
                </b>
                <span>{m.phone || m.role}</span>
              </div>

              {canMoney && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: '0 0 auto' }}>
                  {!isTurn && (
                    <button
                      className="cha-chip2"
                      style={{ fontSize: 11, padding: '4px 8px' }}
                      onClick={() => handleSetRecipient(m.id, m.name)}
                    >
                      Make Next
                    </button>
                  )}
                  <button
                    className="cha-chip2"
                    style={{ padding: '4px 6px' }}
                    onClick={() => moveUp(idx)}
                    disabled={idx === 0}
                    title="Move up in order"
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    className="cha-chip2"
                    style={{ padding: '4px 6px' }}
                    onClick={() => moveDown(idx)}
                    disabled={idx === queue.length - 1}
                    title="Move down in order"
                  >
                    <ArrowDown size={13} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Payout History */}
      <SecHead title="Rotation Payout History" />
      {history.length === 0 ? (
        <div className="cha-card" style={{ textAlign: 'center', padding: '24px 16px' }}>
          <Clock size={32} style={{ color: 'var(--muted)', margin: '0 auto 8px' }} />
          <div style={{ fontWeight: 700, fontSize: 14 }}>No rotation payouts yet</div>
          <div className="cha-muted cha-small">When a cycle pot is disbursed, the record and audit trail appear here.</div>
        </div>
      ) : (
        <div className="cha-list-card">
          {history.map((h) => (
            <div key={h.id} className="cha-li" style={{ cursor: 'default' }}>
              <span className="cha-lic" style={{ background: 'var(--good-100)', color: 'var(--good)' }}>
                <CheckCircle2 size={18} />
              </span>
              <div className="cha-lt">
                <b>{h.recipientName}</b>
                <span>{new Date(h.date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <b className="cha-num" style={{ color: 'var(--good)', fontSize: 14 }}>{fmtKES(h.amount)}</b>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Disbursed</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
