/**
 * Vaibey — vAIbes' official typing mascot
 *
 * Props:
 *   mode       — 'explain' | 'summarize' | 'analyze' | 'writeDraft' | 'quizMe'
 *   onResponse — boolean, flips true when AI response arrives
 *   isDark     — boolean from useTheme
 *   size       — pixel multiplier (default 4)
 *   showBadge  — show WPM / status badge (default true)
 *   autoPlay   — boolean, self-drives typing animation (for landing page / demos)
 */
import { useState, useEffect, useRef, useCallback } from 'react';

const HEAT = {
  0: { body: '#1e88ff', bodyAlt: '#0356c5', eye: '#8cc3ff', nose: '#4dabf5', blush: null,                    steam: null,      glow: 'rgba(30,136,255,0.25)'  },
  1: { body: '#0356c5', bodyAlt: '#023e8a', eye: '#a5d8ff', nose: '#4dabf5', blush: null,                    steam: null,      glow: 'rgba(3,86,197,0.35)'   },
  2: { body: '#1c7ed6', bodyAlt: '#1864ab', eye: '#d0ebff', nose: '#74c0fc', blush: 'rgba(116,192,252,0.4)', steam: '#4dabf5', glow: 'rgba(28,126,214,0.45)' },
  3: { body: '#339af0', bodyAlt: '#228be6', eye: '#e7f5ff', nose: '#a5d8ff', blush: 'rgba(165,216,255,0.5)', steam: '#74c0fc', glow: 'rgba(51,154,240,0.55)' },
};

const STATUS_COLOR = ['#4dabf5', '#74c0fc', '#a5d8ff', '#d0ebff'];

const MODE_CONFIG = {
  explain:    { emoji: '💡', label: 'Explain',   reaction: '💡', accessory: 'bulb'    },
  summarize:  { emoji: '📋', label: 'Summarize', reaction: '📋', accessory: 'scroll'  },
  analyze:    { emoji: '🔍', label: 'Analyze',   reaction: '🔍', accessory: 'lens'    },
  writeDraft: { emoji: '✍️', label: 'Draft',     reaction: '✨', accessory: 'pencil'  },
  quizMe:     { emoji: '🧠', label: 'Quiz Me',   reaction: '🎓', accessory: 'glasses' },
};

const AUTO_SEQUENCES = [
  { wpm: 40,  label: 'Typing',       heat: 0, duration: 3000 },
  { wpm: 80,  label: 'Warming up',   heat: 1, duration: 2500 },
  { wpm: 120, label: 'Overheating',  heat: 2, duration: 2000 },
  { wpm: 180, label: 'BLAZING',      heat: 3, duration: 1800 },
  { wpm: 0,   label: 'idle',         heat: 0, duration: 2000 },
];

function SteamParticle({ x, delay, color }) {
  return (
    <div style={{
      position: 'absolute', left: x, bottom: '78%',
      width: 6, height: 6, borderRadius: '50%',
      background: color,
      animation: `vaibey-steam 1s ease-out ${delay}s infinite`,
      pointerEvents: 'none',
    }} />
  );
}

function ReactionBubble({ emoji }) {
  return (
    <div style={{
      position: 'absolute', top: -28, left: '50%',
      transform: 'translateX(-50%)',
      fontSize: 18,
      animation: 'vaibey-reaction 1.6s ease-out forwards',
      pointerEvents: 'none',
      filter: 'drop-shadow(0 2px 6px rgba(124,58,237,0.5))',
      zIndex: 10,
    }}>
      {emoji}
    </div>
  );
}

