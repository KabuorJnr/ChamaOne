import { useEffect, useRef } from 'react';
import gsap from 'gsap';

// Branded loading intro: a bimetallic ChamaOne shilling (steel ring + gold
// centre, in the style of Kenyan coins) spins in circles, then drops with a
// bounce and fades out — revealing the login page beneath. Plays once on mount,
// then calls onDone. Respects prefers-reduced-motion.
export default function CoinIntro({ onDone }) {
  const rootRef = useRef(null);
  const coinRef = useRef(null);
  const shadowRef = useRef(null);

  useEffect(() => {
    let finished = false;
    const finish = () => { if (!finished) { finished = true; onDone(); } };

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (reduce) { const t = setTimeout(finish, 300); return () => clearTimeout(t); }

    // Safety net: never trap the user on the intro if the animation stalls
    // (e.g. a backgrounded tab pausing rAF) — reveal the login regardless.
    const failsafe = setTimeout(finish, 4200);

    const tl = gsap.timeline({ onComplete: finish });
    tl.set(coinRef.current, { scale: 0, rotationY: 0, y: -40, opacity: 0 })
      .set(shadowRef.current, { scaleX: 0.2, opacity: 0 })
      .to(coinRef.current, { scale: 1, opacity: 1, y: 0, duration: 0.45, ease: 'back.out(1.8)' })
      .to(coinRef.current, { rotationY: 1440, duration: 1.15, ease: 'power1.inOut' }, '<0.05')
      .to(shadowRef.current, { scaleX: 0.9, opacity: 0.35, duration: 0.9 }, '<')
      .to(coinRef.current, { y: 210, rotationX: 18, duration: 0.7, ease: 'bounce.out' }, '-=0.2')
      .to(shadowRef.current, { scaleX: 1.2, opacity: 0.18, duration: 0.7, ease: 'bounce.out' }, '<')
      .to(coinRef.current, { scale: 0.15, opacity: 0, duration: 0.3, ease: 'power2.in' }, '-=0.02')
      .to(rootRef.current, { opacity: 0, duration: 0.4, ease: 'power2.out' }, '-=0.12');

    return () => { clearTimeout(failsafe); tl.kill(); };
  }, [onDone]);

  return (
    <div ref={rootRef} className="cha-intro">
      <div className="cha-intro-stage">
        <div ref={coinRef} className="cha-coin3d" aria-hidden="true">
          <Coin />
        </div>
      </div>
      <span ref={shadowRef} className="cha-coin-shadow" aria-hidden="true" />
      <div className="cha-intro-word">ChamaOne</div>
    </div>
  );
}

// A bimetallic ChamaOne shilling. Steel outer ring with circular lettering,
// gold inner disc carrying the three-member "group pool" mark.
function Coin() {
  return (
    <svg viewBox="0 0 280 280" width="140" height="140" className="cha-coin-svg">
      <defs>
        <radialGradient id="cSteel" cx="0.38" cy="0.32" r="0.85">
          <stop offset="0" stopColor="#F4F7FB" />
          <stop offset="0.45" stopColor="#C9D3E0" />
          <stop offset="0.8" stopColor="#9AA7B8" />
          <stop offset="1" stopColor="#6B7789" />
        </radialGradient>
        <radialGradient id="cGold" cx="0.42" cy="0.34" r="0.8">
          <stop offset="0" stopColor="#FDE9A7" />
          <stop offset="0.4" stopColor="#F6C64B" />
          <stop offset="0.75" stopColor="#E0930F" />
          <stop offset="1" stopColor="#B4740A" />
        </radialGradient>
        <path id="cTop" d="M 44 140 A 96 96 0 0 0 236 140" fill="none" />
        <path id="cBot" d="M 236 140 A 96 96 0 0 0 44 140" fill="none" />
      </defs>

      {/* reeded steel rim */}
      <circle cx="140" cy="140" r="136" fill="#7C8797" />
      <circle cx="140" cy="140" r="134" fill="url(#cSteel)" />
      <circle cx="140" cy="140" r="134" fill="none" stroke="#5C6676" strokeWidth="1.5" strokeDasharray="2 3" opacity="0.5" />

      {/* circular legend on the steel ring */}
      <g fill="#41505f" fontFamily="'Segoe UI', system-ui, sans-serif" fontWeight="700" letterSpacing="3">
        <text fontSize="20"><textPath href="#cTop" startOffset="50%" textAnchor="middle">CHAMAONE</textPath></text>
        <text fontSize="15"><textPath href="#cBot" startOffset="50%" textAnchor="middle">★ SHILINGI YA CHAMA ★</textPath></text>
      </g>

      {/* gold centre */}
      <circle cx="140" cy="140" r="98" fill="#8a5a09" />
      <circle cx="140" cy="140" r="95" fill="url(#cGold)" />
      <circle cx="140" cy="140" r="95" fill="none" stroke="#FBE7A0" strokeOpacity="0.6" strokeWidth="2" />

      {/* three-member "group pool" mark */}
      <g>
        <path d="M140 78 L86 175 L194 175 Z" fill="none" stroke="#9A5B08" strokeOpacity="0.55" strokeWidth="6" strokeLinejoin="round" />
        <Member cx={140} cy={82} r={17} sr={20} />
        <Member cx={92} cy={171} r={15} sr={18} />
        <Member cx={188} cy={171} r={15} sr={18} />
        <circle cx="140" cy="150" r="30" fill="#8a5a09" />
        <circle cx="140" cy="150" r="24" fill="#FCD34D" stroke="#9A5B08" strokeOpacity="0.6" strokeWidth="3" />
        <text x="140" y="150" fontSize="26" fontWeight="900" fill="#8a5108" textAnchor="middle" dominantBaseline="central" fontFamily="'Segoe UI', system-ui, sans-serif">1</text>
      </g>
    </svg>
  );
}

function Member({ cx, cy, r, sr }) {
  return (
    <g fill="#7a4c07">
      <circle cx={cx} cy={cy} r={r} />
      <rect x={cx - sr} y={cy + r * 0.35} width={sr * 2} height={sr * 1.1} rx={sr * 0.6} />
    </g>
  );
}
