import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import './CommunityRoomCreator.css';

const CHAT_MODE_LABELS = { explain: 'Explain', summarize: 'Summarize', analyze: 'Analyze', writeDraft: 'Draft & Edit', quizMe: 'Quiz Me' };
const COVER_BUCKET = 'community-room-media';

const stripHtml = (html) => (html ? html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

const CommunityRoomCreator = ({ onRoomCreated, onClose, editItem = null }) => {
  const { user } = useAuth();
  const isEditing = !!editItem;

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  // ── Step 1: Source Selection ── ('manual' removed — UserWall already owns free-form quiz creation)
  const [sourceType, setSourceType] = useState('creative_wall'); // 'creative_wall' | 'ai_chat'
  const [selectedNotes, setSelectedNotes] = useState([]);
  const [userNotes, setUserNotes] = useState([]);
  const [chatThreads, setChatThreads] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [roomMode, setRoomMode] = useState('solo'); // 'solo' | 'race'
  const [showInBanner, setShowInBanner] = useState(true);

  // ── Step 2: Configuration ──
  const [subject, setSubject] = useState('General');
  const [difficulty, setDifficulty] = useState('medium');
  const [questionCount, setQuestionCount] = useState(10);
  const [maxPlayers, setMaxPlayers] = useState(15);
  const [timeLimit, setTimeLimit] = useState(15);
  const [questionTimer, setQuestionTimer] = useState(30);
  const [roomTitle, setRoomTitle] = useState('');
  const [roomDescription, setRoomDescription] = useState('');
  const [aiAssistantEnabled, setAiAssistantEnabled] = useState(false);

  // ── Step 2: Cover media (image/gif/video, purely cosmetic — shown on the room + EduFeed card) ──
  const [coverPreviewUrl, setCoverPreviewUrl] = useState(null);
  const [coverMediaUrl, setCoverMediaUrl] = useState(null);
  const [coverMediaType, setCoverMediaType] = useState(null); // 'image' | 'gif' | 'video'
  const [coverMediaMime, setCoverMediaMime] = useState(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverError, setCoverError] = useState('');

  // ── Step 3: Preview ──
  const [generatedQuestions, setGeneratedQuestions] = useState([]);

  useEffect(() => {
    setSelectedNotes([]);
    setSearchTerm('');
  }, [sourceType]);

  // ── Prefill from existing room when editing ──
 useEffect(() => {
   if (!editItem) return;
   setStep(2);
   setSubject(editItem.subject || 'General');
   setDifficulty(editItem.difficulty || 'medium');
   setQuestionCount(editItem.generated_questions?.length || 10);
   setMaxPlayers(editItem.max_players || 15);
   setTimeLimit(editItem.time_limit_minutes ?? 15);
   setQuestionTimer(editItem.timer_duration || 30);
   setRoomTitle(editItem.title || '');
   setRoomDescription(editItem.description || '');
   setAiAssistantEnabled(editItem.ai_assistant_enabled || false);
   setRoomMode(editItem.room_mode || 'solo');
   setShowInBanner(editItem.show_in_banner ?? true);
   setGeneratedQuestions(editItem.generated_questions || []);
   if (editItem.cover_media_url) {
     setCoverMediaUrl(editItem.cover_media_url);
     setCoverMediaType(editItem.cover_media_type || 'image');
     setCoverPreviewUrl(editItem.cover_media_url);
     setCoverMediaMime(editItem.cover_media_type === 'video' ? 'video/mp4' : 'image/jpeg');
   }
 }, [editItem]);

  // Avoid leaking the local object URL once we're done previewing it
  useEffect(() => () => { if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl); }, [coverPreviewUrl]);

  useEffect(() => {
    if (!user || sourceType !== 'creative_wall') return;
    const fetchNotes = async () => {
      try {
        const { data, error } = await supabase
          .from('user_creatives')
          .select('id, title, content, created_at, media_type, subject')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (error) { setError('Failed to load notes: ' + error.message); return; }
        setUserNotes(data || []);
      } catch (err) {
        console.error('❌ Fetch notes error:', err);
        setError('Failed to load your notes. Please try again.');
      }
    };
    fetchNotes();
  }, [user, sourceType]);

  useEffect(() => {
    if (!user || sourceType !== 'ai_chat') return;
    const fetchThreads = async () => {
      try {
        const { data, error } = await supabase
          .from('conversation_threads')
          .select('id, mode, title, messages, updated_at')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(100);
        if (error) { setError('Failed to load chat history: ' + error.message); return; }
        setChatThreads(data || []);
      } catch (err) {
        console.error('❌ Fetch threads error:', err);
        setError('Failed to load your AI chat history. Please try again.');
      }
    };
    fetchThreads();
  }, [user, sourceType]);

  const filteredNotes = userNotes
    .filter(note => stripHtml(note.content).length > 0)
    .filter(note => {
      if (!searchTerm) return true;
      const s = searchTerm.toLowerCase();
      return note.title?.toLowerCase().includes(s) ||
             note.content?.toLowerCase().includes(s) ||
             note.subject?.toLowerCase().includes(s);
    });

  const filteredThreads = chatThreads.filter(thread => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    const bodyMatch = thread.messages?.some(m => m.content?.toLowerCase().includes(s));
    return thread.title?.toLowerCase().includes(s) || bodyMatch;
  });

  const threadPreviewText = (thread) => {
    const lastAssistant = [...(thread.messages || [])].reverse().find(m => m.role === 'assistant');
    return (lastAssistant?.content || thread.messages?.[0]?.content || '').slice(0, 90);
  };

  // ── Cover upload — fires immediately on file select so createRoom just reads the finished URL ──
  const handleCoverSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setCoverError('');

    const isGif = file.type === 'image/gif';
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) { setCoverError('Please upload an image, GIF, or video file.'); return; }

    const maxSize = isVideo ? 20 * 1024 * 1024 : 8 * 1024 * 1024;
    if (file.size > maxSize) { setCoverError(`File too big — max ${isVideo ? '20MB' : '8MB'}.`); return; }

    if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    setCoverPreviewUrl(URL.createObjectURL(file));
    setCoverMediaType(isGif ? 'gif' : isVideo ? 'video' : 'image');
    setCoverMediaMime(file.type);
    setCoverMediaUrl(null);
    setUploadingCover(true);

    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from(COVER_BUCKET)
        .upload(path, file, { cacheControl: '3600', upsert: false });
      if (uploadErr) throw uploadErr;

      const { data: publicData } = supabase.storage.from(COVER_BUCKET).getPublicUrl(path);
      setCoverMediaUrl(publicData.publicUrl);
    } catch (err) {
      console.error('❌ Cover upload error:', err);
      setCoverError('Upload failed — you can still create the room without a cover.');
    } finally {
      setUploadingCover(false);
    }
  };

  const removeCover = () => {
    if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    setCoverPreviewUrl(null);
    setCoverMediaUrl(null);
    setCoverMediaType(null);
    setCoverMediaMime(null);
    setCoverError('');
  };

  const generateQuestions = async () => {
    if (selectedNotes.length === 0) {
      setError(`Please select at least one ${sourceType === 'ai_chat' ? 'chat thread' : 'note'} to generate questions from.`);
      return;
    }

    setGenerating(true);
    setError('');

    try {
      let notesData = [];

      if (sourceType === 'creative_wall') {
        notesData = selectedNotes.map(id => {
          const note = userNotes.find(n => n.id === id);
          return { id: note.id, title: note.title || 'Untitled', content: stripHtml(note.content), subject: note.subject || 'General' };
        });
      } else if (sourceType === 'ai_chat') {
        notesData = selectedNotes.map(id => {
          const thread = chatThreads.find(t => t.id === id);
          const content = (thread.messages || [])
            .map(m => `${m.role === 'user' ? 'Q' : 'A'}: ${m.content}`)
            .join('\n\n');
          return { id: thread.id, title: thread.title || 'Untitled Conversation', content, subject: CHAT_MODE_LABELS[thread.mode] || thread.mode || 'General' };
        });
      }

      const response = await fetch('/api/generate-quiz-from-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: notesData, subject, difficulty, count: questionCount, userId: user.id, format: 'multiple_choice'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate questions');
      }

      const data = await response.json();
      if (!data.questions || data.questions.length === 0) {
        throw new Error('No questions were generated. Try selecting different source material.');
      }

      setGeneratedQuestions(data.questions);
      setStep(3);
    } catch (err) {
      console.error('❌ Generation error:', err);
      setError(err.message || 'Failed to generate questions. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleConfigNext = () => {
   if (isEditing && selectedNotes.length === 0) { setStep(3); return; }
   generateQuestions();
 };

  const createRoom = async () => {
    if (generatedQuestions.length === 0) {
      setError('No questions to publish. Generate questions first.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (isEditing) {
        const { error: roomError } = await supabase
         .from('community_rooms')
         .update({
           title: roomTitle || `${subject} Quiz Room`,
           subject, description: roomDescription,
           generated_questions: generatedQuestions,
           max_players: maxPlayers,
           time_limit_minutes: timeLimit,
           timer_duration: questionTimer,
           ai_assistant_enabled: aiAssistantEnabled,
           difficulty, room_mode: roomMode,
           show_in_banner: showInBanner,
           cover_media_url: coverMediaUrl || null,
           cover_media_type: coverMediaUrl ? coverMediaType : null,
         })
         .eq('id', editItem.id);
       if (roomError) throw new Error(roomError.message || 'Failed to update room');

       await supabase.from('community_room_questions').delete().eq('room_id', editItem.id);
       const questionsToInsert = generatedQuestions.map((q, index) => ({
         room_id: editItem.id,
         question_text: q.question,
         options: q.options || [],
         correct_answer_index: q.correct_index || 0,
         correct_answer_text: q.correct_answer || q.options?.[q.correct_index || 0] || '',
         explanation: q.explanation || '',
         points: 10,
         display_order: index,
       }));
       const { error: qError } = await supabase.from('community_room_questions').insert(questionsToInsert);
       if (qError) throw new Error(qError.message || 'Failed to update questions');

       const { error: feedError } = await supabase
         .from('edufeed_posts')
         .update({
           title: roomTitle || `${subject} Quiz Room`,
           content: roomDescription || null,
           subject,
           attachments: coverMediaUrl ? [{ type: coverMediaMime, url: coverMediaUrl, name: 'Room cover' }] : [],
         })
         .eq('community_id', editItem.id);
       if (feedError) console.error('❌ EduFeed sync failed:', feedError);

       if (onRoomCreated) onRoomCreated({ ...editItem, id: editItem.id });
       if (onClose) onClose();
       return;
     }

      const { data: room, error: roomError } = await supabase
        .from('community_rooms')
        .insert({
          creator_id: user.id,
          host_id: user.id,
          current_host: user.id,
          title: roomTitle || `${subject} Quiz Room`,
          subject: subject,
          description: roomDescription,
          source_type: sourceType,
          source_ids: selectedNotes,
          generated_questions: generatedQuestions,
          max_players: maxPlayers,
          time_limit_minutes: timeLimit,
          timer_duration: questionTimer,
          timer_remaining: questionTimer,
          is_timer_running: false,
          ai_assistant_enabled: aiAssistantEnabled,
          difficulty: difficulty,
          status: 'live',
          started_at: new Date().toISOString(),
          room_mode: roomMode,
          show_in_banner: showInBanner,
          current_question_index: 0,
          cover_media_url: coverMediaUrl || null,
          cover_media_type: coverMediaUrl ? coverMediaType : null,
        })
        .select()
        .single();

      if (roomError) throw new Error(roomError.message || 'Failed to create room');

      const questionsToInsert = generatedQuestions.map((q, index) => ({
        room_id: room.id,
        question_text: q.question,
        options: q.options || [],
        correct_answer_index: q.correct_index || 0,
        correct_answer_text: q.correct_answer || q.options?.[q.correct_index || 0] || '',
        explanation: q.explanation || '',
        points: 10,
        display_order: index
      }));

      const { error: qError } = await supabase.from('community_room_questions').insert(questionsToInsert);
      if (qError) throw new Error(qError.message || 'Failed to insert questions');

      try {
        const { error: feedError } = await supabase.from('edufeed_posts').insert({
          user_id: user.id,
          type: 'community',
          title: room.title,
          content: roomDescription || null,
          subject: subject,
          community_id: room.id,
          attachments: coverMediaUrl ? [{ type: coverMediaMime, url: coverMediaUrl, name: 'Room cover' }] : [],
          is_pro_only: true,
          is_published: true,
          is_flagged: false,
        });
        if (feedError) {
          console.error('❌ EduFeed publish failed:', feedError);
          setError(`Room is live, but it won't show in EduFeed: ${feedError.message}`);
        }
      } catch (feedErr) {
        console.error('❌ EduFeed publish threw:', feedErr);
        setError(`Room is live, but publishing to EduFeed threw an error: ${feedErr.message}`);
      }

      try {
        await supabase.from('user_activity_log').insert({
          user_id: user.id,
          activity_type: 'community_created',
          subject: subject,
          points_earned: 10,
          metadata: {
            room_id: room.id, question_count: generatedQuestions.length,
            source_type: sourceType, source_count: selectedNotes.length, room_mode: roomMode
          }
        });
      } catch (logError) {
        console.warn('⚠️ Activity log failed (non-critical):', logError);
      }

      if (onRoomCreated) onRoomCreated(room);
      if (onClose) onClose();
    } catch (err) {
      console.error('❌ Create room error:', err);
      setError(err.message || 'Failed to create room. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateQuestion = (index, field, value) => {
    const updated = [...generatedQuestions];
    updated[index] = { ...updated[index], [field]: value };
    setGeneratedQuestions(updated);
  };

  const removeQuestion = (index) => setGeneratedQuestions(generatedQuestions.filter((_, i) => i !== index));

  const renderError = () => error && (
    <div className="crc-error-banner">
      <span>⚠️</span><span>{error}</span>
      <button onClick={() => setError('')}>✕</button>
    </div>
  );

  const toggleSelected = (id) => {
    setSelectedNotes(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const renderSourceSelection = () => (
    <div className="crc-step">
      <div className="crc-step-header"><span className="crc-step-number">1</span><h3>Choose Content Source</h3></div>
      {renderError()}

      <div className="crc-source-options">
        <div className={`crc-source-option ${sourceType === 'creative_wall' ? 'active' : ''}`} onClick={() => setSourceType('creative_wall')}>
          <span className="crc-source-icon">📝</span>
          <div className="crc-source-info">
            <span className="crc-source-label">My Creative Wall</span>
            <span className="crc-source-desc">Generate from notes you've saved</span>
          </div>
          {sourceType === 'creative_wall' && <span className="crc-source-check">✓</span>}
        </div>

        <div className={`crc-source-option ${sourceType === 'ai_chat' ? 'active' : ''}`} onClick={() => setSourceType('ai_chat')}>
          <span className="crc-source-icon">🤖</span>
          <div className="crc-source-info">
            <span className="crc-source-label">AI Chat History</span>
            <span className="crc-source-desc">Generate from past Vaibey conversations</span>
          </div>
          {sourceType === 'ai_chat' && <span className="crc-source-check">✓</span>}
        </div>
      </div>

      {sourceType === 'creative_wall' && (
        <div className="crc-note-selection">
          <div className="crc-note-search">
            <input type="text" placeholder="Search your notes…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="crc-search-input" />
            <span className="crc-note-count">{filteredNotes.length} notes found</span>
          </div>
          <div className="crc-note-list">
            {filteredNotes.length === 0 ? (
              <div className="crc-empty-notes"><span>📭</span><p>No notes found. Write something in the Creative Workspace first!</p></div>
            ) : (
              filteredNotes.map(note => (
                <div key={note.id} className={`crc-note-item ${selectedNotes.includes(note.id) ? 'selected' : ''}`} onClick={() => toggleSelected(note.id)}>
                  <div className="crc-note-checkbox">{selectedNotes.includes(note.id) && <span>✓</span>}</div>
                  <div className="crc-note-info">
                    <span className="crc-note-title">{note.title || 'Untitled Note'}</span>
                    <span className="crc-note-subject">{note.subject || 'General'}</span>
                  </div>
                  <span className="crc-note-date">{new Date(note.created_at).toLocaleDateString()}</span>
                </div>
              ))
            )}
          </div>
          {selectedNotes.length > 0 && <div className="crc-selected-count">{selectedNotes.length} note{selectedNotes.length > 1 ? 's' : ''} selected</div>}
        </div>
      )}

      {sourceType === 'ai_chat' && (
        <div className="crc-note-selection">
          <div className="crc-note-search">
            <input type="text" placeholder="Search your conversations…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="crc-search-input" />
            <span className="crc-note-count">{filteredThreads.length} conversations found</span>
          </div>
          <div className="crc-note-list">
            {filteredThreads.length === 0 ? (
              <div className="crc-empty-notes"><span>💬</span><p>No AI chat history found yet. Ask Vaibey something first!</p></div>
            ) : (
              filteredThreads.map(thread => (
                <div key={thread.id} className={`crc-note-item ${selectedNotes.includes(thread.id) ? 'selected' : ''}`} onClick={() => toggleSelected(thread.id)}>
                  <div className="crc-note-checkbox">{selectedNotes.includes(thread.id) && <span>✓</span>}</div>
                  <div className="crc-note-info">
                    <span className="crc-note-title">{thread.title || 'Untitled Conversation'}</span>
                    <span className="crc-note-subject">{CHAT_MODE_LABELS[thread.mode] || thread.mode} · {threadPreviewText(thread)}{threadPreviewText(thread).length >= 90 ? '…' : ''}</span>
                  </div>
                  <span className="crc-note-date">{new Date(thread.updated_at).toLocaleDateString()}</span>
                </div>
              ))
            )}
          </div>
          {selectedNotes.length > 0 && <div className="crc-selected-count">{selectedNotes.length} conversation{selectedNotes.length > 1 ? 's' : ''} selected</div>}
        </div>
      )}

      <button className="crc-next-btn" onClick={() => setStep(2)} disabled={selectedNotes.length === 0}>
        Next: Configure →
      </button>
    </div>
  );

  const renderConfiguration = () => (
    <div className="crc-step">
      <div className="crc-step-header"><span className="crc-step-number">2</span><h3>Configure Your Quiz Room</h3></div>
      {renderError()}

      <div className="crc-config-section">
        <h4 className="crc-section-title">📚 Content</h4>
        <div className="crc-config-grid">
          <div className="crc-config-field">
            <label>Subject</label>
            <select value={subject} onChange={e => setSubject(e.target.value)}>
              {['General', 'Math', 'Science', 'Biology', 'Chemistry', 'Physics', 'Astronomy', 'History', 'English', 'Filipino', 'Programming', 'Arts', 'Television', 'Animals', 'Movies', 'Sports', 'Anime', 'Music', 'Felip', 'SB19', 'Other']
                .map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="crc-config-field">
            <label>Difficulty</label>
            <div className="crc-difficulty-btns"> 
              {['easy', 'medium', 'hard'].map(d => (
                <button key={d} className={`crc-difficulty-btn ${difficulty === d ? 'active' : ''}`} onClick={() => setDifficulty(d)}>
                  {d === 'easy' && '🟢'}{d === 'medium' && '🟡'}{d === 'hard' && '🔴'}{d.charAt(0).toUpperCase() + d.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="crc-config-field full-width">
            <label>Question Count</label>
            <div className="crc-count-btns">{[5, 10, 15, 20].map(c => (
              <button key={c} className={`crc-count-btn ${questionCount === c ? 'active' : ''}`} onClick={() => setQuestionCount(c)}>{c}</button>
            ))}</div>
          </div>
        </div>
      </div>

      <div className="crc-config-section">
        <h4 className="crc-section-title">⚙️ Room Settings</h4>
        <div className="crc-config-grid">
          <div className="crc-config-field">
            <label>Max Players</label>
            <div className="crc-count-btns">{[5, 10, 15, 25, 50].map(p => (
              <button key={p} className={`crc-count-btn ${maxPlayers === p ? 'active' : ''}`} onClick={() => setMaxPlayers(p)}>{p}</button>
            ))}</div>
          </div>

          <div className="crc-config-field">
            <label>Timer (seconds)</label>
            <div className="crc-count-btns">
              {[15, 30, 45, 60].map(t => (
                <button key={t} className={`crc-count-btn ${questionTimer === t ? 'active' : ''}`} onClick={() => setQuestionTimer(t)}>{t}s</button>
              ))}
            </div>
          </div>

          <div className="crc-config-field full-width">
            <label>Time Limit</label>
            <div className="crc-count-btns">
              {[5, 10, 15, 20, 30].map(t => (
                <button key={t} className={`crc-count-btn ${timeLimit === t ? 'active' : ''}`} onClick={() => setTimeLimit(t)}>{t}m</button>
              ))}
              <button className={`crc-count-btn ${timeLimit === null ? 'active' : ''}`} onClick={() => setTimeLimit(null)}>∞ No limit</button>
            </div>
            {timeLimit === null && (
              <p className="crc-mode-hint">This room won't auto-expire — end it manually from Controls when you're done.</p>
            )}
          </div>
        </div>
      </div>

      <div className="crc-config-section">
        <h4 className="crc-section-title">🎮 Game Mode</h4>
        <div className="crc-config-grid">
          <div className="crc-config-field full-width">
            <label>Room Type</label>
            <div className="crc-difficulty-btns">
              <button className={`crc-difficulty-btn ${roomMode === 'solo' ? 'active' : ''}`} onClick={() => setRoomMode('solo')}>🧩 Solo Quiz</button>
              <button className={`crc-difficulty-btn ${roomMode === 'race' ? 'active' : ''}`} onClick={() => setRoomMode('race')}>🏁 Quiz Arena</button>
            </div>
            <p className="crc-mode-hint">
              {roomMode === 'solo' ? 'Everyone answers at their own pace, privately.' : 'Everyone races live — fastest correct answer wins each question!'}
            </p>
          </div>

          <div className="crc-config-field full-width">
            <label className="crc-smart-mode">
              <input type="checkbox" checked={aiAssistantEnabled} onChange={e => setAiAssistantEnabled(e.target.checked)} />
              🤖 Enable AI Assistant
            </label>
            <p className="crc-mode-hint">AI will provide hints and explanations during the quiz (host can toggle this anytime)</p>
          </div>
          
         {roomMode === 'race' && (
           <div className="crc-config-field full-width">
             <label className="crc-smart-mode">
               <input type="checkbox" checked={showInBanner} onChange={e => setShowInBanner(e.target.checked)} />
               📢 Show in Challenge Banner
             </label>
             <p className="crc-mode-hint">Feature this in the scrolling live-challenge ticker across EduFeed. You can turn this off anytime without ending the room.</p>
           </div>
         )}
        </div>
      </div>

      <div className="crc-config-section">
        <h4 className="crc-section-title">🏷️ Details</h4>
        <div className="crc-config-grid">
          <div className="crc-config-field full-width">
            <label>Cover Image / GIF / Video <span className="crc-optional-tag">optional</span></label>
            {!coverPreviewUrl ? (
              <label className="crc-cover-dropzone">
                <input type="file" accept="image/*,video/*" onChange={handleCoverSelect} hidden />
                <span className="crc-cover-dropzone-icon">📸</span>
                <span className="crc-cover-dropzone-text">Click to upload a cover for this room</span>
                <span className="crc-cover-dropzone-hint">Shown on the room and its EduFeed post</span>
              </label>
            ) : (
              <div className="crc-cover-preview">
                {coverMediaType === 'video' ? (
                  <video src={coverPreviewUrl} className="crc-cover-preview-media" muted loop autoPlay playsInline />
                ) : (
                  <img src={coverPreviewUrl} alt="Cover preview" className="crc-cover-preview-media" />
                )}
                <button type="button" className="crc-cover-remove" onClick={removeCover}>✕</button>
                {uploadingCover && <div className="crc-cover-uploading">Uploading…</div>}
              </div>
            )}
            {coverError && <p className="crc-cover-error">{coverError}</p>}
          </div>

          <div className="crc-config-field full-width">
            <label>Room Title</label>
            <input type="text" placeholder="Enter a title for your quiz room..." value={roomTitle} onChange={e => setRoomTitle(e.target.value)} className="crc-title-input" />
          </div>

          <div className="crc-config-field full-width">
            <label>Description</label>
            <textarea placeholder="Describe what this quiz is about..." value={roomDescription} onChange={e => setRoomDescription(e.target.value)} className="crc-desc-input" rows={2} />
          </div>
        </div>
      </div>

      <div className="crc-actions">
        <button className="crc-back-btn" onClick={() => setStep(1)}>← Back</button>
        <button className="crc-generate-btn" onClick={handleConfigNext} disabled={generating}>
         {generating
           ? <><span className="crc-spinner">⏳</span> Generating Questions...</>
           : isEditing && selectedNotes.length === 0 ? '→ Review Questions' : '🚀 Generate Questions'}
        </button>
      </div>
    </div>
  );

  const renderPreview = () => (
    <div className="crc-step">
      <div className="crc-step-header">
        <span className="crc-step-number">3</span><h3>Review & Edit Questions</h3>
        <span className="crc-question-count">{generatedQuestions.length} questions</span>
      </div>
      {renderError()}

      <div className="crc-questions-list">
        {generatedQuestions.map((q, index) => (
          <div key={index} className="crc-question-item">
            <div className="crc-question-header">
              <span className="crc-q-number">Q{index + 1}</span>
              <button className="crc-q-remove" onClick={() => removeQuestion(index)}>✕</button>
            </div>
            <input type="text" value={q.question} onChange={e => updateQuestion(index, 'question', e.target.value)} className="crc-q-input" placeholder="Question text" />
            <div className="crc-q-options">
              {q.options?.map((opt, optIndex) => (
                <div key={optIndex} className="crc-q-option">
                  <span className="crc-q-opt-letter">{['A', 'B', 'C', 'D'][optIndex]}</span>
                  <input type="text" value={opt} onChange={e => {
                    const newOptions = [...q.options];
                    newOptions[optIndex] = e.target.value;
                    updateQuestion(index, 'options', newOptions);
                  }} className="crc-q-opt-input" placeholder={`Option ${['A', 'B', 'C', 'D'][optIndex]}`} />
                  <button className={`crc-q-correct-btn ${q.correct_index === optIndex ? 'correct' : ''}`} onClick={() => updateQuestion(index, 'correct_index', optIndex)} title="Mark as correct">
                    {q.correct_index === optIndex ? '✓' : '○'}
                  </button>
                </div>
              ))}
            </div>
            <div className="crc-q-explanation">
              <input type="text" value={q.explanation || ''} onChange={e => updateQuestion(index, 'explanation', e.target.value)} className="crc-q-exp-input" placeholder="Explanation (optional)" />
            </div>
          </div>
        ))}
      </div>

      <div className="crc-actions">
        <button className="crc-back-btn" onClick={() => setStep(2)}>← Back</button>
        <button className="crc-publish-btn" onClick={createRoom} disabled={loading || generatedQuestions.length === 0 || uploadingCover}>
          {loading ? (isEditing ? '⏳ Saving...' : '⏳ Creating Room...') : uploadingCover ? '⏳ Uploading cover…' : isEditing ? '💾 Save Changes' : '🚀 Go Live!'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="community-room-creator">
      <div className="crc-header"><h2>{isEditing ? '✏️ Edit Quiz Room' : '🎮 Create Live Quiz Room'}</h2><button className="crc-close-btn" onClick={onClose}>✕</button></div>
      <div className="crc-progress">
        <div className={`crc-progress-step ${step >= 1 ? 'active' : ''}`}><span>1</span> Source</div>
        <div className={`crc-progress-step ${step >= 2 ? 'active' : ''}`}><span>2</span> Configure</div>
        <div className={`crc-progress-step ${step >= 3 ? 'active' : ''}`}><span>3</span> Preview</div>
      </div>
      <div className="crc-body">
        {step === 1 && renderSourceSelection()}
        {step === 2 && renderConfiguration()}
        {step === 3 && renderPreview()}
      </div>
    </div>
  );
};

export default CommunityRoomCreator;