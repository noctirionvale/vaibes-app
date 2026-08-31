import React from 'react';
import CreativeEditor from './CreativeEditor';
import AIComparison from './AIComparison';
import './PanelSwitcher.css';

const PANEL_TABS = [
  { key: 'creative', label: '✏️ Create',  title: 'Creative Workspace' },
  { key: 'aichat',   label: '🤖 AI Chat', title: 'AI Chat' },
  { key: 'edufeed',  label: '🎓 EduFeed', title: 'EduFeed' },
  { key: 'vidfeed',  label: '📺 VidFeed', title: 'Video Feed' },
];

const PanelSwitcher = ({
  activeView, centerActiveKey, onViewChange,
  creativeEditorProps = {}, aiComparisonProps = {},
  userTier = 'free', vidSlotRef, eduSlotRef,
}) => (
  <div className="panel-switcher">
    <div className="panel-switcher-tabs">
      {PANEL_TABS.map((tab) => (
        <button
          key={tab.key}
          data-tour={`panel-tab-${tab.key}`}
          className={`panel-switcher-tab ${centerActiveKey === tab.key ? 'active' : ''}`}
          onClick={() => onViewChange(tab.key)}
          title={`${tab.title}${centerActiveKey === tab.key ? ' (in center)' : ''}`}
        >
          {tab.label}
        </button>
      ))}
    </div>

    <div className="panel-switcher-body">
      {activeView === 'creative' && (
        <div className="panel-content-wrapper"><CreativeEditor {...creativeEditorProps} /></div>
      )}
      {activeView === 'aichat' && (
        <div className="panel-content-wrapper"><AIComparison {...aiComparisonProps} /></div>
      )}
      {activeView === 'edufeed' && <div className="panel-content-wrapper" ref={eduSlotRef} />}
      {activeView === 'vidfeed' && <div className="panel-content-wrapper" ref={vidSlotRef} />}
    </div>
  </div>
);

export default PanelSwitcher;