function ModeAccessory({ mode, p }) {
  const acc = MODE_CONFIG[mode]?.accessory;
  if (!acc) return null;
  switch (acc) {
    case 'glasses':
      return (
        <g>
          <rect x={p*5.2} y={p*3.2} width={p*3} height={p*2} fill="none" stroke="#60a5fa" strokeWidth={p*0.35} rx={p*0.4}/>
          <rect x={p*10.8} y={p*3.2} width={p*3} height={p*2} fill="none" stroke="#60a5fa" strokeWidth={p*0.35} rx={p*0.4}/>
          <line x1={p*8.2} y1={p*4.2} x2={p*10.8} y2={p*4.2} stroke="#60a5fa" strokeWidth={p*0.3}/>
          <line x1={p*5.2} y1={p*4.2} x2={p*4.2}  y2={p*4.2} stroke="#60a5fa" strokeWidth={p*0.3}/>
          <line x1={p*13.8} y1={p*4.2} x2={p*14.8} y2={p*4.2} stroke="#60a5fa" strokeWidth={p*0.3}/>
        </g>
      );
    case 'pencil':
      return (
        <g transform={`translate(${p*13.5}, ${p*-1}) rotate(35)`}>
          <rect x={0} y={0} width={p*1.2} height={p*5} fill="#fbbf24" rx={p*0.2}/>
          <polygon points={`0,${p*5} ${p*1.2},${p*5} ${p*0.6},${p*6.5}`} fill="#f87171"/>
          <rect x={0} y={0} width={p*1.2} height={p*0.8} fill="#9ca3af"/>
        </g>
      );
    case 'lens':
      return (
        <g transform={`translate(${p*13}, ${p*0})`}>
          <circle cx={p*1.5} cy={p*1.5} r={p*1.5} fill="none" stroke="#34d399" strokeWidth={p*0.4}/>
          <line x1={p*2.5} y1={p*2.5} x2={p*3.5} y2={p*3.5} stroke="#34d399" strokeWidth={p*0.5} strokeLinecap="round"/>
          <circle cx={p*1} cy={p*1} r={p*0.4} fill="rgba(255,255,255,0.3)"/>
        </g>
      );
    case 'scroll':
      return (
        <g transform={`translate(${p*13.5}, ${p*0.5})`}>
          <rect x={0} y={0} width={p*3} height={p*2.5} fill="#fde68a" rx={p*0.3}/>
          <line x1={p*0.4} y1={p*0.7} x2={p*2.6} y2={p*0.7} stroke="#92400e" strokeWidth={p*0.25}/>
          <line x1={p*0.4} y1={p*1.2} x2={p*2.6} y2={p*1.2} stroke="#92400e" strokeWidth={p*0.25}/>
          <line x1={p*0.4} y1={p*1.7} x2={p*2}   y2={p*1.7} stroke="#92400e" strokeWidth={p*0.25}/>
          <rect x={-p*0.3} y={-p*0.3} width={p*0.7} height={p*3} fill="#f59e0b" rx={p*0.3}/>
          <rect x={p*2.6}  y={-p*0.3} width={p*0.7} height={p*3} fill="#f59e0b" rx={p*0.3}/>
        </g>
      );
    case 'bulb':
      return (
        <g transform={`translate(${p*13.5}, ${p*-1.5})`}>
          <circle cx={p*1.2} cy={p*1.2} r={p*1.2} fill="#fef08a" opacity="0.9"/>
          <rect x={p*0.6} y={p*2.2} width={p*1.2} height={p*0.6} fill="#d1d5db"/>
          <rect x={p*0.6} y={p*2.9} width={p*1.2} height={p*0.6} fill="#d1d5db"/>
          <line x1={p*1.2} y1={p*-0.2} x2={p*1.2} y2={p*-0.8} stroke="#fbbf24" strokeWidth={p*0.3}/>
          <line x1={p*2.6} y1={p*0.2}  x2={p*3}   y2={p*-0.2} stroke="#fbbf24" strokeWidth={p*0.3}/>
          <line x1={p*-0.2} y1={p*0.2} x2={p*-0.6} y2={p*-0.2} stroke="#fbbf24" strokeWidth={p*0.3}/>
        </g>
      );
    default: return null;
  }
}

