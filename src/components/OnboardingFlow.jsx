// src/components/OnboardingFlow.jsx
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import './OnboardingFlow.css';

const STEPS = ['intro', 'name', 'learning', 'react', 'status', 'outro'];

const REACT_CHIPS = [
  { id: 'explain', label: 'Explain it' },
  { id: 'quiz', label: 'Quiz me' },
  { id: 'study_room', label: 'Find a Study Room' },
  { id: 'exploring', label: 'Just exploring' },
];

const STATUS_CHIPS = [
  { id: 'high_school', label: 'High School' },
  { id: 'college', label: 'College' },
  { id: 'self_learner', label: 'Self-learner' },
  { id: 'other', label: 'Something else' },
];

const OnboardingFlow = ({ onComplete }) => {
  const { user } = useAuth();
  const [stepIdx, setStepIdx] = useState(0);
  const [name, setName] = useState('');
  const [learning, setLearning] = useState('');
  const [intent, setIntent] = useState(null);
  const [statusPick, setStatusPick] = useState(null);
  const [saving, setSaving] = useState(false);

  const step = STEPS[stepIdx];
  const next = () => setStepIdx(i => i + 1);

  const submitLearning = () => {
    if (!learning.trim()) return;
    // TODO: swap in your real UserWall insert here so this becomes an
    // actual saved post, not just a preview shown during onboarding.
    next();
  };

  const finish = async () => {
    setSaving(true);
    try {
      await supabase.from('profiles').update({
        display_name: name || null,
        education_status: statusPick,
        onboarding_intent: intent,
        onboarding_completed: true,
      }).eq('id', user.id);
    } catch (e) {
      console.error('[Onboarding] failed to save', e);
    } finally {
      setSaving(false);
      onComplete?.({ intent });
    }
  };

  return (
    <div className="onboarding-flow">
      <div className="ob-bubble">
        {step === 'intro' && (
          <>
            <p>Before the internet, everything you learned lived in a notebook. That's still true here — it's just called your Wall now.</p>
            <button className="ob-next-btn" onClick={next}>Continue</button>
          </>
        )}

        {step === 'name' && (
          <>
            <p>What should I call you?</p>
            <input
              className="ob-input"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && name.trim()) next(); }}
              placeholder="Your name"
              autoFocus
            />
            <button className="ob-next-btn" onClick={next} disabled={!name.trim()}>Next</button>
          </>
        )}

        {step === 'learning' && (
          <>
            <p>What's something you're currently learning or working on?</p>
            <input
              className="ob-input"
              value={learning}
              onChange={e => setLearning(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitLearning(); }}
              placeholder="e.g. React hooks, organic chemistry..."
              autoFocus
            />
            <button className="ob-next-btn" onClick={submitLearning} disabled={!learning.trim()}>Add to my Wall</button>
          </>
        )}

        {step === 'react' && (
          <>
            <div className="ob-wall-preview">
              <span className="ob-wall-preview-label">Added to your Wall</span>
              <p>{learning}</p>
            </div>
            <p>Want me to break it down, quiz you on it, or find people studying the same thing?</p>
            <div className="ob-chip-row">
              {REACT_CHIPS.map(c => (
                <button key={c.id} className="ob-chip" onClick={() => { setIntent(c.id); next(); }}>
                  {c.label}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'status' && (
          <>
            <p>One more thing — where are you at right now?</p>
            <div className="ob-chip-row">
              {STATUS_CHIPS.map(c => (
                <button key={c.id} className="ob-chip" onClick={() => { setStatusPick(c.id); next(); }}>
                  {c.label}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'outro' && (
          <>
            <p>Study Rooms and EduFeed pull from what's on your Wall. When you need to breathe, there's music and a feed on your terms — no algorithm, just what you pick.</p>
            <button className="ob-next-btn" onClick={finish} disabled={saving}>
              {saving ? 'Setting things up…' : "Let's go"}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default OnboardingFlow;