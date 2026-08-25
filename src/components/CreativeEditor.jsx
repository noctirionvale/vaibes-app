import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import Image from '@tiptap/extension-image';
import { Node, mergeAttributes } from '@tiptap/core';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import CommunityRoomCreator from './CommunityRoomCreator';
import './CreativeEditor.css';

// Minimal inline <video> node so the rich text editor can embed an uploaded
// video clip directly in the post body, the same way Image already does —
// this is what lets a post mix images and video together, not just stack
// them as separate attachments below the text.
const VideoEmbed = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return { src: { default: null } };
  },
  parseHTML() {
    return [{ tag: 'video[src]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['video', mergeAttributes(HTMLAttributes, { controls: 'true', class: 'creative-video-embed' })];
  },
  addCommands() {
    return {
      setVideoEmbed: (attrs) => ({ commands }) => commands.insertContent({ type: this.name, attrs }),
    };
  },
});

const uploadFile = async (file, folder) => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw new Error('Authentication error');
    if (!user) throw new Error('Please log in to upload files');
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/${timestamp}_${randomStr}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from('creatives').upload(filePath, file, { cacheControl: '3600', upsert: false });
    if (uploadError) throw uploadError;
    const { data: { publicUrl } } = supabase.storage.from('creatives').getPublicUrl(filePath);
    return { name: file.name, url: publicUrl, type: file.type, size: file.size, path: filePath, uploadedAt: new Date().toISOString() };
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
};

const escapeHtml = (str) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// AI actions run on the current selection (or whole draft if nothing's selected)
// via the existing /api/ai chat endpoint — same credit wallet as AI Chat.
const AI_ACTIONS = [
  { key: 'explain',   label: 'Explain',          icon: '💡', prompt: 'Explain the following text clearly and simply for a student, as if teaching the concept from scratch. Keep it concise. Return only the explanation.' },
  { key: 'simplify',  label: 'Simplify',         icon: '🧩', prompt: 'Rewrite the following text in simpler, easier-to-understand language, keeping the same meaning. Return only the rewritten text.' },
  { key: 'expand',    label: 'Expand',           icon: '➕', prompt: 'Expand the following text with more detail and relevant examples, keeping the same tone. Return only the expanded text.' },
  { key: 'improve',   label: 'Improve Wording',  icon: '✨', prompt: 'Improve the wording, flow, and clarity of the following text without changing its meaning or length much. Return only the improved text.' },
  { key: 'grammar',   label: 'Fix Grammar',      icon: '✅', prompt: 'Fix all grammar, spelling, and punctuation errors in the following text without changing meaning or style. Return only the corrected text.' },
  { key: 'academic',  label: 'Make Academic',    icon: '🎓', prompt: 'Rewrite the following text in a more formal, academic tone suitable for a school essay. Return only the rewritten text.' },
  { key: 'shorten',   label: 'Make Shorter',     icon: '✂️', prompt: 'Condense the following text to be significantly shorter while keeping key meaning. Return only the shortened text.' },
  { key: 'continue',  label: 'Continue Writing', icon: '➡️', prompt: 'Continue writing from where the following text leaves off, matching its tone and style. Write 2-4 more sentences. Return only the continuation.' },
  { key: 'examples',  label: 'Give Examples',    icon: '📎', prompt: 'Provide 2-3 concrete, relevant examples that illustrate or support the following text. Return only the examples.' },
  { key: 'reasoning', label: 'Check Reasoning',  icon: '🔍', prompt: 'Critically evaluate the reasoning and argument in the following text. Point out gaps, weaknesses, or unsupported claims directly.' },
  { key: 'translate', label: 'Translate…',       icon: '🌐', prompt: null },
];
const MAX_AI_SELECTION_CHARS = 6000; // client-side cost guard, ahead of the server's MAX_INPUT_CHARS

// Templates seed the editor with real structure (headings + short prompts),
// not just formatting — this is what makes "blank page" feel like a workspace.
const buildTemplateHTML = (sections) =>
  sections.map(([h, p]) => `<h2>${h}</h2><p><em>${p}</em></p>`).join('');

const TEMPLATE_CATEGORIES = [
  { key: 'academic', label: 'Academic', icon: '🎓', templates: [
    { key: 'essay', label: 'Essay', icon: '📝', sections: [
      ['Thesis Statement', 'State your central argument in one clear sentence.'],
      ['Introduction', 'Hook the reader and introduce your topic.'],
      ['Body Paragraph 1', 'First supporting point + evidence.'],
      ['Body Paragraph 2', 'Second supporting point + evidence.'],
      ['Body Paragraph 3', 'Third supporting point + evidence.'],
      ['Counterargument', 'Address the strongest opposing view.'],
      ['Conclusion', 'Restate your thesis and close with impact.'],
    ]},
    { key: 'research_paper', label: 'Research Paper', icon: '🔬', sections: [
      ['Abstract', 'One-paragraph summary of the paper.'],
      ['Introduction', 'Background and research question.'],
      ['Literature Review', 'What existing sources say.'],
      ['Methodology', 'How you gathered/analyzed evidence.'],
      ['Results', 'What you found.'],
      ['Discussion', 'What the results mean.'],
      ['Conclusion', 'Summary and implications.'],
      ['References', 'Add your citations here.'],
    ]},
    { key: 'lab_report', label: 'Lab Report', icon: '🧪', sections: [
      ['Objective', 'What the experiment is testing.'],
      ['Hypothesis', 'Your predicted outcome.'],
      ['Materials', 'List everything used.'],
      ['Procedure', 'Step-by-step method.'],
      ['Results', 'Raw data and observations.'],
      ['Data Analysis', 'Interpret the results.'],
      ['Conclusion', 'Was the hypothesis supported?'],
    ]},
    { key: 'case_study', label: 'Case Study', icon: '📊', sections: [
      ['Background', 'Context of the case.'],
      ['Problem Statement', 'The core issue being examined.'],
      ['Analysis', 'Break down the key factors.'],
      ['Alternatives Considered', 'Other possible approaches.'],
      ['Recommendation', 'Your proposed solution.'],
      ['Implementation Plan', 'How it would be carried out.'],
    ]},
    { key: 'lit_review', label: 'Literature Review', icon: '📚', sections: [
      ['Introduction', 'Scope and purpose of the review.'],
      ['Theme 1', 'Group sources around this theme.'],
      ['Theme 2', 'Group sources around this theme.'],
      ['Synthesis', 'How the sources relate to each other.'],
      ['Gaps in Research', 'What is still unanswered.'],
      ['Conclusion', 'Summary of the field.'],
    ]},
    { key: 'reflection', label: 'Reflection Paper', icon: '💭', sections: [
      ['What Happened', 'Describe the experience or reading.'],
      ['What I Learned', 'Key takeaways.'],
      ['How I\u2019ll Apply This', 'Connect it to future work or life.'],
      ['Conclusion', 'Final thoughts.'],
    ]},
    { key: 'book_report', label: 'Book Report', icon: '📖', sections: [
      ['Summary', 'Brief plot/content overview.'],
      ['Main Characters / Ideas', 'Who or what drives the book.'],
      ['Themes', 'Key themes or messages.'],
      ['Personal Response', 'Your reaction and opinion.'],
      ['Recommendation', 'Who should read this and why.'],
    ]},
  ]},
  { key: 'school', label: 'School', icon: '🏫', templates: [
    { key: 'reviewer', label: 'Reviewer', icon: '📋', sections: [
      ['Topic', 'What this reviewer covers.'],
      ['Key Terms & Definitions', 'List important vocabulary.'],
      ['Important Concepts', 'Core ideas to remember.'],
      ['Practice Questions', 'Write questions to test yourself.'],
      ['Answer Key', 'Answers to the questions above.'],
    ]},
    { key: 'study_guide', label: 'Study Guide', icon: '🗒️', sections: [
      ['Overview', 'What this topic is about.'],
      ['Key Concepts', 'Main ideas broken down.'],
      ['Formulas / Definitions', 'Anything to memorize.'],
      ['Common Mistakes', 'Pitfalls to avoid.'],
      ['Quick Review Checklist', 'Final checklist before a test.'],
    ]},
    { key: 'notes', label: 'Notes', icon: '✍️', sections: [
      ['Topic', 'What today\u2019s notes cover.'],
      ['Main Points', 'Key ideas from class or reading.'],
      ['Supporting Details', 'Examples, data, explanations.'],
      ['Questions I Still Have', 'Things to follow up on.'],
    ]},
    { key: 'flashcards', label: 'Flashcards', icon: '🃏', sections: [
      ['Card 1', 'Front: [question] — Back: [answer]'],
      ['Card 2', 'Front: [question] — Back: [answer]'],
      ['Card 3', 'Front: [question] — Back: [answer]'],
    ]},
    { key: 'presentation', label: 'Presentation Outline', icon: '🎤', sections: [
      ['Title Slide', 'Topic and your name.'],
      ['Agenda', 'What you\u2019ll cover, in order.'],
      ['Key Point 1', 'First main idea + supporting visual.'],
      ['Key Point 2', 'Second main idea + supporting visual.'],
      ['Key Point 3', 'Third main idea + supporting visual.'],
      ['Summary', 'Recap the main takeaways.'],
      ['Q&A', 'Anticipated questions.'],
    ]},
  ]},
  { key: 'creative', label: 'Creative', icon: '🎨', templates: [
    { key: 'story', label: 'Story', icon: '📕', sections: [
      ['Setting', 'Where and when it takes place.'],
      ['Characters', 'Who\u2019s in the story.'],
      ['Beginning', 'How it starts.'],
      ['Middle', 'The rising action / conflict.'],
      ['End', 'How it resolves.'],
    ]},
    { key: 'script', label: 'Script', icon: '🎬', sections: [
      ['Characters', 'List of characters.'],
      ['Scene 1', 'Setting + dialogue.'],
      ['Scene 2', 'Setting + dialogue.'],
      ['Scene 3', 'Setting + dialogue.'],
    ]},
    { key: 'poem', label: 'Poem', icon: '🖋️', sections: [
      ['Theme / Mood', 'What feeling you want to capture.'],
      ['Draft', 'Start writing here.'],
    ]},
    { key: 'portfolio', label: 'Portfolio', icon: '💼', sections: [
      ['About Me', 'Short intro.'],
      ['Project 1', 'Title + description.'],
      ['Project 2', 'Title + description.'],
      ['Skills', 'What you bring to the table.'],
      ['Contact', 'How people can reach you.'],
    ]},
    { key: 'proposal', label: 'Project Proposal', icon: '📌', sections: [
      ['Problem Statement', 'What issue you\u2019re solving.'],
      ['Proposed Solution', 'Your approach.'],
      ['Goals & Objectives', 'What success looks like.'],
      ['Timeline', 'Key milestones and dates.'],
      ['Resources Needed', 'What it will take.'],
      ['Expected Outcome', 'What will change.'],
    ]},
  ]},
];