function Vaibey({ leftDown, rightDown, heat, bobOffset, mode, isHappy, p = 4, isDark }) {
  const c  = HEAT[Math.min(heat, 3)];
  const lY = leftDown  ? p * 1.3 : p * -0.4;
  const rY = rightDown ? p * 1.3 : p * -0.4;

  const eyeContent = isHappy ? (
    <>
      <path d={`M${p*5.5},${p*4.5} Q${p*6.8},${p*3.2} ${p*8},${p*4.5}`}   fill="none" stroke={c.eye} strokeWidth={p*0.5} strokeLinecap="round"/>
      <path d={`M${p*11},${p*4.5} Q${p*12.2},${p*3.2} ${p*13.5},${p*4.5}`} fill="none" stroke={c.eye} strokeWidth={p*0.5} strokeLinecap="round"/>
    </>
  ) : (
    <>
      <rect x={p*5.5}  y={p*3.5} width={p*2.5} height={p*2.5} fill={c.eye} rx={p*0.4}/>
      <rect x={p*11}   y={p*3.5} width={p*2.5} height={p*2.5} fill={c.eye} rx={p*0.4}/>
      <rect x={p*6.2}  y={p*4}   width={p*1.2} height={p*1.8} fill={isDark ? '#1e0040' : '#2e1065'} rx={p*0.2}/>
      <rect x={p*11.7} y={p*4}   width={p*1.2} height={p*1.8} fill={isDark ? '#1e0040' : '#2e1065'} rx={p*0.2}/>
      <rect x={p*6}    y={p*3.7} width={p*0.6} height={p*0.6} fill="white"/>
      <rect x={p*11.5} y={p*3.7} width={p*0.6} height={p*0.6} fill="white"/>
    </>
  );

  return (
    <svg width={p*22} height={p*25} viewBox={`0 0 ${p*22} ${p*25}`}
      style={{ overflow: 'visible', imageRendering: 'pixelated', display: 'block' }}
      shapeRendering="crispEdges">
      <defs>
        <linearGradient id="vaibey-key" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={isDark ? '#4c1d95' : '#7c3aed'}/>
          <stop offset="100%" stopColor={isDark ? '#2e1065' : '#5b21b6'}/>
        </linearGradient>
        <linearGradient id="vaibey-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={c.body}/>
          <stop offset="100%" stopColor={c.bodyAlt}/>
        </linearGradient>
        <linearGradient id="vaibey-glow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor={c.body}    stopOpacity="0.22"/>
          <stop offset="100%" stopColor={c.bodyAlt} stopOpacity="0"/>
        </linearGradient>
      </defs>

      {/* Keys */}
      <rect x={p*0}   y={p*18.5+lY} width={p*8.5} height={p*2.5} fill="rgba(0,0,0,0.3)"  rx={p*0.5}/>
      <rect x={p*0}   y={p*16+lY}   width={p*8.5} height={p*3}   fill="url(#vaibey-key)" rx={p*0.5}/>
      <rect x={p*0.5} y={p*16.3+lY} width={p*7.5} height={p*1}   fill="rgba(255,255,255,0.1)" rx={p*0.3}/>
      <rect x={p*12}  y={p*18.5+rY} width={p*8.5} height={p*2.5} fill="rgba(0,0,0,0.3)"  rx={p*0.5}/>
      <rect x={p*12}  y={p*16+rY}   width={p*8.5} height={p*3}   fill="url(#vaibey-key)" rx={p*0.5}/>
      <rect x={p*12.5} y={p*16.3+rY} width={p*7.5} height={p*1}  fill="rgba(255,255,255,0.1)" rx={p*0.3}/>

      {/* Body */}
      <g transform={`translate(0,${bobOffset})`}>
        {[[16,10],[17,8],[18,6],[17,4]].map(([x,y],i) => (
          <rect key={i} x={p*x} y={p*y} width={p*2.5} height={p*2} fill="url(#vaibey-body)"/>
        ))}
        <rect x={p*17.3} y={p*4.2} width={p*1} height={p*1} fill="rgba(255,255,255,0.18)"/>
        <rect x={p*3} y={p*9}  width={p*13} height={p*7} fill="url(#vaibey-body)" rx={p*0.7}/>
        <rect x={p*4} y={p*9.5} width={p*5} height={p*1} fill="rgba(255,255,255,0.1)" rx={p*0.3}/>
        <rect x={p*4} y={p*1.5} width={p*11} height={p*8.5} fill="url(#vaibey-body)" rx={p*1.2}/>
        <rect x={p*5} y={p*2}   width={p*6}  height={p*1.5} fill="rgba(255,255,255,0.12)" rx={p*0.5}/>
        <polygon points={`${p*4.5},${p*3} ${p*5.5},${p*0.5} ${p*7.5},${p*3}`}    fill={c.body}/>
        <polygon points={`${p*13.5},${p*3} ${p*14.5},${p*0.5} ${p*15.5},${p*3}`} fill={c.body}/>
        <polygon points={`${p*5},${p*2.8} ${p*5.8},${p*1.2} ${p*7},${p*2.8}`}    fill="rgba(255,255,255,0.08)"/>
        <polygon points={`${p*13.8},${p*2.8} ${p*14.5},${p*1.2} ${p*15.2},${p*2.8}`} fill="rgba(255,255,255,0.08)"/>
        {eyeContent}
        <rect x={p*9}  y={p*6}  width={p*1.5} height={p*1} fill={c.nose} rx={p*0.3}/>
        {isHappy ? (
          <path d={`M${p*7.5},${p*7.2} Q${p*9.5},${p*8.5} ${p*11.5},${p*7.2}`} fill="none" stroke={c.nose} strokeWidth={p*0.4} strokeLinecap="round"/>
        ) : (
          <>
            <rect x={p*8.2} y={p*7.2} width={p*0.8} height={p*0.5} fill={c.nose} rx={p*0.2}/>
            <rect x={p*10}  y={p*7.2} width={p*0.8} height={p*0.5} fill={c.nose} rx={p*0.2}/>
          </>
        )}
        <rect x={p*1.5} y={p*5.8} width={p*3.5} height={p*0.4} fill="rgba(196,181,253,0.35)"/>
        <rect x={p*14}  y={p*5.8} width={p*3.5} height={p*0.4} fill="rgba(196,181,253,0.35)"/>
        <rect x={p*1.5} y={p*7}   width={p*3.5} height={p*0.4} fill="rgba(196,181,253,0.3)"/>
        <rect x={p*14}  y={p*7}   width={p*3.5} height={p*0.4} fill="rgba(196,181,253,0.3)"/>
        {c.blush && <>
          <rect x={p*5}  y={p*6} width={p*2} height={p*1} fill={c.blush} rx={p*0.4}/>
          <rect x={p*12} y={p*6} width={p*2} height={p*1} fill={c.blush} rx={p*0.4}/>
        </>}
        <rect x={p*4}  y={p*15} width={p*3.5} height={p*2.5} fill="url(#vaibey-body)" rx={p*0.3} transform={`translate(0,${lY*0.35})`}/>
        <rect x={p*12} y={p*15} width={p*3.5} height={p*2.5} fill="url(#vaibey-body)" rx={p*0.3} transform={`translate(0,${rY*0.35})`}/>
        <ModeAccessory mode={mode} p={p}/>
      </g>
    </svg>
  );
}

