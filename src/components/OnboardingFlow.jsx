// src/components/OnboardingFlow.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import useIsMobile from '../hooks/useIsMobile';
import Vaibey from './TypingCat';
import vaibesLogo from '../assets/vaibes-logo.png';
import { saveToWall } from '../lib/saveToWall';
import './OnboardingFlow.css';

const STEPS = ['intro', 'name', 'topic', 'title', 'photo', 'review', 'react', 'status', 'outro'];

// 'study_room' removed — a brand-new user has no wall card yet, so there is
// nothing for "find a study room" to find. Rooms only exist once someone
// taps Study on an actual card (see UserWall's startRoom).
const REACT_CHIPS = [
  { id: 'explain', label: 'Explain it', mode: 'explain' },
  { id: 'quiz', label: 'Quiz me', mode: 'quizMe' },
  { id: 'exploring', label: 'Just exploring', mode: 'explain' },
];

const STATUS_CHIPS = [
  { id: 'high_school', label: 'High School' },
  { id: 'college', label: 'College' },
  { id: 'self_learner', label: 'Self-learner' },
  { id: 'other', label: 'Something else' },
];

// Lightweight, per-status acknowledgment — gives the tap a visible effect
// without needing a full analytics/tracking dashboard. The real value
// (education_status) is what actually gets persisted, in finish() below.
const STATUS_REACTIONS = {
  high_school: "Got it — I'll keep explanations clear and exam-focused.",
  college: "Noted — I'll go deeper and connect ideas across topics.",
  self_learner: "Love that. I'll help you build structure as you go.",
  other: "All good — I'll adapt as we go.",
};

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

  // Real generated content for the Wall post — replaces the old bare
  // `content: topic` (a wall card that said "Chemistry" and nothing else).
  const [generatedContent, setGeneratedContent] = useState('');
  const [contentLoading, setContentLoading] = useState(false);

  // Drives the react step's three sub-views: choosing a chip, waiting on
  // Vaibey, or showing what she came back with.
  const [reactStage, setReactStage] = useState('choose'); // 'choose' | 'loading' | 'result'
  const [reactResult, setReactResult] = useState('');

  const step = STEPS[stepIdx];
  const next = () => setStepIdx(i => i + 1);
  const goTo = (stepName) => setStepIdx(STEPS.indexOf(stepName));

  const titleSuggestions = suggestTitles(topic);

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

  // Shared helper for both the auto-summary and the react-step actions —
  // one small authenticated call to the existing /api/ai chat action.
  const callVaibey = async (systemPrompt, userPrompt) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({
        action: 'chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.choices?.[0]?.message?.content) {
      throw new Error(data?.error || 'No response from Vaibey');
    }
    return data.choices[0].message.content.trim();
  };

  // Fires the moment the user leaves the topic step, so it resolves quietly
  // in the background while they pick a title/photo — no added wait, and
  // the Wall card gets real content instead of the bare topic string.
  const generateTopicSummary = async (topicText) => {
    setContentLoading(true);
    try {
      const text = await callVaibey(
        'You write extremely short study-note openers. Given a topic, respond with ONLY a plain-text definition or overview of that topic, under 200 characters. No markdown, no headers, no preamble, no quotation marks.',
        topicText
      );
      setGeneratedContent(text.slice(0, 200));
    } catch (err) {
      console.error('[Onboarding] topic summary generation failed', err);
      // Never let a network hiccup or an empty credit wallet block
      // onboarding — fall back to a plain line so the card is never blank.
      setGeneratedContent(`${topicText} — notes and definitions to explore.`.slice(0, 200));
    } finally {
      setContentLoading(false);
    }
  };

  const handleTopicNext = () => {
    generateTopicSummary(topic);
    next();
  };

  // Real Wall entry — matches UserWall's user_creatives schema (plus an
  // optional image), so it shows up as a genuine card the moment they land there.
  const confirmSave = async () => {
    setSaving(true);
    try {
      await saveToWall(supabase, user, {
        title,
        content: generatedContent || `${topic} — notes and definitions to explore.`,
        mediaFiles: photoFile ? [photoFile] : [],
      });
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

  // Explain/Quiz now do real work instead of just advancing a step.
  // "Just exploring" stays a no-op — that's the honest behavior for someone
  // who explicitly said they don't want either action.
  const pickIntent = async (chip) => {
    setIntent(chip.id);
    setVaibeyMode(chip.mode);

    if (chip.id === 'exploring') {
      next();
      return;
    }

    setReactStage('loading');
    const context = generatedContent ? `${topic}\n\nContext: ${generatedContent}` : topic;

    try {
      const prompt = chip.id === 'explain'
        ? {
            sys: 'You are Vaibey. Explain the given topic in 2-3 short, friendly sentences a total beginner could follow. Plain text only, no markdown, no headers, under 400 characters.',
          }
        : {
            sys: 'You are Vaibey. Write exactly 3 short multiple-choice quiz questions (label options A/B/C) testing basic understanding of the given topic. After the questions, add "ANSWER KEY:" with one-line answers. Keep it compact — this is a quick first-look preview, not a full quiz. Plain text only, no markdown.',
          };
      const result = await callVaibey(prompt.sys, context);
      setReactResult(result);
      setReactStage('result');
    } catch (err) {
      console.error('[Onboarding] react action failed', err);
      const isCreditIssue = /credit/i.test(err.message || '');
      setReactResult(
        isCreditIssue
          ? "Looks like today's AI credits are tapped out — you can top up anytime, or explore EduFeed and Study Rooms while you wait."
          : "Hmm, I couldn't pull that up right now — but Explain and Quiz Me are always available in AI Chat."
      );
      setReactStage('result');
    }
  };

  return (
    <div className="onboarding-flow">
      <div className="ob-ambient-glow" />

      {step === 'intro' && (
        <img src={vaibesLogo} alt="vAIbes" className="ob-logo" />
      )}

      <div className="ob-vaibey-wrap">
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
              onKeyDown={e => { if (e.key === 'Enter' && topic.trim()) handleTopicNext(); }}
              placeholder="e.g. React hooks, organic chemistry..."
              autoFocus
            />
            <button className="ob-next-btn" onClick={handleTopicNext} disabled={!topic.trim()}>Next</button>
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
              <p className="ob-review-topic">
                {contentLoading ? 'Vaibey is writing a quick overview…' : generatedContent}
              </p>
            </div>
            <div className="ob-review-edit-row">
              <button className="ob-text-link" onClick={() => goTo('title')}>Edit title</button>
              <button className="ob-text-link" onClick={() => goTo('photo')}>Change photo</button>
            </div>
            <button className="ob-next-btn" onClick={confirmSave} disabled={saving || contentLoading}>
              {contentLoading ? 'Still writing your overview…' : saving ? 'Saving to your Wall…' : 'Looks good — save it'}
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

            {reactStage === 'choose' && (
              <>
                <p>Want me to break it down or quiz you on it?</p>
                <div className="ob-chip-row">
                  {REACT_CHIPS.map(c => (
                    <button key={c.id} className="ob-chip" onClick={() => pickIntent(c)}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {reactStage === 'loading' && (
              <p className="ob-loading-text">Vaibey is thinking…</p>
            )}

            {reactStage === 'result' && (
              <>
                <div className="ob-result-block">{reactResult}</div>
                <button className="ob-next-btn" onClick={next}>Continue</button>
              </>
            )}
          </>
        )}

        {step === 'status' && (
          <>
            {!statusPick ? (
              <>
                <p>One more thing — where are you at right now?</p>
                <div className="ob-chip-row">
                  {STATUS_CHIPS.map(c => (
                    <button key={c.id} className="ob-chip" onClick={() => setStatusPick(c.id)}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p>{STATUS_REACTIONS[statusPick]}</p>
                <button className="ob-next-btn" onClick={next}>Continue</button>
              </>
            )}
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