// ✅ FIX 1: Added consts for Feedback Mode
const CATEGORY_META = {
  argument:    { label: 'Argument',       icon: '⚖️' },
  evidence:    { label: 'Evidence',       icon: '🔎' },
  structure:   { label: 'Structure',      icon: '🏗️' },
  grammar:     { label: 'Grammar',        icon: '✅' },
  clarity:     { label: 'Clarity',        icon: '💡' },
  tone:        { label: 'Academic Tone',  icon: '🎓' },
  originality: { label: 'Originality',    icon: '✨' },
  citations:   { label: 'Citations',      icon: '📎' },
};

const SEVERITY_META = {
  red:    { icon: '🔴', order: 0 },
  yellow: { icon: '🟡', order: 1 },
  green:  { icon: '🟢', order: 2 },
};

const FEEDBACK_SYSTEM_PROMPT = `You are Vaibey, acting as a strict but encouraging writing tutor — not a ghostwriter. Review the student's text below like a teacher giving feedback, not rewriting it for them.

Evaluate across these categories where relevant: argument, evidence, structure, grammar, clarity, tone (academic tone), originality, citations.

For each notable issue or strength, create one entry. Aim for 4-10 entries covering a mix of severities — don't only list problems; include at least one green entry if something is genuinely done well.

Respond with ONLY valid JSON, no markdown fences, no commentary, in exactly this shape:
{"overall":"one or two sentence summary of the piece as a whole","issues":[{"category":"argument|evidence|structure|grammar|clarity|tone|originality|citations","severity":"red|yellow|green","quote":"a short exact phrase from the text this refers to, under 12 words","comment":"specific, actionable feedback explaining the issue or strength"}]}

Do not rewrite the text. Do not add markdown formatting. Return raw JSON only.`;