const QUIPS = [
  "let me explain that... 💡",
  "study mode: activated 🎧",
  "i annotate, therefore i am",
  "your AI bestie is here!",
  "coffee? i run on context ☕",
  "drop your notes. i got you.",
  "no cap, AI is actually fun",
  "less cringe, more vibe ✨",
  "summarize? already done 😎",
  "i don't sleep. i learn.",
  "peek-a-boo, i see your notes 👀",
  "shhh... i'm computing 🤫",
  "type something, i dare you 😼",
  "big brain energy only 🧠",
  "loading genius... please wait ⏳",
];

export default function TypingCat({
  mode = 'explain',
  onResponse = false,
  isDark = true,
  size = 4,
  showBadge = true,
  autoPlay = false,
  showQuip = false,   // show speech bubble with rotating quips
  peekBounce = false, // enable the vertical peek/jump animation
}) {
  const [leftDown,    setLeftDown]    = useState(false);
  const [rightDown,   setRightDown]   = useState(false);
  const [heat,        setHeat]        = useState(0);
  const [bob,         setBob]         = useState(0);
  const [steam,       setSteam]       = useState(false);
  const [wpm,         setWpm]         = useState(0);
  const [status,      setStatus]      = useState('idle');
  const [isHappy,     setIsHappy]     = useState(false);
  const [reaction,    setReaction]    = useState(null);
  const [reactionKey, setReactionKey] = useState(0);

  // Quip bubble state
  const [quipIdx,     setQuipIdx]     = useState(0);
  const [quipVisible, setQuipVisible] = useState(true);

  // Peek/jump animation state
  const [peekY,       setPeekY]       = useState(0);

  // Vaibey on/off — persisted so it survives refresh
  const [vaibeyOn, setVaibeyOn] = useState(() => {
    try { return localStorage.getItem('vaibey_visible') !== 'false'; }
    catch { return true; }
  });

  const toggleVaibey = () => {
    setVaibeyOn(prev => {
      const next = !prev;
      try { localStorage.setItem('vaibey_visible', String(next)); } catch {}
      return next;
    });
  };

  const strokes      = useRef([]);
  const idleRef      = useRef(null);
  const decayRef     = useRef(null);
  const happyRef     = useRef(null);
  const toggle       = useRef(false);
  const prevResponse = useRef(false);

  // Tracks whether the keyboard-driven typing is active.
  // Antics only fire when this is false (true idle) to
  // avoid fighting with real keystrokes.
  const isTypingActiveRef = useRef(false);

  // ── autoPlay: simulate keystrokes at varying WPM ────────────────────────
  useEffect(() => {
    if (!autoPlay) return;

    let seqIdx         = 0;
    let seqTimeout     = null;
    let strokeInterval = null;

    const applySeq = (seq) => {
      if (strokeInterval) clearInterval(strokeInterval);
      if (seq.wpm === 0) {
        setLeftDown(false); setRightDown(false);
        setBob(0); setSteam(false);
        setHeat(0); setWpm(0); setStatus('idle');
        return;
      }
      const intervalMs = Math.round(60000 / (seq.wpm * 5));
      setStatus(seq.label);
      setHeat(seq.heat);
      setSteam(seq.heat >= 2);
      setWpm(seq.wpm);

      strokeInterval = setInterval(() => {
        toggle.current = !toggle.current;
        if (toggle.current) { setLeftDown(true);  setRightDown(false); }
        else                { setLeftDown(false); setRightDown(true);  }
        setBob(-2);
        setTimeout(() => setBob(0), 70);
      }, intervalMs);
    };

    const cycleSeq = () => {
      const seq = AUTO_SEQUENCES[seqIdx % AUTO_SEQUENCES.length];
      applySeq(seq);
      seqIdx++;
      seqTimeout = setTimeout(cycleSeq, seq.duration);
    };

    cycleSeq();

    return () => {
      clearInterval(strokeInterval);
      clearTimeout(seqTimeout);
    };
  }, [autoPlay, mode]);

  // ── Quip rotation ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!showQuip) return;
    const id = setInterval(() => {
      setQuipVisible(false);
      setTimeout(() => {
        setQuipIdx(i => (i + 1) % QUIPS.length);
        setQuipVisible(true);
      }, 300);
    }, 3200);
    return () => clearInterval(id);
  }, [showQuip]);

  // ── Peek/bounce animation ─────────────────────────────────────────────────
  useEffect(() => {
    if (!peekBounce) return;
    let timeout;
    const moves = [
      () => { setPeekY(-60); setTimeout(() => setPeekY(0), 600); },
      () => { setPeekY(-100); setTimeout(() => setPeekY(10), 350); setTimeout(() => setPeekY(0), 600); },
      () => { setPeekY(-30); setTimeout(() => setPeekY(0), 300); },
      () => {
        setPeekY(-50);
        setTimeout(() => setPeekY(0), 280);
        setTimeout(() => setPeekY(-80), 550);
        setTimeout(() => setPeekY(0), 900);
      },
      () => { setPeekY(-85); setTimeout(() => setPeekY(0), 1100); },
      () => { setPeekY(-65); setTimeout(() => setPeekY(12), 450); setTimeout(() => setPeekY(0), 700); },
      () => {
        setPeekY(-45);
        setTimeout(() => setPeekY(0), 200);
        setTimeout(() => setPeekY(-70), 350);
        setTimeout(() => setPeekY(0), 600);
      },
    ];
    const schedule = () => {
      const delay = 1200 + Math.random() * 2300;
      timeout = setTimeout(() => { moves[Math.floor(Math.random() * moves.length)](); schedule(); }, delay);
    };
    schedule();
    return () => clearTimeout(timeout);
  }, [peekBounce]);

  // ── Idle antics: always-on, fires for both autoPlay AND keyboard Vaibey ──
  // Guard: only triggers when the cat is truly idle (no active keystrokes).
  // For autoPlay this runs alongside the sequences. For keyboard-Vaibey in
  // AIComparison, this IS the animation — landing-page-style reactions in
  // the gaps between real typing.
  useEffect(() => {
    let anticTimeout = null;

    const ANTICS = [
      // sudden joy burst
      () => {
        if (isTypingActiveRef.current && !autoPlay) return;
        const emoji = MODE_CONFIG[mode]?.reaction || '✨';
        setIsHappy(true);
        setReaction(emoji);
        setReactionKey(k => k + 1);
        clearTimeout(happyRef.current);
        happyRef.current = setTimeout(() => { setIsHappy(false); setReaction(null); }, 1600);
      },
      // exaggerated key slam (both sides down briefly)
      () => {
        if (isTypingActiveRef.current && !autoPlay) return;
        setLeftDown(true); setRightDown(true);
        setBob(-5);
        setTimeout(() => { setLeftDown(false); setRightDown(false); setBob(0); }, 180);
      },
      // rapid fire burst
      () => {
        if (isTypingActiveRef.current && !autoPlay) return;
        let count = 0;
        const burst = setInterval(() => {
          toggle.current = !toggle.current;
          if (toggle.current) { setLeftDown(true); setRightDown(false); }
          else                { setLeftDown(false); setRightDown(true); }
          setBob(-3);
          setTimeout(() => setBob(0), 50);
          if (++count > 14) clearInterval(burst);
        }, 55);
      },
      // double-tap left only
      () => {
        if (isTypingActiveRef.current && !autoPlay) return;
        setLeftDown(true); setBob(-4);
        setTimeout(() => { setLeftDown(false); setBob(0); }, 120);
        setTimeout(() => { setLeftDown(true);  setBob(-4); }, 250);
        setTimeout(() => { setLeftDown(false); setBob(0); }, 380);
      },
      // star burst reaction with bob
      () => {
        if (isTypingActiveRef.current && !autoPlay) return;
        setReaction('⭐'); setReactionKey(k => k + 1);
        setBob(-6);
        setTimeout(() => { setBob(0); setReaction(null); }, 900);
      },
      // thinking pause
      () => {
        if (isTypingActiveRef.current && !autoPlay) return;
        setLeftDown(false); setRightDown(false);
        setStatus('thinking…'); setBob(0);
        setTimeout(() => setStatus('idle'), 1100);
      },
      // fire emoji burst
      () => {
        if (isTypingActiveRef.current && !autoPlay) return;
        setReaction('🔥'); setReactionKey(k => k + 1);
        clearTimeout(happyRef.current);
        happyRef.current = setTimeout(() => setReaction(null), 1400);
      },
      // party celebrate
      () => {
        if (isTypingActiveRef.current && !autoPlay) return;
        setIsHappy(true);
        setReaction('🎉'); setReactionKey(k => k + 1);
        clearTimeout(happyRef.current);
        happyRef.current = setTimeout(() => { setIsHappy(false); setReaction(null); }, 2000);
      },
      // gentle single left tap (subtle — common in idle)
      () => {
        if (isTypingActiveRef.current && !autoPlay) return;
        setLeftDown(true); setBob(-2);
        setTimeout(() => { setLeftDown(false); setBob(0); }, 100);
      },
      // gentle single right tap
      () => {
        if (isTypingActiveRef.current && !autoPlay) return;
        setRightDown(true); setBob(-2);
        setTimeout(() => { setRightDown(false); setBob(0); }, 100);
      },
    ];

    const scheduleAntic = () => {
      // Tighter timing: 800–2200ms for autoPlay, 1500–4000ms for keyboard idle
      const minDelay = autoPlay ? 800  : 1500;
      const maxDelay = autoPlay ? 2200 : 4000;
      const delay = minDelay + Math.random() * (maxDelay - minDelay);

      anticTimeout = setTimeout(() => {
        const antic = ANTICS[Math.floor(Math.random() * ANTICS.length)];
        antic();
        scheduleAntic();
      }, delay);
    };

    scheduleAntic();

    return () => {
      clearTimeout(anticTimeout);
    };
  }, [autoPlay, mode]);

    // ── AI response reaction ─────────────────────────────────────────────────
  useEffect(() => {
    if (onResponse && !prevResponse.current) {
      const emoji = MODE_CONFIG[mode]?.reaction || '✨';
      setIsHappy(true); setReaction(emoji); setReactionKey(k => k + 1);
      clearTimeout(happyRef.current);
      happyRef.current = setTimeout(() => { setIsHappy(false); setReaction(null); }, 2200);
    }
    prevResponse.current = onResponse;
  }, [onResponse, mode]);

  // ── Keyboard-driven typing (only when not autoPlay) ──────────────────────
  const calcWpm = useCallback(() => {
    const now = Date.now();
    strokes.current = strokes.current.filter(t => now - t < 5000);
    return Math.round(strokes.current.length * 12);
  }, []);

  const onKey = useCallback((e) => {
    if (autoPlay) return;
    
    // ✅ Only react to the real chat box, not any other input on the page
    if (e.target?.id !== 'question-input') return;

    isTypingActiveRef.current = true;

    strokes.current.push(Date.now());
    toggle.current = !toggle.current;
    if (toggle.current) { setLeftDown(true);  setRightDown(false); }
    else                { setLeftDown(false); setRightDown(true);  }
    setBob(-3);
    setTimeout(() => setBob(0), 85);

    const w = calcWpm();
    setWpm(w);
    if      (w >= 160) { setHeat(3); setSteam(true);  setStatus('BLAZING');     }
    else if (w >= 100) { setHeat(2); setSteam(true);  setStatus('Overheating'); }
    else if (w >=  60) { setHeat(1); setSteam(false); setStatus('Warming up');  }
    else               { setHeat(0); setSteam(false); setStatus('Typing');       }

    clearTimeout(idleRef.current);
    idleRef.current = setTimeout(() => {
      setLeftDown(false); setRightDown(false);
      setBob(0); setStatus('idle'); setWpm(0);
      isTypingActiveRef.current = false;
    }, 700);

    clearTimeout(decayRef.current);
    decayRef.current = setTimeout(() => {
      setHeat(h => { const n = Math.max(0, h - 1); if (n < 2) setSteam(false); return n; });
    }, 3000);
  }, [autoPlay, calcWpm]);

  useEffect(() => {
    window.addEventListener('input', onKey);
    return () => window.removeEventListener('input', onKey);
  }, [onKey]);

  useEffect(() => () => {
    clearTimeout(idleRef.current);
    clearTimeout(decayRef.current);
    clearTimeout(happyRef.current);
  }, []);

  const c           = HEAT[Math.min(heat, 3)];
  const statusColor = STATUS_COLOR[Math.min(heat, 3)];
  const modeEmoji   = MODE_CONFIG[mode]?.emoji || '💡';
  const modeName    = MODE_CONFIG[mode]?.label || 'Explain';
  const cardBg      = isDark ? 'rgba(30,136,255,0.06)' : 'rgba(3,86,197,0.08)';
  const cardBorder  = isDark ? 'rgba(30,136,255,0.18)' : 'rgba(3,86,197,0.25)';
  const badgeBg     = isDark ? `${statusColor}10` : `${statusColor}18`;

  // Collapsed pill shown when Vaibey is off — lets user bring her back
  const offPill = (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.5rem',
      padding: '4px 10px 4px 6px',
      borderRadius: 20,
      border: `1px solid ${isDark ? 'rgba(139,92,246,0.18)' : 'rgba(109,40,217,0.18)'}`,
      background: isDark ? 'rgba(139,92,246,0.04)' : 'rgba(109,40,217,0.04)',
      userSelect: 'none',
      marginBottom: '0.5rem',
    }}>
      <span style={{ fontSize: 11, opacity: 0.4 }}>{modeEmoji}</span>
      <span style={{
        fontSize: 9, letterSpacing: 2, textTransform: 'uppercase',
        color: isDark ? 'rgba(167,139,250,0.38)' : 'rgba(109,40,217,0.38)',
      }}>Vaibey off</span>
      {/* Toggle — same pill style as when on */}
      <button
        onClick={toggleVaibey}
        title="Show Vaibey"
        style={{
          display: 'flex', alignItems: 'center', gap: '0.3rem',
          padding: '2px 8px',
          borderRadius: 20,
          border: `1px solid ${isDark ? 'rgba(139,92,246,0.3)' : 'rgba(109,40,217,0.3)'}`,
          background: 'transparent',
          color: isDark ? 'rgba(167,139,250,0.55)' : 'rgba(109,40,217,0.55)',
          fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase',
          cursor: 'pointer', fontFamily: 'inherit',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(139,92,246,0.12)' : 'rgba(109,40,217,0.1)'; e.currentTarget.style.color = isDark ? '#a78bfa' : '#6d28d9'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = isDark ? 'rgba(167,139,250,0.55)' : 'rgba(109,40,217,0.55)'; }}
      >
        show
      </button>
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes vaibey-steam {
          0%   { transform: translateY(0) scale(1);      opacity: 0.85; }
          100% { transform: translateY(-34px) scale(3);  opacity: 0;    }
        }
        @keyframes vaibey-heat-wiggle {
          0%,100% { transform: rotate(0deg);    }
          25%     { transform: rotate(-2.5deg); }
          75%     { transform: rotate(2.5deg);  }
        }
        @keyframes vaibey-breathe {
          0%,100% { transform: translateY(0);   }
          50%     { transform: translateY(-2px); }
        }
        @keyframes vaibey-reaction {
          0%   { transform: translateX(-50%) translateY(0)    scale(0.5); opacity: 0; }
          20%  { transform: translateX(-50%) translateY(-8px)  scale(1.2); opacity: 1; }
          70%  { transform: translateX(-50%) translateY(-14px) scale(1);   opacity: 1; }
          100% { transform: translateX(-50%) translateY(-22px) scale(0.8); opacity: 0; }
        }
        @keyframes vaibey-badge-pulse {
          0%,100% { opacity: 1;   }
          50%     { opacity: 0.5; }
        }
        @keyframes vaibey-happy-bounce {
          0%,100% { transform: translateY(0);   }
          30%     { transform: translateY(-6px); }
          60%     { transform: translateY(-2px); }
        }
        @keyframes vaibey-quip-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
        @keyframes vaibey-collapse {
          from { opacity: 1; transform: scaleY(1); }
          to   { opacity: 0; transform: scaleY(0); }
        }
      `}</style>

      {/* When off: just show a tiny collapsed pill */}
      {!vaibeyOn && !autoPlay && offPill}

      {/* When on (or always on for autoPlay/landing page) */}
      {(vaibeyOn || autoPlay) && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, userSelect: 'none' }}>

          {/* ── Quip speech bubble ── */}
          {showQuip && (
            <div style={{
              background: 'rgba(107,74,224,0.18)',
              border: '1px solid rgba(167,139,250,0.38)',
              borderRadius: '12px 12px 12px 4px',
              padding: '0.45rem 0.75rem',
              maxWidth: 180,
              textAlign: 'center',
              marginBottom: 2,
              opacity: quipVisible ? 1 : 0,
              transform: quipVisible ? 'translateY(0)' : 'translateY(-4px)',
              transition: 'opacity 0.28s ease, transform 0.28s ease',
            }}>
              <span style={{
                display: 'block', fontSize: '0.58rem', fontWeight: 800,
                letterSpacing: '0.1em', color: '#a78bfa',
                marginBottom: '0.15rem', textTransform: 'uppercase',
              }}>VAIBEY says</span>
              <span style={{
                fontSize: '0.75rem', color: 'rgba(255,255,255,0.82)', fontStyle: 'italic',
              }}>{QUIPS[quipIdx]}</span>
            </div>
          )}

          <div style={{
            fontSize: 10, letterSpacing: 3, textTransform: 'uppercase',
            color: isDark ? 'rgba(167,139,250,0.5)' : 'rgba(109,40,217,0.5)',
            fontFamily: 'inherit',
          }}>
            {modeEmoji} Vaibey
          </div>

          {/* ── Peek/bounce wrapper ── */}
          <div style={{
            transform: peekBounce ? `translateY(${peekY}px)` : 'none',
            transition: peekBounce ? 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
            filter: peekBounce ? 'drop-shadow(0 -6px 24px rgba(107,74,224,0.45))' : 'none',
          }}>
            <div style={{
              position: 'relative', padding: 14, borderRadius: 18,
              background: cardBg, border: `1px solid ${cardBorder}`,
              boxShadow: `0 0 28px ${c.glow}, inset 0 0 12px rgba(139,92,246,0.04)`,
              transition: 'box-shadow 0.4s ease',
              animation: isHappy
                ? 'vaibey-happy-bounce 0.5s ease 3'
                : heat >= 3
                ? 'vaibey-heat-wiggle 0.13s linear infinite'
                : 'vaibey-breathe 3s ease-in-out infinite',
            }}>
              {reaction && <ReactionBubble key={reactionKey} emoji={reaction}/>}

              {steam && c.steam && (
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                  <SteamParticle x="28%" delay={0}    color={c.steam}/>
                  <SteamParticle x="50%" delay={0.32} color={c.steam}/>
                  <SteamParticle x="68%" delay={0.64} color={c.steam}/>
                  {heat >= 3 && <SteamParticle x="40%" delay={0.16} color={c.steam}/>}
                </div>
              )}

              <Vaibey leftDown={leftDown} rightDown={rightDown} heat={heat}
                bobOffset={bob} mode={mode} isHappy={isHappy} p={size} isDark={isDark}/>
            </div>
          </div>

          {/* ── Badge + toggle row ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {showBadge && (
              <div style={{
                padding: '3px 14px', borderRadius: 20,
                border: `1px solid ${statusColor}44`,
                background: badgeBg,
                fontSize: 9, letterSpacing: 2.5,
                color: statusColor, textTransform: 'uppercase',
                transition: 'all 0.3s ease',
                animation: heat >= 3 ? 'vaibey-badge-pulse 0.35s linear infinite' : 'none',
                whiteSpace: 'nowrap', fontFamily: 'inherit',
              }}>
                {status === 'idle'
                  ? `${modeEmoji} ${modeName}`
                  : `${status} · ${wpm} wpm`}
              </div>
            )}

            {/* Hide toggle — only shown in non-autoPlay contexts (AIComparison) */}
            {!autoPlay && (
              <button
                onClick={toggleVaibey}
                title="Hide Vaibey"
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.3rem',
                  padding: '3px 9px',
                  borderRadius: 20,
                  border: `1px solid ${isDark ? 'rgba(139,92,246,0.22)' : 'rgba(109,40,217,0.22)'}`,
                  background: 'transparent',
                  color: isDark ? 'rgba(167,139,250,0.45)' : 'rgba(109,40,217,0.45)',
                  fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase',
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(255,75,75,0.08)' : 'rgba(255,75,75,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,100,100,0.3)'; e.currentTarget.style.color = '#ff7b7b'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = isDark ? 'rgba(139,92,246,0.22)' : 'rgba(109,40,217,0.22)'; e.currentTarget.style.color = isDark ? 'rgba(167,139,250,0.45)' : 'rgba(109,40,217,0.45)'; }}
              >
                hide
              </button>
            )}
          </div>

        </div>
      )}
    </>
  );
}