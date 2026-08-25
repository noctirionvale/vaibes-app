import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import ProfilePanel from './ProfilePanel';
import BillingPanel from './BillingPanel';
import './SettingsModal.css';

const SOCIALS = [
  {
    name: 'Website',
    url: 'https://noctirionvaleport.vercel.app/',
    color: '#1877F2',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    )   
  },
  {
    name: 'X (Twitter)',
    url: 'https://x.com/vAIbeshub',
    color: '#000000',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    )
  },
  {
    name: 'YouTube',
    url: 'https://youtube.com/@v-ai-bes',
    color: '#FF0000',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    )
  },
];

const SettingsModal = ({ onClose }) => {
  const { signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');

  const handleSignOut = () => {
    signOut();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-modal-header">
          <h3>Settings</h3>
          <button className="close-modal-btn" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="settings-tabs">
          <button className={`settings-tab ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>Profile</button>
          <button className={`settings-tab ${activeTab === 'billing' ? 'active' : ''}`} onClick={() => setActiveTab('billing')}>Billing</button>
          <button className={`settings-tab ${activeTab === 'howto' ? 'active' : ''}`} onClick={() => setActiveTab('howto')}>How To</button>
          <button className={`settings-tab ${activeTab === 'socials' ? 'active' : ''}`} onClick={() => setActiveTab('socials')}>Socials</button>
        </div>

        <div className="settings-tab-content">
          {activeTab === 'profile' && <ProfilePanel onClose={onClose} embedded={true} />}
          
          {activeTab === 'billing' && <BillingPanel embedded={true} />}
          
          {activeTab === 'howto' && (
            <div className="howto-panel">
              <div className="instructions-grid">
                {[
                  { 
  n: 1, 
    title: 'AI Chat (Pro)', 
    text: 'Chat in 5 modes — Explain, Summarize, Analyze, Draft & Edit, Quiz Me. Every thread keeps memory, so Vaibey stays focused on what you\'re actually studying and hallucinates less by building on real context instead of starting cold each time.' 
  },
  { 
    n: 2, 
    title: 'Switching Views', 
    text: 'Tap Create, AI Chat, EduFeed, or VidFeed at the top to bring that view front and center — whatever was showing before slides into the side panel instead of disappearing. Tap the same tab again and your Gallery comes back to center. The side panel always highlights whichever tab is currently front and center, even though its content now lives in the side panel.' 
  },
  { 
    n: 3, 
    title: 'UserWall & Creative Editor (Pro)', 
    text: 'Write notes, essays, poems, recipes, reminders — anything text-based — or build a gallery of your own photos and videos. Everything\'s made in the Creative Editor and saves to your UserWall. Every item you post — to your Gallery or to EduFeed — gets its own Study Room, a live chat space where anyone can drop in and discuss it with you.' 
  },
  { 
    n: 4, 
    title: 'EduFeed', 
    text: 'Created quizzes land on EduFeed, a card-based feed built for learning, not scrolling.' 
  },
  { 
    n: 5, 
    title: 'VidFeed', 
    text: 'No algorithm — you pick the channels. Add a YouTube channel ID and it joins your feed. Add a few history channels and history becomes your everyday feed; add as many channels, on as many subjects, as you want.' 
  },
  { 
    n: 6, 
    title: 'Quizzes', 
    text: 'Turn any UserWall note, or a topic from your AI Chat history, into a quiz' 
  },
  { 
    n: 7, 
    title: 'Study Widget', 
    text: 'Music and a clock/timer in one place. Track how long you\'ve spent studying, set alarms to stay on schedule, and put on lo-fi, jazz, or nature sounds to lock in.' 
  },
                ].map(step => (
                  <div className="instruction-step" key={step.n}>
                    <div className="step-number">{step.n}</div>
                    <div>
                      <h4>{step.title}</h4>
                      <p>{step.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {activeTab === 'socials' && (
            <div className="socials-panel">
              <div className="socials-header">
                <h4>Follow NoctirionVale</h4>
                <p>Stay updated with the latest from vAIbes and our other projects.</p>
              </div>
              <div className="socials-grid">
                {SOCIALS.map(social => (
                  <a key={social.name} href={social.url} target="_blank" rel="noopener noreferrer" className="social-card" style={{ '--social-color': social.color }}>
                    <div className="social-card-icon" style={{ color: social.color }}>{social.icon}</div>
                    <div className="social-card-info">
                      <div className="social-card-name">{social.name}</div>
                      <div className="social-card-handle">
                        {social.name === 'Website' && 'noctirionvaleport.vercel.app'}
                        {social.name === 'X (Twitter)' && '@vAIbeshub'}
                        {social.name === 'YouTube' && '@v-ai-bes'}
                      </div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="social-card-arrow">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                      <polyline points="15 3 21 3 21 9"></polyline>
                      <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                  </a>
                ))}
              </div>
              <div className="socials-footer">
                <p>Built by <strong>NoctirionVale</strong></p>
                <p style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '0.25rem' }}>vAIbes ·</p>
              </div>
            </div>
          )}
        </div>

        <div className="settings-footer">
          <button className="sign-out-btn settings-signout" onClick={handleSignOut}>Sign Out</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;