const CreativeEditor = ({ onShareToDM, onClose, onContentCreated, userTier = 'free', onOpenBilling, editItem, onEditDone, draftKey = 'main' }) => {
  const { user } = useAuth();
  const isAdmin = user?.email === 'noctirionvale@gmail.com';
  const draftStorageKey = user ? `creative_draft_${user.id}_${draftKey}` : null;

  // ── Core state ──
  const [editingId, setEditingId] = useState(null);
  const [formTitle, setFormTitle] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [fileUploading, setFileUploading] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [saving, setSaving] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [showYoutubeInput, setShowYoutubeInput] = useState(false);

  // ── Panel visibility ──
  const [wallOpen, setWallOpen] = useState(false);
  const [eduOpen, setEduOpen] = useState(false);
  const [roomOpen, setRoomOpen] = useState(false);

  // ── EduFeed state ──
  const [eduType, setEduType] = useState('quiz');
  const [eduSubject, setEduSubject] = useState('General');
  const [alsoPostToWall, setAlsoPostToWall] = useState(false);
  const [flashFront, setFlashFront] = useState('');
  const [flashBack, setFlashBack] = useState('');

  // ── Subject Quiz state ──
  const [subjectQuizQuestion, setSubjectQuizQuestion] = useState('');
  const [subjectQuizAnswer, setSubjectQuizAnswer] = useState('');
  const [quizMedia, setQuizMedia] = useState([]);
  const [quizYoutubeUrl, setQuizYoutubeUrl] = useState('');
  const [showQuizYoutubeInput, setShowQuizYoutubeInput] = useState(false);

  // ── Studio Quiz state ──
  const [quizQuestions, setQuizQuestions] = useState([{
    id: Date.now(), timestamp: 0, question: '',
    options: ['', '', '', ''], correct_index: 0, points: 5,
  }]);

  const autoSaveTimer = useRef(null);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);

  // ── AI & Stats state ──
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [aiMenuPos, setAiMenuPos] = useState({ top: 0, left: 0, openUp: false });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null); // { actionLabel, text, from, to, wasFullDoc }
  const [aiError, setAiError] = useState('');
  const [targetWordCount, setTargetWordCount] = useState(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateCategory, setTemplateCategory] = useState('academic');
  
  // ✅ FIX 2: Added Feedback Mode state
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackResult, setFeedbackResult] = useState(null); // { overall, issues: [...] }
  const [feedbackError, setFeedbackError] = useState('');

  const aiButtonRef = useRef(null);
  const aiDropdownRef = useRef(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Write your thoughts, study notes, or creative ideas here...' }),
      Typography,
      Image.configure({ HTMLAttributes: { class: 'creative-image-embed' } }),
      VideoEmbed,
    ],
    content: '',
    editorProps: { attributes: { class: 'creative-editor-content' } },
  });

  // ── Outside click / scroll / resize for the portaled AI menu ──
  useEffect(() => {
    if (!aiMenuOpen) return;
    const handleClickOutside = (e) => {
      if (aiButtonRef.current?.contains(e.target)) return;
      if (aiDropdownRef.current?.contains(e.target)) return;
      setAiMenuOpen(false);
    };
    const handleClose = () => setAiMenuOpen(false);
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleClose, true); // capture: catches scroll on any ancestor, incl. the toolbar itself
    window.addEventListener('resize', handleClose);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('resize', handleClose);
    };
  }, [aiMenuOpen]);

  const AI_MENU_WIDTH = 200; // px — keep in sync with .ai-tool-dropdown width in CSS
  const toggleAiMenu = () => {
    if (aiMenuOpen) { setAiMenuOpen(false); return; }
    const rect = aiButtonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const openUp = window.innerHeight - rect.bottom < 320 && rect.top > 320;
    setAiMenuPos({
      top: openUp ? rect.top - 6 : rect.bottom + 6,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - AI_MENU_WIDTH - 8)),
      openUp,
    });
    setAiMenuOpen(true);
  };

  // ── Studio Quiz handlers ──
  const addQuizQuestion = () => {
    setQuizQuestions(prev => [...prev, {
      id: Date.now(), timestamp: 0, question: '',
      options: ['', '', '', ''], correct_index: 0, points: 5,
    }]);
  };

  const updateQuizQuestion = (id, field, value) =>
    setQuizQuestions(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q));

  // ── Subject Quiz handlers ──
  const handleQuizMediaUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileUploading(true);
    try {
      const att = await uploadFile(file, 'quiz-media');
      setQuizMedia(prev => [...prev, att]);
    } catch (err) {
      alert('Upload failed: ' + (err.message || 'Unknown error'));
    } finally {
      setFileUploading(false);
      e.target.value = '';
    }
  };

  const handleAddQuizYoutube = () => {
    if (!quizYoutubeUrl.trim()) return;
    const match = quizYoutubeUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|live\/|embed\/))([^?&\s]+)/);
    const videoId = match?.[1];
    if (!videoId) { alert('Invalid YouTube URL'); return; }

    setQuizMedia(prev => [...prev, {
      name: `YouTube: ${videoId}`,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
      type: 'youtube',
    }]);
    setQuizYoutubeUrl('');
    setShowQuizYoutubeInput(false);
  };

  const removeQuizMedia = (index) => {
    setQuizMedia(prev => prev.filter((_, i) => i !== index));
  };

  // ── Draft helpers ──
  const saveDraft = useCallback(() => {
    if (!user || !draftStorageKey || editingId) return;
    const content = editor?.getHTML() || '';
    const hasEduContent = eduType === 'quiz'
     ? quizQuestions.some(q => q.question.trim())
     : eduType === 'subject_quiz'
      ? !!(subjectQuizQuestion || subjectQuizAnswer || quizMedia.length)
       : !!(flashFront || flashBack);
   if (formTitle || content || attachments.length || (eduOpen && hasEduContent)) {
    localStorage.setItem(draftStorageKey, JSON.stringify({
       title: formTitle, content, attachments,
       wallOpen, eduOpen, eduType, eduSubject, alsoPostToWall,
       flashFront, flashBack, subjectQuizQuestion, subjectQuizAnswer,
       quizMedia, quizQuestions,
       savedAt: new Date().toISOString(),
     }));
      setHasDraft(true);
    }
  }, [user, draftStorageKey, editingId, formTitle, editor, attachments, wallOpen, eduOpen, eduType, eduSubject, alsoPostToWall, flashFront, flashBack, subjectQuizQuestion, subjectQuizAnswer, quizMedia, quizQuestions]);

  const clearDraft = useCallback(() => {
    if (draftStorageKey) { localStorage.removeItem(draftStorageKey); setHasDraft(false); }
  }, [draftStorageKey]);

  // ── Draft auto-save ──
  useEffect(() => {
    if (!user || !editor || !draftStorageKey) return;
    if (editItem) return;
    const saved = localStorage.getItem(draftStorageKey);
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        if (draft.title || draft.content || draft.attachments?.length || draft.eduOpen) {
          setFormTitle(draft.title || '');
          if (draft.content) editor.commands.setContent(draft.content);
          setAttachments(draft.attachments || []);
          setWallOpen(draft.wallOpen || false);
          setEduOpen(draft.eduOpen || false);
          setEduType(draft.eduType || 'quiz');
          setEduSubject(draft.eduSubject || 'General');
          setAlsoPostToWall(draft.alsoPostToWall || false);
          setFlashFront(draft.flashFront || '');
          setFlashBack(draft.flashBack || '');
          setSubjectQuizQuestion(draft.subjectQuizQuestion || '');
          setSubjectQuizAnswer(draft.subjectQuizAnswer || '');
          setQuizMedia(draft.quizMedia || []);
          if (draft.quizQuestions?.length) setQuizQuestions(draft.quizQuestions);
          setHasDraft(true);
        }
      } catch {}
    }
  }, [user, editor, draftStorageKey, editItem]);

  const editorContent = editor?.getHTML() || '';
  
  // ── Stats calculations ──
  const wordCount = editor ? (editor.getText().trim().match(/\S+/g) || []).length : 0;
  const readingTime = Math.max(1, Math.round(wordCount / 200));
  const progressPct = targetWordCount ? Math.min(100, Math.round((wordCount / targetWordCount) * 100)) : 0;
  const handleEditTarget = () => {
    const val = window.prompt('Word count goal for this piece?', targetWordCount || '1000');
    if (val === null) return;
    const num = parseInt(val, 10);
    setTargetWordCount(Number.isFinite(num) && num > 0 ? num : null);
  };

  useEffect(() => {
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(saveDraft, 2000);
    return () => clearTimeout(autoSaveTimer.current);
  }, [formTitle, editorContent, attachments, saveDraft]);

  // ── Load editItem ──
  useEffect(() => {
    if (!editItem || !editor) return;
    setEditingId(editItem.id);
    setFormTitle(editItem.title || '');
    editor.commands.setContent(editItem.content || '');
    setAttachments(editItem.attachments || []);

    const isEduPost = ['quiz', 'subject_quiz', 'flashcard'].includes(editItem.type);

    if (isEduPost) {
      const quiz = editItem.quiz_data || {};
      setEduType(editItem.type);
      setEduSubject(editItem.subject || 'General');
      if (editItem.type === 'quiz') {
        setQuizQuestions(
          quiz.questions?.length
            ? quiz.questions.map(q => ({
                id: q.id ?? Date.now() + Math.random(),
                timestamp: q.timestamp ?? 0,
                question: q.question || '',
                options: [...(q.options || []), '', '', '', ''].slice(0, 4),
                correct_index: q.correct_index ?? 0,
                points: q.points ?? 5,
              }))
            : [{ id: Date.now(), timestamp: 0, question: '', options: ['', '', '', ''], correct_index: 0, points: 5 }]
        );
      } else if (editItem.type === 'subject_quiz') {
        setSubjectQuizQuestion(quiz.question || '');
        setSubjectQuizAnswer(quiz.answer || '');
        setQuizMedia(quiz.media || []);
      } else if (editItem.type === 'flashcard') {
        setFlashFront(quiz.question || '');
        setFlashBack(quiz.answer || '');
      }
      setEduOpen(true);
      setWallOpen(false);
    } else {
      setWallOpen(true);
    }

    clearDraft();
  }, [editItem, editor, clearDraft]);

  // ── Reset ──
  const resetForm = () => {
    setEditingId(null);
    setFormTitle('');
    editor?.commands.setContent('');
    setAttachments([]);
    clearDraft();
    setShowYoutubeInput(false);
    setYoutubeUrl('');
    setWallOpen(false);
    setEduOpen(false);
    setRoomOpen(false);
    setEduType('quiz');
    setEduSubject('General');
    setAlsoPostToWall(false);
    setFlashFront('');
    setFlashBack('');
    setQuizQuestions([{ id: Date.now(), timestamp: 0, question: '', options: ['', '', '', ''], correct_index: 0, points: 5 }]);
    setSubjectQuizQuestion('');
    setSubjectQuizAnswer('');
    setQuizMedia([]);
    setQuizYoutubeUrl('');
    setShowQuizYoutubeInput(false);
    if (onEditDone) onEditDone();
  };

  // ── Save ──
  const handleSave = async (destination) => {
    if (!formTitle.trim()) { alert('Please add a title'); return; }
    if (!editor) return;
    setSaving(true);

    const content = editor.getHTML();
    let allAttachments = [...attachments];

    if (eduType === 'subject_quiz' && quizMedia.length > 0) {
      allAttachments = [...allAttachments, ...quizMedia];
    }

    const hasVideo = allAttachments.some(a => a.type?.startsWith('video/'));
    const hasYoutube = allAttachments.some(a => a.type === 'youtube');
    const mediaType = hasVideo ? 'video' : hasYoutube ? 'youtube'
      : allAttachments.some(a => a.type?.startsWith('image/')) ? 'image' : 'note';

    const postToWall = async () => {
      const payload = { title: formTitle, content, attachments: allAttachments, media_type: mediaType, updated_at: new Date().toISOString() };
      if (editingId) {
        const { error } = await supabase.from('user_creatives').update(payload).eq('id', editingId);
        return error;
      }
      const { error } = await supabase.from('user_creatives').insert({ ...payload, user_id: user.id, created_at: new Date().toISOString() });
      return error;
    };

    const postToEdufeed = async () => {
      const plainContent = content.replace(/<[^>]*>/g, '').trim();
      let quiz_data = null;
      let postType = eduType;

      if (eduType === 'quiz') {
        quiz_data = {
          mode: 'simple',
          questions: quizQuestions.map(q => ({
            ...q,
            options: q.options.filter(o => o.trim()),
          })).filter(q => q.question.trim() && q.options.length > 0),
        };
        postType = 'quiz';
      }

      if (eduType === 'subject_quiz') {
        quiz_data = {
          mode: 'subject_qa',
          subject: eduSubject,
          question: subjectQuizQuestion,
          answer: subjectQuizAnswer,
          media: quizMedia.map(m => ({ url: m.url, type: m.type, name: m.name })),
        };
        postType = 'subject_quiz';
      }

      if (eduType === 'flashcard') {
        quiz_data = { question: flashFront, answer: flashBack };
        postType = 'flashcard';
      }

      const payload = {
        type: postType, title: formTitle, content: plainContent || null,
        attachments: allAttachments, media_type: mediaType, subject: eduSubject, quiz_data,
      };

      if (editingId) {
        const { error } = await supabase.from('edufeed_posts').update(payload).eq('id', editingId);
        return error;
      }

      const { error } = await supabase.from('edufeed_posts').insert({
        ...payload, user_id: user.id,
        is_pro_only: eduType === 'quiz' || eduType === 'flashcard' || eduType === 'subject_quiz',
        is_published: true,
      });
      return error;
    };

    const errors = [];

    if (destination === 'wall') {
      const err = await postToWall();
      if (err) errors.push(err.message);
    }

    if (destination === 'edufeed') {
      const err = await postToEdufeed();
      if (err) errors.push(err.message);
      if (alsoPostToWall) {
        const wallErr = await postToWall();
        if (wallErr) errors.push(wallErr.message);
      }
    }

    setSaving(false);
    if (errors.length) { alert('❌ ' + errors.join(' / ')); return; }
    clearDraft();
    resetForm();
    if (onContentCreated) onContentCreated();
  };

  // ── File handlers ──
  const handleAttachFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxSize = file.type.startsWith('image/') ? 10 * 1024 * 1024 : 50 * 1024 * 1024;
    if (file.size > maxSize) { alert(`File too large! Max ${maxSize / (1024 * 1024)}MB`); e.target.value = ''; return; }
    setFileUploading(true);
    try { const att = await uploadFile(file, 'creatives'); setAttachments(prev => [...prev, att]); } catch (err) { alert('Upload failed: ' + (err.message || 'Unknown error')); } finally { setFileUploading(false); e.target.value = ''; }
  };

  const handleVideoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) { alert('Please select a video file'); e.target.value = ''; return; }
    if (file.size > 100 * 1024 * 1024) { alert('Video must be under 100MB'); e.target.value = ''; return; }
    setFileUploading(true);
    try { const att = await uploadFile(file, 'videos'); setAttachments(prev => [...prev, att]); } catch (err) { alert('Video upload failed: ' + (err.message || 'Unknown error')); } finally { setFileUploading(false); e.target.value = ''; }
  };

  const handleAddYoutube = () => {
    if (!youtubeUrl.trim()) return;
    const match = youtubeUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|live\/|embed\/))([^?&\s]+)/);
    const videoId = match?.[1];
    if (!videoId) { alert('Invalid YouTube URL'); return; }
    setAttachments(prev => [...prev, {
      name: `YouTube: ${videoId}`,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
      type: 'youtube',
    }]);
    setYoutubeUrl('');
    setShowYoutubeInput(false);
  };

  // ── Rich text inline media ──
  const handleInsertRichImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) { alert('Image too large! Max 10MB'); e.target.value = ''; return; }
    setFileUploading(true);
    try {
      const att = await uploadFile(file, 'creatives');
      editor.chain().focus().setImage({ src: att.url, alt: att.name }).run();
    } catch (err) {
      alert('Upload failed: ' + (err.message || 'Unknown error'));
    } finally {
      setFileUploading(false);
      e.target.value = '';
    }
  };

  const handleInsertRichVideo = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    if (!file.type.startsWith('video/')) { alert('Please select a video file'); e.target.value = ''; return; }
    if (file.size > 100 * 1024 * 1024) { alert('Video must be under 100MB'); e.target.value = ''; return; }
    setFileUploading(true);
    try {
      const att = await uploadFile(file, 'videos');
      editor.chain().focus().setVideoEmbed({ src: att.url }).run();
    } catch (err) {
      alert('Video upload failed: ' + (err.message || 'Unknown error'));
    } finally {
      setFileUploading(false);
      e.target.value = '';
    }
  };

  // ── Templates ──
  const applyTemplate = (tpl) => {
    if (!editor) return;
    const hasContent = editor.getText().trim().length > 0;
    if (hasContent && !window.confirm(`Replace your current draft with the "${tpl.label}" template? This can't be undone.`)) return;
    editor.commands.setContent(buildTemplateHTML(tpl.sections));
    if (!formTitle.trim()) setFormTitle(tpl.label);
    setTemplateModalOpen(false);
    editor.commands.focus('start');
  };

  // ── AI Actions ──
  const runAIAction = async (action) => {
    if (!editor) return;
    if (!user) { alert('Please log in to use AI actions.'); return; }
    setAiMenuOpen(false);

    const { from, to, empty } = editor.state.selection;
    const wasFullDoc = empty;
    let sourceText = (empty ? editor.getText() : editor.state.doc.textBetween(from, to, ' ')).trim();
    if (!sourceText) { alert('Nothing to work with — write or select some text first.'); return; }
    if (sourceText.length > MAX_AI_SELECTION_CHARS) sourceText = sourceText.slice(0, MAX_AI_SELECTION_CHARS);

    let systemPrompt = action.prompt;
    if (action.key === 'translate') {
      const lang = window.prompt('Translate to which language?', 'Filipino');
      if (!lang?.trim()) return;
      systemPrompt = `Translate the following text into ${lang.trim()}. Return only the translated text.`;
    }

    setAiLoading(true); setAiError(''); setAiResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: 'chat', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: sourceText }] }),
      });
      if (res.status === 402) { alert('✨ No AI credits remaining. Please top up to continue.'); return; }
      if (res.status === 429) { const d = await res.json(); alert(`⚠️ ${d.error}`); return; }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error(data?.error || 'AI request failed');
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error('Empty response from AI');
      setAiResult({ actionLabel: action.label, text: text.trim(), from, to, wasFullDoc });
    } catch (err) { setAiError(err.message || 'Something went wrong'); }
    finally { setAiLoading(false); }
  };

  const applyAIResult = (mode) => {
    if (!aiResult || !editor) return;
    const html = escapeHtml(aiResult.text).split(/\n+/).filter(Boolean).map(p => `<p>${p}</p>`).join('') || '<p></p>';
    if (mode === 'replace') {
      if (aiResult.wasFullDoc) editor.chain().focus().setContent(html).run();
      else editor.chain().focus().deleteRange({ from: aiResult.from, to: aiResult.to }).insertContentAt(aiResult.from, html).run();
    } else {
      const insertAt = aiResult.wasFullDoc ? editor.state.doc.content.size : aiResult.to;
      editor.chain().focus().insertContentAt(insertAt, html).run();
    }
    setAiResult(null);
  };

  // ✅ FIX 3: Added Feedback Mode function
  const runFeedbackReview = async () => {
    if (!editor) return;
    if (!user) { alert('Please log in to request a review.'); return; }

    const { from, to, empty } = editor.state.selection;
    let sourceText = (empty ? editor.getText() : editor.state.doc.textBetween(from, to, ' ')).trim();
    if (sourceText.split(/\s+/).filter(Boolean).length < 30) {
      alert('Write a bit more before requesting a review — at least a few sentences.');
      return;
    }
    if (sourceText.length > MAX_AI_SELECTION_CHARS) sourceText = sourceText.slice(0, MAX_AI_SELECTION_CHARS);

    setFeedbackOpen(true); setFeedbackLoading(true); setFeedbackError(''); setFeedbackResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: 'chat', messages: [{ role: 'system', content: FEEDBACK_SYSTEM_PROMPT }, { role: 'user', content: sourceText }] }),
      });
      if (res.status === 402) { setFeedbackError('✨ No AI credits remaining. Please top up to continue.'); return; }
      if (res.status === 429) { const d = await res.json(); setFeedbackError(d.error); return; }

      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error(data?.error || 'Review request failed');

      const raw = data.choices?.[0]?.message?.content || '';
      const cleaned = raw.replace(/```json|```/g, '').trim();
      let parsed;
      try { parsed = JSON.parse(cleaned); } catch { throw new Error("Vaibey's review came back in an unexpected format — try again."); }
      if (!parsed?.issues || !Array.isArray(parsed.issues)) throw new Error('Unexpected review format — try again.');

      parsed.issues.sort((a, b) => (SEVERITY_META[a.severity]?.order ?? 3) - (SEVERITY_META[b.severity]?.order ?? 3));
      setFeedbackResult(parsed);
    } catch (err) {
      setFeedbackError(err.message || 'Something went wrong');
    } finally {
      setFeedbackLoading(false);
    }
  };

  const toggleWallPanel = () => { setWallOpen(o => !o); setEduOpen(false); setRoomOpen(false); };
  const toggleEduPanel  = () => { setEduOpen(o => !o); setWallOpen(false); setRoomOpen(false); };
  const toggleRoomPanel = () => { setRoomOpen(o => !o); setWallOpen(false); setEduOpen(false); };

  const handleRoomCreated = () => {
    setRoomOpen(false);
    if (onContentCreated) onContentCreated();
  };

  const ToolBtn = ({ onClick, active, title, children }) => (
    <button type="button" onClick={onClick} className={`toolbar-btn ${active ? 'active' : ''}`} title={title}>
      {children}
    </button>
  );

  const ToolFileBtn = ({ accept, onChange, title, children, disabled }) => (
    <label className={`toolbar-btn toolbar-file-btn ${disabled ? 'disabled' : ''}`} title={title}>
      {children}
      <input type="file" accept={accept} onChange={onChange} disabled={disabled} style={{ display: 'none' }} />
    </label>
  );

  if (!isAdmin && userTier !== 'pro') {
    return (
      <div className="creative-editor-paywall">
        <div className="paywall-icon">✏️</div>
        <h3>Creative Workspace is a Pro Feature</h3>
        <p>Upgrade to Pro to unlock the rich text editor, file attachments, image uploads, and your personal Vibe Wall.</p>
        <button className="upgrade-btn" onClick={() => {
          if (onClose) onClose();
          if (onOpenBilling) onOpenBilling();
        }}>Upgrade to Pro</button>
        <p className="paywall-note">✨ Free users still have access to Study Mode and live cams.</p>
      </div>
    );
  }

  return (
    <div className="creative-editor">

      {/* ── STATUS BADGES & STATS ── */}
      <div className="ce-status-row">
        <div className="ce-status-left">
          {hasDraft && <div className="draft-indicator">📝 Draft saved</div>}
          {editingId && <div className="draft-indicator ce-editing">✏️ Editing</div>}
        </div>
        <div className="ce-stats-bar">
          <span className="ce-stat">{wordCount.toLocaleString()} words</span>
          <span className="ce-stat-sep">·</span>
          <span className="ce-stat">~{readingTime} min read</span>
          <span className="ce-stat-sep">·</span>
          {targetWordCount ? (
            <button className="ce-target-progress" onClick={handleEditTarget} title="Click to change goal">
              <span className="ce-target-bar"><span className="ce-target-fill" style={{ width: `${progressPct}%` }} /></span>
              <span>{progressPct}% of {targetWordCount}</span>
            </button>
          ) : (
            <button className="ce-target-set-btn" onClick={handleEditTarget}>🎯 Set word goal</button>
          )}
        </div>
      </div>

      {/* ── SHARED: Title ── */}
      <div className="ce-title-wrap">
        <div className="ce-title-row">
          <input
            type="text"
            placeholder="Title…"
            value={formTitle}
            onChange={e => setFormTitle(e.target.value)}
            className="ce-title-input"
          />
          <button type="button" className="ce-template-btn" onClick={() => setTemplateModalOpen(true)} title="Start from a template">
            📐 Template
          </button>
        </div>
      </div>

      {/* ── SHARED: Rich Text Editor ── */}
      <div className="ce-editor-wrap">
        {editor && (
          <div className="creative-toolbar">
            <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold"><strong>B</strong></ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic"><em>I</em></ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strike"><s>S</s></ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="H2">H2</ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullets">• List</ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered">1. List</ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Code">{'</>'}</ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().undo().run()} title="Undo">↩</ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().redo().run()} title="Redo">↪</ToolBtn>
            <span className="toolbar-sep" />
            <ToolFileBtn accept="image/*" onChange={handleInsertRichImage} disabled={fileUploading} title="Insert image into post">🖼️</ToolFileBtn>
            <ToolFileBtn accept="video/*" onChange={handleInsertRichVideo} disabled={fileUploading} title="Insert video into post">🎬</ToolFileBtn>
            <span className="toolbar-sep" />
            
            {/* ✅ FIX 4: Updated AI button disabled state and added Review button */}
            <button type="button" ref={aiButtonRef} className={`toolbar-btn ai-tool-btn ${aiMenuOpen ? 'active' : ''}`}
              onClick={toggleAiMenu} disabled={aiLoading || feedbackLoading} title="AI actions">
              {aiLoading ? '⏳' : '✨ AI'}
            </button>
            {aiMenuOpen && createPortal(
              <div ref={aiDropdownRef} className="ai-tool-dropdown"
                style={{ top: aiMenuPos.top, left: aiMenuPos.left, transform: aiMenuPos.openUp ? 'translateY(-100%)' : 'none' }}>
                {AI_ACTIONS.map(a => (
                  <div key={a.key} className="ai-tool-item" onClick={() => runAIAction(a)}>
                    <span className="ai-tool-icon">{a.icon}</span> {a.label}
                  </div>
                ))}
              </div>,
              document.body
            )}
            <button type="button" className="toolbar-btn feedback-tool-btn" onClick={runFeedbackReview}
              disabled={aiLoading || feedbackLoading} title="Get a tutor-style review">
              {feedbackLoading ? '⏳' : '🔍 Review'}
            </button>
            
          </div>
        )}
        <EditorContent editor={editor} className="creative-editor-rich" />
        {(aiLoading || aiResult || aiError) && (
          <div className="ai-result-panel">
            {aiLoading && <div className="ai-result-loading">✨ Thinking…</div>}
            {aiError && <div className="ai-result-error">⚠️ {aiError}<button className="ai-result-dismiss" onClick={() => setAiError('')}>✕</button></div>}
            {aiResult && (
              <>
                <div className="ai-result-header">
                  <span>{aiResult.actionLabel}{aiResult.wasFullDoc ? ' · whole draft' : ' · selection'}</span>
                  <button className="ai-result-dismiss" onClick={() => setAiResult(null)}>✕</button>
                </div>
                <div className="ai-result-text">{aiResult.text}</div>
                <div className="ai-result-actions">
                  <button className="ai-result-btn ai-result-replace" onClick={() => applyAIResult('replace')}>↺ Replace</button>
                  <button className="ai-result-btn" onClick={() => applyAIResult('insert')}>➕ Insert Below</button>
                  <button className="ai-result-btn" onClick={() => navigator.clipboard.writeText(aiResult.text)}>📋 Copy</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════
          TEMPLATE PICKER MODAL
          ══════════════════════════════════════ */}
      {templateModalOpen && createPortal(
        <div className="ce-modal-overlay" onClick={() => setTemplateModalOpen(false)}>
          <div className="ce-modal-dialog ce-template-dialog" onClick={e => e.stopPropagation()}>
            <div className="ce-modal-header">
              <span className="ce-modal-title">📐 Start from a Template</span>
              <button type="button" className="ce-modal-close" onClick={() => setTemplateModalOpen(false)}>✕</button>
            </div>
            <div className="ce-modal-body ce-template-body">
              <div className="ce-template-tabs">
                {TEMPLATE_CATEGORIES.map(cat => (
                  <button key={cat.key} type="button"
                    className={`ce-template-tab ${templateCategory === cat.key ? 'active' : ''}`}
                    onClick={() => setTemplateCategory(cat.key)}>
                    {cat.icon} {cat.label}
                  </button>
                ))}
              </div>
              <div className="ce-template-grid">
                {TEMPLATE_CATEGORIES.find(c => c.key === templateCategory).templates.map(tpl => (
                  <button key={tpl.key} type="button" className="ce-template-card" onClick={() => applyTemplate(tpl)}>
                    <span className="ce-template-card-icon">{tpl.icon}</span>
                    <span className="ce-template-card-label">{tpl.label}</span>
                    <span className="ce-template-card-sections">
                      {tpl.sections.slice(0, 3).map(s => s[0]).join(' · ')}{tpl.sections.length > 3 ? '…' : ''}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ✅ FIX 5: Added FEEDBACK MODE — TUTOR REVIEW MODAL */}
      {feedbackOpen && createPortal(
        <div className="ce-modal-overlay" onClick={() => setFeedbackOpen(false)}>
          <div className="ce-modal-dialog ce-feedback-dialog" onClick={e => e.stopPropagation()}>
            <div className="ce-modal-header">
              <span className="ce-modal-title">🔍 Vaibey's Review</span>
              <button type="button" className="ce-modal-close" onClick={() => setFeedbackOpen(false)}>✕</button>
            </div>
            <div className="ce-modal-body ce-feedback-body">
              {feedbackLoading && <div className="feedback-loading">✨ Reading through your draft…</div>}
              {feedbackError && (
                <div className="feedback-error">
                  ⚠️ {feedbackError}
                  <button className="feedback-retry-btn" onClick={runFeedbackReview}>↺ Try Again</button>
                </div>
              )}
              {feedbackResult && (
                <>
                  <div className="feedback-overall">{feedbackResult.overall}</div>
                  {feedbackResult.issues.length === 0 ? (
                    <div className="feedback-empty">✨ No major issues found — nice work!</div>
                  ) : (
                    <>
                      <div className="feedback-legend">
                        <span>🔴 Needs work</span><span>🟡 Could improve</span><span>🟢 Strong</span>
                      </div>
                      <div className="feedback-issues">
                        {feedbackResult.issues.map((issue, idx) => (
                          <div key={idx} className={`feedback-issue feedback-issue-${issue.severity}`}>
                            <div className="feedback-issue-top">
                              <span className="feedback-severity-dot">{SEVERITY_META[issue.severity]?.icon || '⚪'}</span>
                              <span className="feedback-category-badge">
                                {CATEGORY_META[issue.category]?.icon || '📝'} {CATEGORY_META[issue.category]?.label || issue.category}
                              </span>
                            </div>
                            {issue.quote && <div className="feedback-quote">"{issue.quote}"</div>}
                            <div className="feedback-comment">{issue.comment}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  <button className="feedback-retry-btn feedback-retry-standalone" onClick={runFeedbackReview}>↺ Review Again</button>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── SHARED: Attachments preview ── */}
      {attachments.length > 0 && (
        <div className="creative-attachments">
          {attachments.map((att, idx) => (
            <div key={idx} className="attachment-item">
              {att.type === 'youtube' && (
                <iframe src={att.embedUrl} width="100%" height="140" frameBorder="0"
                  allowFullScreen title={att.name}
                  style={{ display: 'block', borderRadius: '10px 10px 0 0' }} />
              )}
              {att.type?.startsWith('video/') && <video src={att.url} controls className="att-video-preview" />}
              {att.type?.startsWith('image/') && <img src={att.url} alt={att.name} className="att-image-preview" />}
              {att.type?.startsWith('audio/') && (
                <div className="att-audio-wrap">
                  <span className="att-audio-icon">🎵</span>
                  <audio src={att.url} controls className="att-audio-preview" />
                </div>
              )}
              {!att.type?.startsWith('video/') && !att.type?.startsWith('image/') && !att.type?.startsWith('audio/') && att.type !== 'youtube' && (
                <a href={att.url} target="_blank" rel="noopener noreferrer">📎 {att.name}</a>
              )}
              <button className="att-remove" onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════
          TWO-BUTTON TOGGLE HEADER
          ══════════════════════════════════════ */}
      <div className="ce-dest-header">
        <button type="button" className={`ce-dest-btn ce-wall-btn ${wallOpen ? 'active' : ''}`} onClick={toggleWallPanel}>
          <span className="ce-dest-icon">🎨</span>
          <span className="ce-dest-label">Wall</span>
          <span className="ce-dest-tools">{!wallOpen && <span className="ce-dest-hint">text · image · video · audio · file</span>}</span>
          <span className={`ce-dest-chevron ${wallOpen ? 'open' : ''}`}>›</span>
        </button>

        <button type="button" className={`ce-dest-btn ce-edu-btn ${eduOpen ? 'active' : ''}`} onClick={toggleEduPanel}>
          <span className="ce-dest-icon">🎓</span>
          <span className="ce-dest-label">EduFeed</span>
          <span className="ce-dest-tools">{!eduOpen && <span className="ce-dest-hint">quiz · flashcard · subject</span>}</span>
          <span className={`ce-dest-chevron ${eduOpen ? 'open' : ''}`}>›</span>
        </button>

        <button type="button" className={`ce-dest-btn ce-room-btn ${roomOpen ? 'active' : ''}`} onClick={toggleRoomPanel}>
          <span className="ce-dest-icon">🎮</span>
          <span className="ce-dest-label">Room</span>
          <span className="ce-dest-tools">{!roomOpen && <span className="ce-dest-hint">live quiz race</span>}</span>
          <span className={`ce-dest-chevron ${roomOpen ? 'open' : ''}`}>›</span>
        </button>
      </div>

      {/* ══════════════════════════════════════
          WALL MODAL
          ══════════════════════════════════════ */}
      {wallOpen && createPortal(
        <div className="ce-modal-overlay" onClick={() => setWallOpen(false)}>
          <div className="ce-modal-dialog" onClick={e => e.stopPropagation()}>
            <div className="ce-modal-header">
              <span className="ce-modal-title">🎨 Post to Wall</span>
              <button type="button" className="ce-modal-close" onClick={() => setWallOpen(false)}>✕</button>
            </div>
            <div className="ce-modal-body">
              <div className="attach-row">
                <label className="attach-file-btn">
                  <span className="btn-icon">📎</span> File
                  <input ref={fileInputRef} type="file" onChange={handleAttachFile} disabled={fileUploading}
                    style={{ display: 'none' }}
                    accept="image/*,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
                </label>
                <label className="attach-file-btn">
                  <span className="btn-icon">📸</span> Photo
                  <input type="file" accept="image/*" capture="environment"
                    onChange={handleAttachFile} disabled={fileUploading} style={{ display: 'none' }} />
                </label>
                <label className="attach-file-btn">
                  <span className="btn-icon">🖼️</span> Image
                  <input type="file" accept="image/*"
                    onChange={handleAttachFile} disabled={fileUploading} style={{ display: 'none' }} />
                </label>
                <label className="attach-file-btn">
                  <span className="btn-icon">🎬</span> Video
                  <input ref={videoInputRef} type="file" accept="video/*"
                    onChange={handleVideoUpload} disabled={fileUploading} style={{ display: 'none' }} />
                </label>
                <label className="attach-file-btn">
                  <span className="btn-icon">🎵</span> Audio
                  <input type="file" accept="audio/*,.mp3"
                    onChange={handleAttachFile} disabled={fileUploading} style={{ display: 'none' }} />
                </label>
                <button type="button" className="attach-file-btn" onClick={() => setShowYoutubeInput(s => !s)}>
                  <span className="btn-icon">▶️</span> YouTube
                </button>
                {fileUploading && <span className="uploading-text">Uploading…</span>}
              </div>

              {showYoutubeInput && (
                <div className="youtube-input-row">
                  <input type="text" placeholder="Paste YouTube URL…" value={youtubeUrl}
                    onChange={e => setYoutubeUrl(e.target.value)} className="creative-title-input"
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', flex: 1 }}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddYoutube(); }} />
                  <button type="button" className="attach-file-btn"
                    onClick={handleAddYoutube} disabled={!youtubeUrl.trim()}>Add</button>
                </div>
              )}

              <button
                onClick={() => handleSave('wall')}
                className="ce-post-btn ce-post-wall"
                disabled={saving}
              >
                {saving ? '⏳ Saving…' : '📤 Post to Wall'}
              </button>

              {editingId && (
                <button onClick={resetForm} className="cancel-btn" style={{ marginTop: '0.5rem' }}>
                  Cancel Edit
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ══════════════════════════════════════
          EDUFEED MODAL
          ══════════════════════════════════════ */}
      {eduOpen && createPortal(
        <div className="ce-modal-overlay" onClick={() => setEduOpen(false)}>
        <div className="ce-modal-dialog" onClick={e => e.stopPropagation()}>
          <div className="ce-modal-header">
            <span className="ce-modal-title">🎓 Post to EduFeed</span>
            <button type="button" className="ce-modal-close" onClick={() => setEduOpen(false)}>✕</button>
          </div>
          <div className="ce-modal-body">
          {/* Type pills - Quiz, Subject Quiz, Flashcard */}
          <div className="edufeed-types-row">
            {[
              { key: 'quiz', label: '🧠 Studio Quiz' },
              { key: 'subject_quiz', label: '📚 Subject Quiz' },
              { key: 'flashcard', label: '🃏 Flashcard' },
            ].map(t => (
              <button key={t.key} type="button"
                className={`edufeed-type-btn ${eduType === t.key ? 'active' : ''}`}
                onClick={() => setEduType(t.key)}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── STUDIO QUIZ ── */}
          {eduType === 'quiz' && (
            <div className="quiz-studio-container">
              <div className="edufeed-options-row">
                <select className="edufeed-subject-select" value={eduSubject}
                  onChange={e => setEduSubject(e.target.value)}>
                  {['General', 'Math', 'Science', 'Biology', 'Chemistry', 'Physics', 'Astronomy',
                    'History', 'English', 'Filipino', 'Programming', 'Arts', 'Television', 'Animals', 'Movies', 'Sports', 'Felip', 'SB19', 'Other']
                    .map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <label className="edufeed-crosspost">
                  <input type="checkbox" checked={alsoPostToWall}
                    onChange={e => setAlsoPostToWall(e.target.checked)} />
                  <span>Also post to Wall</span>
                </label>
              </div>

              {quizQuestions.map((q, index) => (
                <div key={q.id} className="quiz-question-block">
                  <div className="q-header">
                    <span className="q-number">Q{index + 1}</span>
                    <div className="q-timestamp-input">
                      <label>⏱️</label>
                      <input type="number" min="0" value={q.timestamp}
                        onChange={e => updateQuizQuestion(q.id, 'timestamp', parseInt(e.target.value) || 0)}
                        className="timestamp-input" />
                    </div>
                  </div>
                  <input className="edufeed-quiz-q-input" placeholder="Type your question here..."
                    value={q.question} onChange={e => updateQuizQuestion(q.id, 'question', e.target.value)} />
                  <div className="edufeed-overlay-label" style={{ marginTop: '0.4rem', fontSize: '0.6rem' }}>
                    Options — tap ✓ to mark correct
                  </div>
                  {q.options.map((opt, optIndex) => (
                    <div key={optIndex} className="edufeed-quiz-opt-row">
                      <span className="edufeed-quiz-opt-letter">{['A', 'B', 'C', 'D'][optIndex]}</span>
                      <input className="edufeed-quiz-opt-input"
                        placeholder={`Option ${['A', 'B', 'C', 'D'][optIndex]}`}
                        value={opt}
                        onChange={e => {
                          const newOptions = [...q.options];
                          newOptions[optIndex] = e.target.value;
                          updateQuizQuestion(q.id, 'options', newOptions);
                        }} />
                      <button type="button"
                        className={`edufeed-quiz-correct-btn ${q.correct_index === optIndex ? 'correct' : ''}`}
                        onClick={() => updateQuizQuestion(q.id, 'correct_index', optIndex)}>✓</button>
                    </div>
                  ))}
                  <div className="q-footer">
                    <div className="points-input">
                      <label>⚡</label>
                      <input type="number" min="1" value={q.points}
                        onChange={e => updateQuizQuestion(q.id, 'points', parseInt(e.target.value) || 1)}
                        className="timestamp-input" style={{ width: '50px' }} />
                    </div>
                    {quizQuestions.length > 1 && (
                      <button type="button" className="delete-q-btn"
                        onClick={() => setQuizQuestions(prev => prev.filter(item => item.id !== q.id))}>
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <button type="button" className="add-question-btn" onClick={addQuizQuestion}>
                ➕ Add Question
              </button>
            </div>
          )}

          {/* ── SUBJECT QUIZ ── */}
          {eduType === 'subject_quiz' && (
            <div className="subject-quiz-container">
              <div className="subject-quiz-header">
                <h4>📚 Subject Quiz</h4>
                <select className="edufeed-subject-select" value={eduSubject}
                  onChange={e => setEduSubject(e.target.value)}>
                  {['General', 'Math', 'Science', 'Biology', 'Chemistry', 'Physics',
                    'History', 'Astronomy', 'English', 'Filipino', 'Programming', 'Arts', 'Television', 'Animals', 'Movies', 'Sports', 'Anime', 'Music', 'Felip', 'SB19', 'Other']
                    .map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Media Upload */}
              <div className="quiz-media-section">
                <div className="media-upload-row">
                  <label className="media-upload-btn">
                    📎 Attach File
                    <input type="file" onChange={handleQuizMediaUpload}
                      style={{ display: 'none' }}
                      accept="image/*,.pdf,.doc,.docx" />
                  </label>
                  <label className="media-upload-btn">
                    🎬 Video
                    <input type="file" onChange={handleQuizMediaUpload}
                      style={{ display: 'none' }}
                      accept="video/*" />
                  </label>
                  <label className="media-upload-btn">
                    🎵 Audio (mp3)
                    <input type="file" onChange={handleQuizMediaUpload}
                      style={{ display: 'none' }}
                      accept="audio/*,.mp3" />
                  </label>
                  <button className="media-upload-btn" onClick={() => setShowQuizYoutubeInput(true)}>
                    ▶️ YouTube
                  </button>
                  {fileUploading && <span className="uploading-text">Uploading…</span>}
                </div>

                {showQuizYoutubeInput && (
                  <div className="youtube-input-row">
                    <input type="text" placeholder="Paste YouTube URL…"
                      value={quizYoutubeUrl}
                      onChange={e => setQuizYoutubeUrl(e.target.value)}
                      className="creative-title-input"
                      style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', flex: 1 }}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddQuizYoutube(); }} />
                    <button type="button" className="attach-file-btn"
                      onClick={handleAddQuizYoutube} disabled={!quizYoutubeUrl.trim()}>Add</button>
                  </div>
                )}

                {/* Media Preview */}
                {quizMedia.length > 0 && (
                  <div className="quiz-media-preview">
                    {quizMedia.map((media, idx) => (
                      <div key={idx} className="media-item">
                        {media.type?.startsWith('image/') && (
                          <img src={media.url} alt={media.name} className="media-preview-img" />
                        )}
                        {media.type?.startsWith('video/') && (
                          <video src={media.url} controls className="media-preview-video" />
                        )}
                        {media.type?.startsWith('audio/') && (
                          <div className="att-audio-wrap">
                            <span className="att-audio-icon">🎵</span>
                            <audio src={media.url} controls className="att-audio-preview" />
                          </div>
                        )}
                        {media.type === 'youtube' && (
                          <iframe src={media.embedUrl} width="100%" height="140"
                            frameBorder="0" title={media.name} />
                        )}
                        {!media.type?.startsWith('image/') && !media.type?.startsWith('video/') && !media.type?.startsWith('audio/') && media.type !== 'youtube' && (
                          <div className="file-preview">📄 {media.name}</div>
                        )}
                        <button className="remove-media-btn"
                          onClick={() => removeQuizMedia(idx)}>
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Question & Answer */}
              <div className="subject-qa-container">
                <div className="qa-field">
                  <label className="qa-label">❓ Question</label>
                  <textarea
                    className="qa-input qa-question"
                    placeholder="Type your question here..."
                    value={subjectQuizQuestion}
                    onChange={e => setSubjectQuizQuestion(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="qa-field">
                  <label className="qa-label">✅ Answer</label>
                  <textarea
                    className="qa-input qa-answer"
                    placeholder="Type the correct answer here..."
                    value={subjectQuizAnswer}
                    onChange={e => setSubjectQuizAnswer(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              <label className="edufeed-crosspost" style={{ marginTop: '0.5rem' }}>
                <input type="checkbox" checked={alsoPostToWall}
                  onChange={e => setAlsoPostToWall(e.target.checked)} />
                <span>Also post to Wall</span>
              </label>
            </div>
          )}

          {/* ── FLASHCARD ── */}
          {eduType === 'flashcard' && (
            <div className="edufeed-quiz-builder">
              {/* Image Upload for Flashcard */}
              <div className="flashcard-media-section">
                <div className="media-upload-row">
                  <label className="media-upload-btn">
                    📸 Add Image
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setFileUploading(true);
                        try {
                          const att = await uploadFile(file, 'flashcards');
                          setAttachments(prev => [...prev, att]);
                        } catch (err) {
                          alert('Upload failed: ' + (err.message || 'Unknown error'));
                        } finally {
                          setFileUploading(false);
                        }
                      }}
                      style={{ display: 'none' }}
                    />
                  </label>
                  {fileUploading && <span className="uploading-text">Uploading…</span>}
                </div>
                
                {/* Preview attachments */}
                {attachments.filter(a => a.type?.startsWith('image/')).length > 0 && (
                  <div className="flashcard-image-preview">
                    {attachments.filter(a => a.type?.startsWith('image/')).map((img, idx) => (
                      <div key={idx} className="preview-image-item">
                        <img src={img.url} alt="Flashcard" className="preview-image" />
                        <button 
                          className="remove-preview-btn"
                          onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="edufeed-overlay-label">❓ Front (Question)</div>
              <input 
                className="edufeed-quiz-q-input" 
                placeholder="Question side..."
                value={flashFront} 
                onChange={e => setFlashFront(e.target.value)} 
              />
              <div className="edufeed-overlay-label" style={{ marginTop: '0.4rem' }}>✅ Back (Answer)</div>
              <input 
                className="edufeed-quiz-q-input" 
                placeholder="Answer side..."
                value={flashBack} 
                onChange={e => setFlashBack(e.target.value)} 
              />
            </div>
          )}

          {/* Post button */}
          <button
            onClick={() => handleSave('edufeed')}
            className="ce-post-btn ce-post-edu"
            disabled={saving ||
              (eduType === 'quiz' && quizQuestions.length === 0) ||
              (eduType === 'subject_quiz' && (!subjectQuizQuestion || !subjectQuizAnswer))}
          >
            {saving
              ? '⏳ Saving…'
              : alsoPostToWall
                ? '🎓 Post to EduFeed + Wall'
                : '🎓 Post to EduFeed'}
          </button>
          </div>
        </div>
        </div>,
        document.body
      )}

      {/* ══════════════════════════════════════
          ROOM MODAL
          ══════════════════════════════════════ */}
      {roomOpen && createPortal(
        <div className="ce-modal-overlay" onClick={() => setRoomOpen(false)}>
          <div className="ce-modal-dialog" onClick={e => e.stopPropagation()}>
            <div className="ce-modal-header">
              <span className="ce-modal-title">🎮 Create Room</span>
              <button type="button" className="ce-modal-close" onClick={() => setRoomOpen(false)}>✕</button>
            </div>
            <div className="ce-modal-body">
              <CommunityRoomCreator
                onRoomCreated={handleRoomCreated}
                onClose={() => setRoomOpen(false)}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default CreativeEditor;