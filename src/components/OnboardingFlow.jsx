// src/components/OnboardingFlow.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext'; // confirmed: shape matches ({ isDark, toggleTheme })
import useIsMobile from '../hooks/useIsMobile';
import Vaibey from './TypingCat'; // ← adjust path/filename if Vaibey lives elsewhere
import vaibesLogo from '../assets/vaibes-logo.png'; // ← save your hero_ai.png into src/assets/ under this name
import { saveToWall } from '../lib/saveToWall';
import './OnboardingFlow.css';

const STEPS = ['intro', 'name', 'topic', 'title', 'photo', 'review', 'react', 'status', 'outro'];

const REACT_CHIPS = [
  { id: 'explain', label: 'Explain it', mode: 'explain' },
  { id: 'quiz', label: 'Quiz me', mode: 'quizMe' },
  { id: 'study_room', label: 'Find a Study Room', mode: 'analyze' },
  { id: 'exploring', label: 'Just exploring', mode: 'explain' },
];

const STATUS_CHIPS = [
  { id: 'high_school', label: 'High School' },
  { id: 'college', label: 'College' },
  { id: 'self_learner', label: 'Self-learner' },
  { id: 'other', label: 'Something else' },
];

// Cheap local suggestions — swap this out for a real AI call later if you
// want Vaibey's suggestions to come from your existing AI backend instead.
const suggestTitles = (topic) => {
  const clean = topic.trim();
  if (!clean) return [];
  const cap = clean.charAt(0).toUpperCase() + clean.slice(1);
  return [cap, `${cap} Notes`, `Learning ${clean}`, `${cap} — Study Log`];
};

const OnboardingFlow = ({ onComplete }) => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const isMobile = useIsMobile();

  const [stepIdx, setStepIdx] = useState(0);
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [title, setTitle] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [intent, setIntent] = useState(null);
  const [statusPick, setStatusPick] = useState(null);
  const [saving, setSaving] = useState(false);
  const [vaibeyMode, setVaibeyMode] = useState('explain');

  const step = STEPS[stepIdx];
  const next = () => setStepIdx(i => i + 1);
  const goTo = (stepName) => setStepIdx(STEPS.indexOf(stepName));

  const titleSuggestions = suggestTitles(topic);

  // ── Build a preview URL whenever a photo is picked, and clean it up
  // whenever it changes or the component unmounts (avoids leaking blob URLs) ──
  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) setPhotoFile(file);
  };

  // Real Wall entry — matches UserWall's user_creatives schema (plus an
  // optional image), so it shows up as a genuine card the moment they land there.
  const confirmSave = async () => {
    setSaving(true);
    try {
      await saveToWall(supabase, user, { title, content: topic, imageFile: photoFile });
    } catch (e) {
      console.error('[Onboarding] failed to save first Wall entry', e);
      // Non-blocking — don't stall onboarding over a network hiccup
    } finally {
      setSaving(false);
      next();
    }
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

  const pickIntent = (chip) => {
    setIntent(chip.id);
    setVaibeyMode(chip.mode);
    next();
  };

  return (
    <div className="onboarding-flow">
      <div className="ob-ambient-glow" />

      {step === 'intro' && (
        <img src={vaibesLogo} alt="vAIbes" className="ob-logo" />
      )}

      <div className="ob-vaibey-wrap">
        {/* autoPlay is what actually drives Vaibey's animation loop (typing/
            heat/steam) on its own — AIComparison doesn't need it because a
            real #question-input feeds its keyboard-driven animation instead,
            but onboarding has no such input, so autoPlay is the only thing
            making her move. It also bypasses the vaibey_visible=false
            localStorage flag entirely, so a "hide Vaibey" toggle used
            elsewhere in the app can't leave onboarding showing a static pill. */}
        <Vaibey
          autoPlay
          mode={vaibeyMode}
          isDark={isDark}
          size={isMobile ? 3 : 4}
          showBadge={false}
          showQuip
          peekBounce={step === 'intro'}
          onResponse={['react', 'status', 'outro'].includes(step)}
        />
      </div>

      <div className="ob-bubble" key={step}>
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

        {step === 'topic' && (
          <>
            <p>What subject or topic is on your mind today?</p>
            <input
              className="ob-input"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && topic.trim()) next(); }}
              placeholder="e.g. React hooks, organic chemistry..."
              autoFocus
            />
            <button className="ob-next-btn" onClick={next} disabled={!topic.trim()}>Next</button>
          </>
        )}

        {step === 'title' && (
          <>
            <p>What do you want to call it? Here are a few ideas:</p>
            <div className="ob-chip-row">
              {titleSuggestions.map((s, i) => (
                <button key={i} className="ob-chip" onClick={() => setTitle(s)}>{s}</button>
              ))}
            </div>
            <input
              className="ob-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') next(); }}
              placeholder={titleSuggestions[0] || 'Give it a title'}
              autoFocus
            />
            <button
              className="ob-next-btn"
              onClick={() => { if (!title.trim() && titleSuggestions[0]) setTitle(titleSuggestions[0]); next(); }}
            >
              Next
            </button>
          </>
        )}

        {step === 'photo' && (
          <>
            <p>Want to add a photo? Totally optional.</p>
            <input
              type="file"
              accept="image/*"
              id="ob-photo-input"
              className="ob-photo-input-hidden"
              onChange={handlePhotoChange}
            />
            <label htmlFor="ob-photo-input" className="ob-photo-dropzone">
              {photoPreview ? (
                <img src={photoPreview} alt="Selected" className="ob-photo-preview-thumb" />
              ) : (
                <span>Tap to choose from your gallery</span>
              )}
            </label>
            <button className="ob-next-btn" onClick={next}>
              {photoFile ? 'Continue' : 'Skip for now'}
            </button>
          </>
        )}

        {step === 'review' && (
          <>
            <p>Here's what's going on your Wall — look good?</p>
            <div className="ob-review-card">
              {photoPreview && <img src={photoPreview} alt="" className="ob-review-photo" />}
              <span className="ob-review-title">{title || topic}</span>
              <p className="ob-review-topic">{topic}</p>
            </div>
            <div className="ob-review-edit-row">
              <button className="ob-text-link" onClick={() => goTo('title')}>Edit title</button>
              <button className="ob-text-link" onClick={() => goTo('photo')}>Change photo</button>
            </div>
            <button className="ob-next-btn" onClick={confirmSave} disabled={saving}>
              {saving ? 'Saving to your Wall…' : 'Looks good — save it'}
            </button>
          </>
        )}

        {step === 'react' && (
          <>
            <div className="ob-wall-preview">
              <span className="ob-wall-preview-label">Added to your Wall</span>
              {photoPreview && <img src={photoPreview} alt="" className="ob-wall-preview-thumb" />}
              <p>{title || topic}</p>
            </div>
            <p>Want me to break it down, quiz you on it, or find people studying the same thing?</p>
            <div className="ob-chip-row">
              {REACT_CHIPS.map(c => (
                <button key={c.id} className="ob-chip" onClick={() => pickIntent(c)}>
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
            <p>Study Rooms and EduFeed pull from what's on your Wall. Every quiz you take starts from something already there — a Wall card or something from your AI chat history. When you need to breathe, there's music and a feed on your terms — no algorithm, just what you pick.</p>
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