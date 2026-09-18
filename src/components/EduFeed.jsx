import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import CommunityRoomPlay from './CommunityRoomPlay';
import QuizArenaModal from './QuizArenaModal';
import PlayerSpotlight from './PlayerSpotlight';
import LiveChallengeBanner from './LiveChallengeBanner';
import PointsDashboard from './PointsDashboard';
import { attachBadges } from '../lib/badgeQueries';
import './EduFeed.css'

// ── Only 2 filter options ──
const POST_TYPES = [
  { key: 'all', label: '📚 All' },
  { key: 'quiz', label: '🧠 Quizzes' },
  { key: 'community', label: '🏆 Communities' },
  { key: 'leaderboard', label: '🏆 Leaderboard' },
]

// ── Pro Upgrade Modal ──
const ProUpgradeModal = ({ onClose, onUpgrade }) => createPortal(
  <div className="modal-overlay" onClick={onClose}>
    <div className="billing-panel-modal ef-upgrade-modal" onClick={e => e.stopPropagation()}>
      <div className="billing-panel-header">
        <h3>💳 Billing &amp; Plan</h3>
        <button className="billing-close-btn" onClick={onClose}>✕</button>
      </div>
      <div className="billing-panel-content">
        <div className="ef-upgrade-hero">
          <div className="ef-upgrade-bolt">⚡</div>
          <div className="ef-upgrade-title">Upgrade to Pro</div>
          <p className="billing-usage">
            Create quizzes, host community games, and compete on the leaderboard.
          </p>
        </div>
        <div className="billing-tiers" style={{ gridTemplateColumns: '1fr' }}>
          <div className="billing-tier current-tier" style={{ position: 'relative' }}>
            <div className="tier-badge-pro">BEST VALUE</div>
            <div className="tier-header">
              <span className="tier-name">Pro</span>
              <span className="tier-price">₱99 <small>/month</small></span>
            </div>
            <ul className="tier-features">
              <li>Create interactive quizzes</li>
              <li>Host community game rooms</li>
              <li>Compete on leaderboards</li>
              <li>Unlimited AI requests</li>
              <li>Personal Vibe Wall</li>
            </ul>
            <button className="upgrade-btn" onClick={onUpgrade}>
              ⚡ Upgrade to Pro
            </button>
          </div>
        </div>
        <button className="ef-upgrade-dismiss" onClick={onClose}>Maybe later</button>
      </div>
    </div>
  </div>,
  document.body
)

// ── Comments Accordion ──
const CommentsSection = ({ post, user }) => {
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('edufeed_comments')
        .select('*, profiles(display_name, avatar_url)')
        .eq('post_id', post.id)
        .order('created_at', { ascending: true })
      if (data) setComments(data)
      setLoading(false)
    }
    load()
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [post.id])

  const handleSend = async () => {
    if (!text.trim() || !user) return
    setSending(true)
    const { data, error } = await supabase
      .from('edufeed_comments')
      .insert({ post_id: post.id, user_id: user.id, content: text.trim() })
      .select('*, profiles(display_name, avatar_url)')
      .single()
    if (!error && data) {
      setComments(prev => [...prev, data])
      setText('')
      await supabase.from('edufeed_posts')
        .update({ comment_count: (post.comment_count || 0) + 1 })
        .eq('id', post.id)
    }
    setSending(false)
  }

  const handleDelete = async (commentId) => {
    setDeletingId(commentId)
    const { error } = await supabase.from('edufeed_comments').delete().eq('id', commentId)
    if (!error) setComments(prev => prev.filter(c => c.id !== commentId))
    setDeletingId(null)
  }

  return (
    <div className="ef-comments">
      <div className="ef-comments-list">
        {loading ? (
          <div className="ef-comments-loading">Loading comments…</div>
        ) : comments.length === 0 ? (
          <div className="ef-comments-empty">No comments yet. Be first!</div>
        ) : comments.map(c => (
          <div key={c.id} className="ef-comment-row">
            <div className="ef-comment-av">
              {c.profiles?.avatar_url
                ? <img src={c.profiles.avatar_url} alt="" />
                : <span>{c.profiles?.display_name?.[0]?.toUpperCase() || '?'}</span>}
            </div>
            <div className="ef-comment-body">
              <span className="ef-comment-name">{c.profiles?.display_name || 'User'}</span>
              <span className="ef-comment-text">{c.content}</span>
            </div>
            {user?.id === c.user_id && (
              <button
                className="ef-comment-del"
                onClick={() => handleDelete(c.id)}
                disabled={deletingId === c.id}
                title="Delete comment"
              >
                {deletingId === c.id ? '…' : '✕'}
              </button>
            )}
          </div>
        ))}
      </div>
      {user ? (
        <div className="ef-comment-composer">
          <input
            ref={inputRef}
            className="ef-comment-input"
            placeholder="Write a comment…"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            maxLength={500}
          />
          <button className="ef-comment-send" onClick={handleSend} disabled={!text.trim() || sending}>
            {sending ? '…' : '↑'}
          </button>
        </div>
      ) : (
        <div className="ef-comments-guest">Sign in to comment</div>
      )}
    </div>
  )
}

// ── Card Header ──
const CardHeader = ({ post, locked, onToggleLock }) => {
  return (
    <div className="ef-relocated-meta">
      {post.profiles?.avatar_url
        ? <img src={post.profiles.avatar_url} alt="" className="edufeed-avatar" />
        : <div className="edufeed-avatar-placeholder">
            {post.profiles?.display_name?.[0]?.toUpperCase() || '?'}
          </div>}
      <div className="edufeed-user-info">
        <div className="ef-card-preview-teaser" style={{ WebkitLineClamp: 1 }}>
          {post.title || ''}
        </div>
        <div className="edufeed-meta" style={{ marginTop: 0 }}>
          <span>{new Date(post.created_at).toLocaleDateString()}</span>
          {post.is_pro_only && <span className="edufeed-pro-badge">PRO</span>}
        </div>
      </div>
      <button
        className={`edufeed-lock-btn ${locked ? 'locked' : ''}`}
        onClick={onToggleLock}
        type="button"
      >
        {locked ? '🔒' : '🔓'}
      </button>
    </div>
  )
}

// ── Card Footer ──
const CardFooter = ({
  post, onLike, liked, user, isPro,
  onToggleComments, commentsOpen, localCommentCount,
  onEdit, onDelete, deleteState, onConfirmDelete, onCancelDelete,
  onCreateClick, onShare, shared,
}) => {
  const isOwner = user?.id === post.user_id || user?.id === post.profiles?.id

  return (
    <div className="edufeed-card-footer">
      <button
        className={`edufeed-action-btn ${liked ? 'liked' : ''}`}
        onClick={() => onLike(post.id, liked)}
        disabled={!user}
        title={user ? 'Like' : 'Sign in to like'}
      >
        {liked ? '❤️' : '🤍'} {post.likes_count || 0}
      </button>

      <button
        className={`edufeed-action-btn ${commentsOpen ? 'active' : ''}`}
        onClick={onToggleComments}
        title="Comments"
      >
        💬 {localCommentCount ?? post.comment_count ?? 0}
      </button>

      <button
        className="edufeed-action-btn"
        onClick={onShare}
        title="Share"
      >
        {shared ? '✓' : '🔗'}
      </button>

      <button
        className="edufeed-action-btn ef-create-btn"
        onClick={onCreateClick}
        title="Create content"
      >
        ✦
      </button>

      <div className="edufeed-spacer" />

      {isOwner && (
        <>
          {deleteState === 'confirm' ? (
            <div className="ef-delete-confirm">
              <span>Delete?</span>
              <button className="ef-del-yes" onClick={onConfirmDelete}>Yes</button>
              <button className="ef-del-no" onClick={onCancelDelete}>No</button>
            </div>
          ) : (
            <>
              <button className="edufeed-action-btn ef-owner-btn" onClick={onEdit} title="Edit">
                ✏️
              </button>
              <button className="edufeed-action-btn ef-owner-btn ef-danger" onClick={onDelete} title="Delete">
                🗑️
              </button>
            </>
          )}
        </>
      )}
    </div>
  )
}

// ── Card Attachments (Community only now — manual quizzes render their
// own background/media treatment inside their body, see renderMqAttachment) ──
const CardAttachments = ({ attachments, variant = 'quiz' }) => {
  if (!attachments?.length) return null

  const audioAtts = attachments.filter(att => att.type?.startsWith('audio/'))
  const mediaAtts = attachments.filter(att => !att.type?.startsWith('audio/'))
  const overlayAudio = audioAtts.length > 0 && mediaAtts.length > 0

  const renderAudio = (att, idx) => (
    <div key={`audio-${idx}`} className="edufeed-att-audio">
      <span className="edufeed-att-audio-icon">🎵</span>
      <audio src={att.url} controls className="edufeed-att-audio-player" />
    </div>
  )

  const renderMedia = (att, idx) => {
    if (att.type === 'youtube')
      return (
        <div key={idx} className="edufeed-att-frame">
          <iframe
            src={att.embedUrl}
            width="100%"
            height="200"
            frameBorder="0"
            allowFullScreen
            className="edufeed-att-media"
            title={att.name}
            allow="autoplay; encrypted-media"
          />
        </div>
      )
    if (att.type?.startsWith('video/'))
      return (
        <div key={idx} className="edufeed-att-frame">
          <video src={att.url} controls autoPlay muted loop playsInline className="edufeed-att-media" />
        </div>
      )
    if (att.type?.startsWith('image/'))
      return (
        <div key={idx} className="edufeed-att-frame">
          <div className="edufeed-att-frame-bg" style={{ backgroundImage: `url(${att.url})` }} aria-hidden="true" />
          <img src={att.url} alt={att.name} className="edufeed-att-media" />
        </div>
      )
    return <a key={idx} href={att.url} target="_blank" rel="noopener noreferrer" className="edufeed-att-file"> {att.name}</a>
  }

  return (
    <div className={`edufeed-attachments edufeed-attachments-top is-${variant}`}>
      {overlayAudio && <div className="edufeed-att-audio-overlay">{audioAtts.map(renderAudio)}</div>}
      {mediaAtts.map(renderMedia)}
      {!overlayAudio && audioAtts.map(renderAudio)}
    </div>
  )
}

// ── Compact "done" chip — Community only (its preview card still gates
// on a CTA before joining, so a done state has a slot to replace it). ──
const DoneChip = ({ points }) => {
  const [toastOn, setToastOn] = useState(false)
  const timeoutRef = useRef(null)

  const reveal = (e) => {
    e.stopPropagation()
    setToastOn(true)
    clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setToastOn(false), 2200)
  }

  useEffect(() => () => clearTimeout(timeoutRef.current), [])

  return (
    <div className="ef-done-chip-wrap">
      <button type="button" className="ef-done-chip" onClick={reveal}>✅ Done</button>
      {toastOn && <div className="ef-done-toast">+{points} pts earned</div>}
    </div>
  )
}

// ── Manual-quiz completion banner — informational only, never gates replay ──
const CompletionBanner = ({ completion }) => {
  if (!completion) return null
  return <div className="mq-completed-banner">✅ Completed — you scored {completion.points} pts</div>
}

// ── Renders one non-background attachment for manual quizzes. The first
// image on the post becomes the card's background (see QuizBody), so this
// only ever handles leftover video / audio / youtube / extra images. ──
const renderMqAttachment = (att, idx) => {
  if (att.type === 'youtube')
    return (
      <iframe key={idx} src={att.embedUrl} width="100%" height="160" frameBorder="0"
        allowFullScreen className="mq-extra-media-item" title={att.name} />
    )
  if (att.type?.startsWith('video/'))
    return <video key={idx} src={att.url} controls className="mq-extra-media-item" />
  if (att.type?.startsWith('audio/'))
    return (
      <div key={idx} className="edufeed-att-audio">
        <span className="edufeed-att-audio-icon">🎵</span>
        <audio src={att.url} controls className="edufeed-att-audio-player" />
      </div>
    )
  if (att.type?.startsWith('image/'))
    return <img key={idx} src={att.url} alt={att.name} className="mq-extra-media-item" />
  return <a key={idx} href={att.url} target="_blank" rel="noopener noreferrer" className="edufeed-att-file">📎 {att.name}</a>
}

// Compact SVG countdown ring — sits beside the existing text timer chip,
// doesn't replace it.
const TimerRing = ({ timeLeft, total, urgent }) => {
  const pct = Math.max(0, Math.min(1, timeLeft / total))
  const r = 15.5
  const c = 2 * Math.PI * r
  const offset = c * (1 - pct)
  return (
    <svg className={`mq-timer-ring ${urgent ? 'urgent' : ''}`} viewBox="0 0 36 36" width="40" height="40">
      <g transform="rotate(-90 18 18)">
        <circle className="mq-timer-ring-track" cx="18" cy="18" r={r} />
        <circle className="mq-timer-ring-fill" cx="18" cy="18" r={r} strokeDasharray={c} strokeDashoffset={offset} />
      </g>
      <text x="18" y="19" className="mq-timer-ring-text" textAnchor="middle" dominantBaseline="middle">{timeLeft}</text>
    </svg>
  )
}

const CommunityPreview = ({ community, isRace, completion, onPrimaryClick }) => {
  const ended = community.status !== 'live'
  const statsLine = [
    `⏱️ ${community.time_limit_minutes ?? '∞'}m`,
    (community.difficulty || 'medium').replace(/^\w/, c => c.toUpperCase()),
  ].join('   ·   ')

  return (
    <div className="ef-card-preview ef-community-preview">
      <div className="ef-card-preview-scroll">
        <div className="ef-card-preview-teaser">{community.title}</div>
      </div>

      <div className="ef-card-preview-footer">
        <div className="ef-card-preview-footer-info">
          <div className="ef-card-preview-top-row">
            {isRace && <span className="community-race-badge">🏁 LIVE RACE</span>}
            <span className="community-subject-tag">{community.subject}</span>
            <span className={`community-status ${community.status}`}>
              {community.status === 'live' ? '🟢 Live' : '🔴 Ended'}
            </span>
          </div>
          <div className="ef-card-preview-stats-line">{statsLine}</div>
        </div>

<div className="ef-card-preview-cta-slot"></div>
        {completion ? (
          <DoneChip points={completion.points} />
        ) : (
          <button
            className="ef-card-preview-cta"
            onClick={(e) => { e.stopPropagation(); onPrimaryClick(e); }}
            disabled={ended}
            type="button"
          >
            {ended ? '🔒 Room Ended' : isRace ? '🏁 Join Live Race' : '🎮 Join Quiz'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── HOC: card chrome (header/footer/comments/share/delete) around any
// post body. Manual quizzes (Studio/Subject/Flashcard) render fully inline
// via ownsAttachments+fetchCompletion; Community keeps its own internal
// join/race modal flow, untouched. ──
const withCardActions = (BodyComponent, { ownsAttachments = false, fetchCompletion = false } = {}) => {
  return function WrappedCard({
    post: initialPost, onLike, liked, user, isPro,
    locked, onToggleLock, onPostDeleted, onEditPost,
    onCreateClick, onOpenRacePlay, badges, onOpenDashboard,
  }) {
    const [post] = useState(initialPost)
    const [commentsOpen, setCommentsOpen] = useState(false)
    const [hasOpenedComments, setHasOpenedComments] = useState(false)
    const [deleteState, setDeleteState] = useState('idle')
    const [commentCount] = useState(post.comment_count ?? 0)
    const [shared, setShared] = useState(false)
    const [completion, setCompletion] = useState(fetchCompletion ? undefined : null)

    useEffect(() => {
      if (!fetchCompletion) return
      if (!user?.id) { setCompletion(null); return }
      let cancelled = false
      supabase.from('edufeed_quiz_completions')
        .select('points')
        .eq('user_id', user.id)
        .eq('post_id', post.id)
        .maybeSingle()
        .then(({ data }) => { if (!cancelled) setCompletion(data) })
      return () => { cancelled = true }
    }, [post.id, user?.id])

    const handleEdit = () => { if (onEditPost) onEditPost(post) }
    const handleDelete = () => setDeleteState('confirm')
    const handleCancel = () => setDeleteState('idle')

    const handleToggleComments = () => {
      if (commentsOpen) { setCommentsOpen(false); return }
      setHasOpenedComments(true)
      setCommentsOpen(true)
    }

    const handleShare = async () => {
      const isCommunityPost = post.type === 'community' || post.community_data?.is_community
      const shareUrl = `${window.location.origin}/share/quiz/${post.id}`
      const plain = (post.title || post.quiz_data?.question || post.quiz_data?.questions?.[0]?.question || '').trim()
      const teaser = plain.length > 120 ? plain.slice(0, 120).trim() + '…' : plain
      const shareText = `${isCommunityPost ? '🏆' : '🧠'} ${post.title} — Play it on vAIbes →\n\n${teaser}`

      if (navigator.share) {
        try { await navigator.share({ title: post.title, text: shareText, url: shareUrl }); return }
        catch (e) { if (e.name === 'AbortError') return }
      }
      try {
        await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`)
        setShared(true); setTimeout(() => setShared(false), 2000)
      } catch (err) {
        console.error('❌ share failed:', err)
        alert(`Share this link:\n${shareText}\n\n${shareUrl}`)
      }
    }

    const handleConfirmDelete = async () => {
      setDeleteState('deleting')

      if (isCommunity && post.community_id) {
        const { error: roomError } = await supabase
          .from('community_rooms')
          .update({ status: 'ended', show_in_banner: false })
          .eq('id', post.community_id)
        if (roomError) console.error('❌ Failed to end room before delete:', roomError)

        const { error: winnersError } = await supabase
          .from('community_room_winners')
          .delete()
          .eq('room_id', post.community_id)
        if (winnersError) console.error('❌ Failed to purge winners for deleted room:', winnersError)
      }

      const { error: compError } = await supabase
        .from('edufeed_quiz_completions').delete().eq('post_id', post.id)
      if (compError) console.error('❌ Failed to purge completions for deleted post:', compError)

      const { error } = await supabase.from('edufeed_posts').delete().eq('id', post.id)
      if (!error) onPostDeleted(post.id)
      else setDeleteState('idle')
    }

    const isCommunity = post.type === 'community' || post.community_data?.is_community

    return (
      <div className="edufeed-card-inner ef-media-first">
        <CardHeader post={post} locked={locked} onToggleLock={onToggleLock} badges={badges} onOpenDashboard={onOpenDashboard} />

        {!ownsAttachments && (
          <CardAttachments attachments={post.attachments} variant={isCommunity ? 'community' : 'quiz'} />
        )}

        <BodyComponent
          post={post} locked={locked} onToggleLock={onToggleLock}
          user={user} isPro={isPro} onOpenRacePlay={onOpenRacePlay}
          completion={completion}
        />

        <CardFooter
          post={post} onLike={onLike} liked={liked} user={user} isPro={isPro}
          onToggleComments={handleToggleComments} commentsOpen={commentsOpen}
          localCommentCount={commentCount}
          onEdit={handleEdit} onDelete={handleDelete}
          deleteState={deleteState} onConfirmDelete={handleConfirmDelete} onCancelDelete={handleCancel}
          onCreateClick={onCreateClick}
          onShare={handleShare} shared={shared}
        />

        {hasOpenedComments && createPortal(
          <div
            className={`modal-overlay edufeed-portal-overlay ${commentsOpen ? '' : 'ef-quiz-play-hidden'}`}
            onClick={() => setCommentsOpen(false)}
          >
            <div className="modal-content ef-comments-modal" onClick={e => e.stopPropagation()}>
              <div className="ef-modal-header">
                <span className="ef-modal-title">💬 Comments</span>
                <button className="ef-modal-close" onClick={() => setCommentsOpen(false)} aria-label="Close">✕</button>
              </div>
              <CommentsSection post={{ ...post, comment_count: commentCount }} user={user} />
            </div>
          </div>,
          document.body
        )}
      </div>
    )
  }
}

const QUESTION_TIME_LIMIT = 20 // seconds — client-side deterrent only, not tamper-proof
const ANAGRAM_TIME_LIMIT = 30 // seconds — letter-tile arranging takes longer than typing

// Fisher-Yates shuffle — used to scramble anagram letter tiles
const shuffleArray = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Builds a fresh scrambled layout for one anagram word/phrase. Spaces get a
// fixed 'SPACE' slot (pre-filled, not part of the shuffle); every other
// character is a letter tile identified by its original index, so duplicate
// letters never collide.
const buildAnagramLayout = (word) => {
  const chars = (word || '').split('')
  const letterPositions = chars.map((c, i) => (c.trim() !== '' ? i : null)).filter(i => i !== null)
  let pool = shuffleArray(letterPositions)
  let tries = 0
  while (tries < 5 && pool.length > 1 && pool.every((idx, k) => idx === letterPositions[k])) {
    pool = shuffleArray(letterPositions)
    tries++
  }
  const slots = chars.map(c => (c.trim() === '' ? 'SPACE' : null))
  return { chars, pool, slots }
}

// ── Studio Quiz — plays inline, no modal. Questions are sequential-unlock:
// the horizontal tab strip lets you jump back to review anything already
// answered, but the next question stays locked until the current one is. ──
const StudioQuizPlayer = ({ questions, subject, defaultPoints = 5, userId = null, postId = null, postType = 'quiz', onComplete = null, completion = null }) => {
  const [selected, setSelected] = useState(null)
  const [answered, setAnswered] = useState(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [showSummary, setShowSummary] = useState(false)
  const [answers, setAnswers] = useState([])
  const [pointsEarned, setPointsEarned] = useState(0)
  const [showPointsAnimation, setShowPointsAnimation] = useState(false)
  const recordedRef = useRef(false)
  const reviewScrollRef = useRef(null)
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_LIMIT)
  const [showReview, setShowReview] = useState(false)

  const totalQuestions = questions.length
  const currentQuestion = questions[currentQuestionIndex]
  const currentOptions = currentQuestion?.options || []
  const currentCorrect = currentQuestion?.correct_index ?? 0
  const currentPoints = currentQuestion?.points ?? defaultPoints
  const letters = ['A', 'B', 'C', 'D']

  useEffect(() => {
    setTimeLeft(QUESTION_TIME_LIMIT)
  }, [currentQuestionIndex])

  useEffect(() => {
    if (answered || showSummary) return
    const id = setInterval(() => setTimeLeft(t => (t > 0 ? t - 1 : 0)), 1000)
    return () => clearInterval(id)
  }, [answered, showSummary, currentQuestionIndex])

  // Ran out of time — reveal as a miss, no points, user taps Next manually
  useEffect(() => {
    if (answered || showSummary || timeLeft > 0) return
    setSelected(null)
    setAnswered(true)
    setAnswers(prev => [...prev, {
      questionIndex: currentQuestionIndex,
      question: currentQuestion.question,
      selected: null,
      correct: currentCorrect,
      isCorrect: false,
      points: 0,
      timedOut: true,
    }])
  }, [timeLeft, answered, showSummary, currentQuestion, currentCorrect, currentQuestionIndex])

  const handleAnswer = (optionIndex) => {
    if (answered) return
    const isCorrect = optionIndex === currentCorrect
    const earnedPoints = isCorrect ? currentPoints : 0
    setSelected(optionIndex)
    setAnswered(true)
    setAnswers(prev => [...prev, {
      questionIndex: currentQuestionIndex,
      question: currentQuestion.question,
      selected: optionIndex,
      correct: currentCorrect,
      isCorrect,
      points: earnedPoints,
    }])
    if (isCorrect) {
      setPointsEarned(prev => prev + earnedPoints)
      setShowPointsAnimation(true)
      setTimeout(() => setShowPointsAnimation(false), 2000)
    }
  }

  // Single nav primitive for both the horizontal question tabs and the
  // summary screen's review strip. i is only reachable if it's an already-
  // answered question or the single next unlocked one — sequential unlock.
  const goToQuestion = (i) => {
    if (i > answers.length) return
    setCurrentQuestionIndex(i)
    if (answers[i]) { setSelected(answers[i].selected); setAnswered(true) }
    else { setSelected(null); setAnswered(false) }
    setShowSummary(false)
  }

  const handleNextQuestion = () => {
    if (currentQuestionIndex < totalQuestions - 1) goToQuestion(currentQuestionIndex + 1)
    else setShowSummary(true)
  }

  const scrollReview = (dir) => {
    reviewScrollRef.current?.scrollBy({ left: dir * 180, behavior: 'smooth' })
  }

  // Fires once per finished attempt. Only the solo-post path passes
  // userId/postId, and only a genuine win (pointsEarned > 0) is worth a row —
  // mirrors the "a win is a first-correct-answer" bar already used for races.
  useEffect(() => {
    if (!showSummary || recordedRef.current) return
    recordedRef.current = true
    if (userId && postId) {
      supabase.from('edufeed_quiz_completions').insert({
        user_id: userId, post_id: postId, post_type: postType, points: pointsEarned,
      }).then(({ error }) => {
        if (error && error.code !== '23505') console.error('❌ Failed to record quiz completion:', error)
      })
    }
    if (onComplete) onComplete(pointsEarned)
  }, [showSummary, userId, postId, postType, pointsEarned, onComplete])

  if (!currentQuestion) return null

  const correctAnswers = answers.filter(a => a.isCorrect).length
  const percentage = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0

  if (showSummary) {
    return (
      <div className="mq-body mq-body--no-image">
        <div className="mq-bg mq-bg-none" aria-hidden="true" />
        <div className="mq-panel edufeed-quiz-body">
          <CompletionBanner completion={completion} />
          <div className="quiz-summary-header">
            <div className="summary-icon">🎉</div>
            <h3>Quiz Complete!</h3>
            <div className="summary-score">
              <div className="score-circle" style={{
                background: `conic-gradient(var(--accent1) ${percentage}%, rgba(255,255,255,0.1) ${percentage}%)`
              }}>
                <div className="score-inner">
                  <div className="score-percentage">{percentage}%</div>
                  <div className="score-fraction">{correctAnswers}/{totalQuestions}</div>
                </div>
              </div>
            </div>
            <div className="summary-stats">
              <div className="stat-item">
                <span className="stat-label">Points Earned</span>
                <span className="stat-value points">+{pointsEarned}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Accuracy</span>
                <span className="stat-value">{percentage}%</span>
              </div>
            </div>
          </div>
          <button type="button" className="mq-review-toggle-btn" onClick={() => setShowReview(v => !v)}>
            {showReview ? '▲ Hide Review' : `▼ Review Answers (${correctAnswers}/${totalQuestions})`}
          </button>
          {showReview && (
            <div className="quiz-review-section">
              <div className="quiz-review-header-row">
                <h4>Review Answers</h4>
                {answers.length > 2 && (
                  <div className="review-scroll-nav">
                    <button type="button" className="review-scroll-btn" onClick={() => scrollReview(-1)} aria-label="Scroll left">‹</button>
                    <button type="button" className="review-scroll-btn" onClick={() => scrollReview(1)} aria-label="Scroll right">›</button>
                  </div>
                )}
              </div>
              <div className="review-questions-scroll" ref={reviewScrollRef}>
                {answers.map((answer, idx) => (
                  <button
                    key={idx}
                    className={`review-question-card ${answer.isCorrect ? 'correct' : 'wrong'}`}
                    onClick={() => goToQuestion(idx)}
                  >
                    <div className="review-q-number">Q{idx + 1}</div>
                    <div className="review-q-text">{answer.question}</div>
                    <div className="review-q-result">
                      {answer.isCorrect ? '✅' : answer.timedOut ? '⌛' : '❌'} {answer.isCorrect ? 'Correct' : answer.timedOut ? 'Timed Out' : 'Wrong'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="mq-retake-sticky">
            <button
              className="edufeed-quiz-unlock-btn"
              onClick={() => {
                setShowSummary(false)
                setCurrentQuestionIndex(0)
                setSelected(null)
                setAnswered(false)
                setAnswers([])
                setPointsEarned(0)
                setTimeLeft(QUESTION_TIME_LIMIT)
                recordedRef.current = false
                setShowReview(false)
              }}
              style={{ width: '100%' }}
            >
              🔄 Retake Quiz
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`mq-body ${currentQuestion.image_url ? '' : 'mq-body--no-image'}`}>
      {currentQuestion.image_url ? (
        <>
          <div className="mq-bg" style={{ backgroundImage: `url(${currentQuestion.image_url})` }} aria-hidden="true" />
          <img src={currentQuestion.image_url} alt="" className="mq-fg-img" />
        </>
      ) : (
        <div className="mq-bg mq-bg-none" aria-hidden="true" />
      )}
      <div className="mq-scrim" aria-hidden="true" />
      <div className="mq-panel edufeed-quiz-body">
        <CompletionBanner completion={completion} />

        {totalQuestions > 1 && (
          <div className="mq-qnav-scroll">
            {questions.map((_, i) => {
              const ans = answers[i]
              const locked = i > answers.length
              let cls = 'mq-qnav-pill'
              if (i === currentQuestionIndex) cls += ' is-current'
              if (ans) cls += ans.isCorrect ? ' is-correct' : ' is-wrong'
              if (locked) cls += ' is-locked'
              return (
                <button key={i} type="button" className={cls} disabled={locked} onClick={() => goToQuestion(i)}>
                  {i + 1}
                </button>
              )
            })}
          </div>
        )}

        {subject && <span className="edufeed-subject-tag">{subject}</span>}
        {showPointsAnimation && (
          <div className="points-gain-animation">+{currentPoints} pts</div>
        )}
        <div className="quiz-progress-bar">
          <div className="quiz-progress-fill"
            style={{ width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` }} />
          <div className="quiz-progress-text">
            Question {currentQuestionIndex + 1} of {totalQuestions}
          </div>
        </div>
        {!answered && (
          <div className={`ef-timer-chip ${timeLeft <= 5 ? 'urgent' : ''}`}>⏱ {timeLeft}s left</div>
        )}
        <div className="edufeed-quiz-question">{currentQuestion.question}</div>
        <div className="edufeed-quiz-options">
          {currentOptions.map((opt, i) => {
            let cls = 'edufeed-quiz-option'
            if (answered) {
              if (i === currentCorrect) cls += ' reveal-correct'
              if (i === selected && i !== currentCorrect) cls += ' selected-wrong'
              if (i === selected && i === currentCorrect) cls += ' selected-correct'
            }
            return (
              <button key={i} className={cls}
                onClick={() => handleAnswer(i)}
                disabled={answered}>
                <span className="edufeed-option-letter">{letters[i]}</span>
                {opt}
              </button>
            )
          })}
        </div>
        {answered && (
          <>
            <div className={`edufeed-quiz-result ${selected === currentCorrect ? 'correct' : 'wrong'}`}>
              {selected === currentCorrect
                ? '✅ Correct!'
                : selected === null
                  ? `⌛ Time's up — Answer: ${currentOptions[currentCorrect]}`
                  : `❌ Answer: ${currentOptions[currentCorrect]}`}
            </div>
            <div className="mq-sticky-cta">
              {currentQuestionIndex < totalQuestions - 1 ? (
                <button className="edufeed-quiz-unlock-btn next-btn" onClick={handleNextQuestion}>
                  Next Question →
                </button>
              ) : (
                <button className="edufeed-quiz-unlock-btn see-results-btn" onClick={handleNextQuestion}>
                  🎉 See Results
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── QuizBody — Studio Quiz, Subject Quiz, Flashcard. All three play inline,
// no modal. An optional first image doubles as the card's background for
// Studio (per-question) and Subject Quiz; Flashcard keeps the image as its
// literal card face and flips it on check. ──
const QuizBody = ({ post, user, completion }) => {
  // Subject Quiz
  const [sqAnswer, setSqAnswer] = useState('')
  const [sqAnswered, setSqAnswered] = useState(false)
  const [sqCorrect, setSqCorrect] = useState(null)
  const [sqTimeLeft, setSqTimeLeft] = useState(QUESTION_TIME_LIMIT)
  const [sqTimedOut, setSqTimedOut] = useState(false)

  // Flashcard
  const [fcGuess, setFcGuess] = useState('')
  const [fcFlipped, setFcFlipped] = useState(false)
  const [fcCorrect, setFcCorrect] = useState(null)
  const [fcTimeLeft, setFcTimeLeft] = useState(QUESTION_TIME_LIMIT)
  const [fcTimedOut, setFcTimedOut] = useState(false)

  useEffect(() => {
    if (sqAnswered || sqTimedOut) return
    if (sqTimeLeft <= 0) { setSqTimedOut(true); return }
    const id = setInterval(() => setSqTimeLeft(t => (t > 0 ? t - 1 : 0)), 1000)
    return () => clearInterval(id)
  }, [sqAnswered, sqTimedOut, sqTimeLeft])

  useEffect(() => {
    if (fcFlipped || fcTimedOut) return
    if (fcTimeLeft <= 0) { setFcTimedOut(true); return }
    const id = setInterval(() => setFcTimeLeft(t => (t > 0 ? t - 1 : 0)), 1000)
    return () => clearInterval(id)
  }, [fcFlipped, fcTimedOut, fcTimeLeft])

  // Anagram
  const [anLayout, setAnLayout] = useState(() => buildAnagramLayout(post.quiz_data?.word || post.title || ''))
  const [anAnswered, setAnAnswered] = useState(false)
  const [anCorrect, setAnCorrect] = useState(null)
  const [anTimeLeft, setAnTimeLeft] = useState(ANAGRAM_TIME_LIMIT)
  const [anTimedOut, setAnTimedOut] = useState(false)

  useEffect(() => {
    if (anAnswered || anTimedOut) return
    if (anTimeLeft <= 0) { setAnTimedOut(true); return }
    const id = setInterval(() => setAnTimeLeft(t => (t > 0 ? t - 1 : 0)), 1000)
    return () => clearInterval(id)
  }, [anAnswered, anTimedOut, anTimeLeft])

  const quiz = post.quiz_data || {}
  const SUBJECT_QUIZ_POINTS = 5
  const FLASHCARD_POINTS = 5
  const ANAGRAM_POINTS = 5

  const recordCompletion = (points, postType) => {
    if (!user?.id) return
    supabase.from('edufeed_quiz_completions').insert({
      user_id: user.id,
      post_id: post.id,
      post_type: postType,
      points,
    }).then(({ error }) => {
      if (error && error.code !== '23505') console.error('❌ Failed to record quiz completion:', error)
    })
  }

  const firstImage = post.attachments?.find(a => a.type?.startsWith('image/'))
  const extraAttachments = post.attachments?.filter(a => a !== firstImage) || []

  // ── SUBJECT QUIZ — type an answer, tap Check, immediate auto-graded
  // green/red. Optional image renders as a background behind the panel. ──
  if (post.type === 'subject_quiz' || quiz.mode === 'subject_qa') {
    // A video-only attachment (no image) becomes the primary visual instead
    // of falling into the small extra-media thumbnail row.
    const primaryVideo = !firstImage ? post.attachments?.find(a => a.type?.startsWith('video/')) : null
    const subjectExtras = primaryVideo ? extraAttachments.filter(a => a !== primaryVideo) : extraAttachments

    const handleCheck = () => {
      if (!sqAnswer.trim()) return
      const correct = sqAnswer.trim().toLowerCase() === (quiz.answer || '').trim().toLowerCase()
      setSqCorrect(correct)
      setSqAnswered(true)
      recordCompletion(correct && !sqTimedOut ? SUBJECT_QUIZ_POINTS : 0, 'subject_quiz')
    }
    const resetSq = () => {
      setSqAnswer(''); setSqAnswered(false); setSqCorrect(null)
      setSqTimeLeft(QUESTION_TIME_LIMIT); setSqTimedOut(false)
    }

    return (
      <div className={`mq-body ${firstImage ? '' : 'mq-body--no-image'}`}>
        {firstImage ? (
          <>
            <div className="mq-bg" style={{ backgroundImage: `url(${firstImage.url})` }} aria-hidden="true" />
            <img src={firstImage.url} alt="" className="mq-fg-img" />
          </>
        ) : (
          <div className="mq-bg mq-bg-none" aria-hidden="true" />
        )}
        <div className="mq-scrim" aria-hidden="true" />
        <div className="mq-panel mq-panel--subject">
          <CompletionBanner completion={completion} />
          {post.subject && <span className="edufeed-subject-tag">{post.subject}</span>}
          {primaryVideo && (
            <video src={primaryVideo.url} controls className="mq-subject-video" />
          )}
          {subjectExtras.length > 0 && (
            <div className="mq-extra-media">{subjectExtras.map((att, i) => renderMqAttachment(att, i))}</div>
          )}
          <div className="mq-question">{quiz.question || post.title || 'No question provided'}</div>

          {!sqAnswered ? (
            <>
              <div className="mq-timer-row">
                {!sqTimedOut && <TimerRing timeLeft={sqTimeLeft} total={QUESTION_TIME_LIMIT} urgent={sqTimeLeft <= 5} />}
                <div className={`ef-timer-chip ${sqTimedOut || sqTimeLeft <= 5 ? 'urgent' : ''}`}>
                  {sqTimedOut ? "⏱️ Time's up — this one won't earn points, go ahead" : `⏱ ${sqTimeLeft}s to answer for points`}
                </div>
              </div>
              <textarea
                className="mq-answer-input"
                placeholder="Type your answer here…"
                value={sqAnswer}
                onChange={e => setSqAnswer(e.target.value)}
                rows={3}
              />
              <div className="mq-sticky-cta">
                <button className="mq-check-btn" onClick={handleCheck} disabled={!sqAnswer.trim()} style={{ width: '100%' }}>
                  ✓ Check Answer
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mq-your-answer">
                <span className="mq-field-label">Your answer</span>
                <div className="mq-your-answer-text">{sqAnswer}</div>
              </div>
              <div className={`mq-verdict ${sqCorrect ? 'mq-correct' : 'mq-wrong'}`}>
                {sqCorrect
                  ? (sqTimedOut ? '⏱️ Correct — but time ran out, no points this round' : '✅ Correct! +5 points')
                  : '❌ Not quite'}
              </div>
              {!sqCorrect && (
                <div className="mq-correct-answer">
                  <span className="mq-field-label">Correct answer</span>
                  <div className="mq-correct-answer-text">{quiz.answer || 'No answer provided'}</div>
                </div>
              )}
              <div className="mq-sticky-cta">
                <button className="mq-retry-btn" onClick={resetSq} style={{ width: '100%' }}>↺ Try Again</button>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── FLASHCARD — front face is the image (or question text if none), a
  // guess input + Check button sit over it, then the card flips to reveal
  // the answer with a green/red verdict. ──
  if (post.type === 'flashcard' || quiz.mode === 'flashcard') {
    const handleFlip = () => {
      if (fcFlipped || !fcGuess.trim()) return
      const correct = fcGuess.trim().toLowerCase() === (quiz.answer || '').trim().toLowerCase()
      setFcCorrect(correct)
      recordCompletion(correct && !fcTimedOut ? FLASHCARD_POINTS : 0, 'flashcard')
      setFcFlipped(true)
    }
    const resetFc = () => {
      setFcGuess(''); setFcFlipped(false); setFcCorrect(null)
      setFcTimeLeft(QUESTION_TIME_LIMIT); setFcTimedOut(false)
    }

    return (
      <div className="mq-flip-wrap">
        <CompletionBanner completion={completion} />
        {post.subject && <span className="edufeed-subject-tag">{post.subject}</span>}
        <div className={`mq-flip-card ${fcFlipped ? 'is-flipped' : ''}`}>
          <div className="mq-flip-inner">
            <div className="mq-flip-face mq-flip-front">
              {firstImage ? (
                <div className="mq-flip-media">
                  <div className="mq-flip-bg" style={{ backgroundImage: `url(${firstImage.url})` }} aria-hidden="true" />
                  <img src={firstImage.url} alt="" className="mq-flip-image" />
                </div>
              ) : (
                <div className="mq-flip-text-prompt">{quiz.question || post.title}</div>
              )}
              <div className="mq-flip-overlay">
                <div className={`ef-timer-chip ${fcTimedOut || fcTimeLeft <= 5 ? 'urgent' : ''}`}>
                  {fcTimedOut ? "⏱️ Time's up — won't earn points, go ahead" : `⏱ ${fcTimeLeft}s to answer for points`}
                </div>
                <input
                  type="text"
                  className="mq-flip-input"
                  placeholder="Type your answer…"
                  value={fcGuess}
                  onChange={e => setFcGuess(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && fcGuess.trim()) handleFlip() }}
                />
                <button className="mq-flip-check-btn" onClick={handleFlip} disabled={!fcGuess.trim()}>
                  ✓ Check
                </button>
              </div>
            </div>
            <div className="mq-flip-face mq-flip-back">
              <div className={`mq-verdict ${fcCorrect ? 'mq-correct' : 'mq-wrong'}`}>
                {fcCorrect ? (fcTimedOut ? '⏱️ Correct — but over time, no points' : '✅ Correct!') : '❌ Not quite'}
              </div>
              <span className="mq-field-label">Answer</span>
              <div className="mq-flip-answer-text">{quiz.answer}</div>
              <button className="mq-retry-btn" onClick={resetFc}>↺ Flip Back &amp; Retry</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── ANAGRAM — tap scrambled letter tiles into slots to spell the target
  // word or phrase; spaces in multi-word phrases are pre-filled gaps, not
  // tiles. Optional image renders as a background, same treatment as
  // Subject Quiz. ──
  if (post.type === 'anagram' || quiz.mode === 'anagram') {
    const word = quiz.word || post.title || ''
    const { chars, pool, slots } = anLayout
    const isFull = slots.every(s => s !== null)

    const placeTile = (tileIdx) => {
      if (anAnswered) return
      const emptyIdx = slots.findIndex(s => s === null)
      if (emptyIdx === -1) return
      const newSlots = [...slots]
      newSlots[emptyIdx] = tileIdx
      setAnLayout({ chars, slots: newSlots, pool: pool.filter(t => t !== tileIdx) })
    }

    const unplaceSlot = (i) => {
      if (anAnswered) return
      const tileIdx = slots[i]
      if (tileIdx === null || tileIdx === 'SPACE') return
      const newSlots = [...slots]
      newSlots[i] = null
      setAnLayout({ chars, slots: newSlots, pool: [...pool, tileIdx] })
    }

    const shufflePool = () => { if (!anAnswered) setAnLayout(prev => ({ ...prev, pool: shuffleArray(prev.pool) })) }
    const clearAnagram = () => { if (!anAnswered) setAnLayout(buildAnagramLayout(word)) }

    const handleAnCheck = () => {
      if (!isFull || anAnswered) return
      const guess = slots.map((s, i) => (s === 'SPACE' ? ' ' : chars[s])).join('')
      const isCorrect = guess.trim().toLowerCase() === word.trim().toLowerCase()
      setAnCorrect(isCorrect)
      setAnAnswered(true)
      recordCompletion(isCorrect && !anTimedOut ? ANAGRAM_POINTS : 0, 'anagram')
    }

    const resetAnagram = () => {
      setAnLayout(buildAnagramLayout(word))
      setAnAnswered(false); setAnCorrect(null)
      setAnTimeLeft(ANAGRAM_TIME_LIMIT); setAnTimedOut(false)
    }

    return (
      <div className={`mq-body ${firstImage ? '' : 'mq-body--no-image'}`}>
        {firstImage ? (
          <>
            <div className="mq-bg" style={{ backgroundImage: `url(${firstImage.url})` }} aria-hidden="true" />
            <img src={firstImage.url} alt="" className="mq-fg-img" />
          </>
        ) : (
          <div className="mq-bg mq-bg-none" aria-hidden="true" />
        )}
        <div className="mq-scrim" aria-hidden="true" />
        <div className="mq-panel mq-panel--subject">
          <CompletionBanner completion={completion} />
          {post.subject && <span className="edufeed-subject-tag">{post.subject}</span>}
          {extraAttachments.length > 0 && (
            <div className="mq-extra-media">{extraAttachments.map((att, i) => renderMqAttachment(att, i))}</div>
          )}
          {quiz.hint && <div className="mq-question">💡 {quiz.hint}</div>}

          {!anAnswered ? (
            <>
              <div className={`ef-timer-chip ${anTimedOut || anTimeLeft <= 5 ? 'urgent' : ''}`}>
                {anTimedOut ? "⏱️ Time's up — this one won't earn points, go ahead" : `⏱ ${anTimeLeft}s to answer for points`}
              </div>
              <div className="mq-anagram-slots">
                {slots.map((s, i) => s === 'SPACE' ? (
                  <span key={i} className="mq-anagram-slot is-space" aria-hidden="true" />
                ) : (
                  <button key={i} type="button"
                    className={`mq-anagram-slot ${s !== null ? 'is-filled' : 'is-empty'}`}
                    onClick={() => unplaceSlot(i)} disabled={s === null}>
                    {s !== null ? chars[s] : ''}
                  </button>
                ))}
              </div>
              <div className="mq-anagram-pool">
                {pool.map(tileIdx => (
                  <button key={tileIdx} type="button" className="mq-anagram-tile" onClick={() => placeTile(tileIdx)}>
                    {chars[tileIdx]}
                  </button>
                ))}
              </div>
              <div className="mq-anagram-actions">
                <button type="button" className="mq-anagram-action-btn" onClick={shufflePool}>🔀 Shuffle</button>
                <button type="button" className="mq-anagram-action-btn" onClick={clearAnagram}>↺ Clear</button>
              </div>
              <div className="mq-sticky-cta">
                <button className="mq-check-btn" onClick={handleAnCheck} disabled={!isFull} style={{ width: '100%' }}>
                  ✓ Check Answer
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mq-your-answer">
                <span className="mq-field-label">Your answer</span>
                <div className="mq-your-answer-text">{slots.map((s, i) => (s === 'SPACE' ? ' ' : chars[s])).join('')}</div>
              </div>
              <div className={`mq-verdict ${anCorrect ? 'mq-correct' : 'mq-wrong'}`}>
                {anCorrect
                  ? (anTimedOut ? '⏱️ Correct — but time ran out, no points this round' : `✅ Correct! +${ANAGRAM_POINTS} points`)
                  : '❌ Not quite'}
              </div>
              {!anCorrect && (
                <div className="mq-correct-answer">
                  <span className="mq-field-label">Correct answer</span>
                  <div className="mq-correct-answer-text">{word}</div>
                </div>
              )}
              <div className="mq-sticky-cta">
                <button className="mq-retry-btn" onClick={resetAnagram} style={{ width: '100%' }}>↺ Try Again</button>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── STUDIO QUIZ (multi-choice) — delegate to the shared player. Legacy
  // single-question posts (flat quiz.options/correct_index) get normalized
  // into the same one-question-array shape the interactive format uses. ──
  const isInteractiveQuiz = quiz.questions && quiz.questions.length > 0
  const studioQuestions = isInteractiveQuiz
    ? quiz.questions
    : [{
        question: post.title || quiz.question,
        options: quiz.options || [],
        correct_index: quiz.correct_index ?? 0,
      }]

  return (
    <StudioQuizPlayer
      questions={studioQuestions}
      subject={post.subject}
      defaultPoints={5}
      userId={user?.id}
      postId={post.id}
      postType="quiz"
      completion={completion}
    />
  )
}

// ── Community Body (unchanged — live rooms keep their own join/race modal
// flow; these UX changes are scoped to manual quizzes only) ──
const CommunityBody = ({ post, user, isPro, onOpenRacePlay }) => {
  const [loading, setLoading] = useState(true)
  const [community, setCommunity] = useState(null)
  const [hasOpenedQuiz, setHasOpenedQuiz] = useState(false)
  const [questions, setQuestions] = useState([])
  const [showRacePlay, setShowRacePlay] = useState(false)
  const [showQuizModal, setShowQuizModal] = useState(false)
  const [soloCompletion, setSoloCompletion] = useState(undefined)

  const handleSoloComplete = useCallback((points) => {
    setSoloCompletion({ points })
  }, [])

  useEffect(() => {
    const loadCommunity = async () => {
      setLoading(true)
      try {
        const { data } = await supabase
          .from('community_rooms')
          .select('*')
          .eq('id', post.community_id)
          .single()
        if (data) {
          setCommunity(data)
          if (data.generated_questions) setQuestions(data.generated_questions)
        }
      } catch (err) {
        console.error('Error loading community:', err)
      } finally {
        setLoading(false)
      }
    }
    loadCommunity()
  }, [post.community_id])

  useEffect(() => {
    if (!user?.id || !community || community.room_mode === 'race') { setSoloCompletion(null); return }
    let cancelled = false
    supabase.from('edufeed_quiz_completions')
      .select('points').eq('user_id', user.id).eq('post_id', post.id).maybeSingle()
      .then(({ data }) => { if (!cancelled) setSoloCompletion(data) })
    return () => { cancelled = true }
  }, [user?.id, community, post.id])

  const handleJoin = () => {
  if (!user) { alert('Please sign in to join the quiz!'); return }
  if (soloCompletion) return
  setHasOpenedQuiz(true)
  setShowQuizModal(true)
}

  const handleRaceClick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (community.status !== 'live') return
    if (onOpenRacePlay) onOpenRacePlay(community.id)
    else setShowRacePlay(true)
  }

  if (loading) return <div className="edufeed-loading">Loading community...</div>
  if (!community) return <div className="edufeed-empty">Community not found</div>

  const isRace = community.room_mode === 'race'

  return (
    <>
      <CommunityPreview
        community={community}
        isRace={isRace}
        completion={soloCompletion}
        onPrimaryClick={(e) => {
          if (isRace) return handleRaceClick(e)
          hasOpenedQuiz ? setShowQuizModal(true) : handleJoin()
        }}
      />

      {!isRace && hasOpenedQuiz && questions.length > 0 && createPortal(
  <div
    className={`modal-overlay edufeed-portal-overlay ${showQuizModal ? '' : 'ef-quiz-play-hidden'}`}
    onClick={() => setShowQuizModal(false)}
  >
    <div className="modal-content ef-quiz-play-modal" onClick={e => e.stopPropagation()}>
      <button className="ef-quiz-play-close" onClick={() => setShowQuizModal(false)} aria-label="Close">✕</button>
      <StudioQuizPlayer
        questions={questions} 
        subject={community.subject} 
        defaultPoints={10}
        userId={user?.id} 
        postId={post.id} 
        postType="community_solo"
        onComplete={handleSoloComplete}
      />
    </div>
  </div>,
  document.body
)}

      {showRacePlay && createPortal(
        <div className="modal-overlay edufeed-portal-overlay" onClick={() => setShowRacePlay(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <CommunityRoomPlay roomId={community.id} onClose={() => setShowRacePlay(false)} />
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

const QuizCard = withCardActions(QuizBody, { ownsAttachments: true, fetchCompletion: true })
const CommunityCard = withCardActions(CommunityBody, { ownsAttachments: false, fetchCompletion: false })


// ── Main EduFeed Component ──
const Edufeed = ({ userTier, onEditPost, onOpenRacePlay }) => {
  const { user } = useAuth()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeType, setActiveType] = useState('all')
  const [likedPosts, setLikedPosts] = useState(new Set())
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [lockedPostId, setLockedPostId] = useState(null)
  const [showProModal, setShowProModal] = useState(false)
  const [arenaRoomId, setArenaRoomId] = useState(null);
  const [authorBadgesMap, setAuthorBadgesMap] = useState({})       // ← add
  const [showDashboardModal, setShowDashboardModal] = useState(false) // ← add
  const [newPostsAvailable, setNewPostsAvailable] = useState(0)
  const feedRef = useRef(null)
  const isPro = userTier === 'pro'

  const fetchPosts = useCallback(async () => {
    if (activeType === 'leaderboard') { setLoading(false); return }
    setLoading(true)
    setNewPostsAvailable(0)
    let query = supabase
      .from('edufeed_posts')
      .select('*, profiles(id, display_name, username, avatar_url)')
      .eq('is_published', true)
      .eq('is_flagged', false)
      .order('created_at', { ascending: false })
      .limit(30)
    
    if (activeType !== 'all') {
      if (activeType === 'quiz') {
        query = query.or('type.eq.quiz,type.eq.subject_quiz,type.eq.flashcard,type.eq.anagram')
      } else if (activeType === 'community') {
        query = query.eq('type', 'community')
      } else {
        query = query.eq('type', activeType)
      }
    }
    
    const { data } = await query
    if (data) {
      setPosts(data)
      const authorIds = [...new Set(data.map(p => p.profiles?.id).filter(Boolean))]
      attachBadges(authorIds.map(id => ({ userId: id }))).then(rows => {
        setAuthorBadgesMap(Object.fromEntries(rows.map(r => [r.userId, r.badges])))
      })
    }
    setCurrentCardIndex(0)
    setLoading(false)
  }, [activeType])

  const fetchLikes = useCallback(async () => {
    if (!user?.id) return
    const { data } = await supabase.from('edufeed_likes').select('post_id').eq('user_id', user.id)
    if (data) setLikedPosts(new Set(data.map(l => l.post_id)))
  }, [user?.id])

  const handleLike = async (postId, isLiked) => {
    if (!user) return
    const post = posts.find(p => p.id === postId)
    if (isLiked) {
      await supabase.from('edufeed_likes').delete().eq('post_id', postId).eq('user_id', user.id)
      await supabase.from('edufeed_posts').update({ likes_count: Math.max(0, (post?.likes_count || 1) - 1) }).eq('id', postId)
      setLikedPosts(prev => { const s = new Set(prev); s.delete(postId); return s })
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes_count: Math.max(0, (p.likes_count || 1) - 1) } : p))
    } else {
      await supabase.from('edufeed_likes').insert({ post_id: postId, user_id: user.id })
      await supabase.from('edufeed_posts').update({ likes_count: (post?.likes_count || 0) + 1 }).eq('id', postId)
      setLikedPosts(prev => new Set([...prev, postId]))
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes_count: (p.likes_count || 0) + 1 } : p))
    }
  }

  const handleCreateClick = () => {
  if (onEditPost) onEditPost(null)
}

  const handlePostDeleted = (postId) => setPosts(prev => prev.filter(p => p.id !== postId))
  const toggleLock = (postId) => setLockedPostId(prev => prev === postId ? null : postId)

  const handleRefreshNewPosts = () => {
    fetchPosts()
    feedRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const renderCard = (post) => {
  const liked = likedPosts.has(post.id)
  const locked = lockedPostId === post.id
  const isCommunityPost = post.type === 'community' || post.community_data?.is_community

  const shared = {
    key: post.id, post, onLike: handleLike, liked, user,
    badges: authorBadgesMap[post.profiles?.id] || [],
    onOpenDashboard: () => setShowDashboardModal(true),
    isPro,
    locked, onToggleLock: () => toggleLock(post.id),
    onPostDeleted: handlePostDeleted,
    onEditPost,
    onCreateClick: () => handleCreateClick(),
    onOpenRacePlay: (id) => {
      if (onOpenRacePlay) onOpenRacePlay(id)
      else setArenaRoomId(id)
    },
  }

  if (isCommunityPost) {
    return <CommunityCard {...shared} />
  }
  return <QuizCard {...shared} />
}

  const handleFeedScroll = useCallback(() => {
    const el = feedRef.current
    if (!el) return
    const idx = Math.round(el.scrollTop / el.clientHeight)
    setCurrentCardIndex(prev => prev !== idx ? idx : prev)
  }, [])

  useEffect(() => {
    const container = feedRef.current
    if (!container || lockedPostId == null) return
    const handleWheel = (e) => { e.preventDefault(); e.stopPropagation() }
    const handleTouchMove = (e) => { e.preventDefault(); e.stopPropagation() }
    container.addEventListener('wheel', handleWheel, { passive: false })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    return () => {
      container.removeEventListener('wheel', handleWheel)
      container.removeEventListener('touchmove', handleTouchMove)
    }
  }, [lockedPostId])

  useEffect(() => { fetchPosts() }, [fetchPosts])
  useEffect(() => { fetchLikes() }, [fetchLikes])
  useEffect(() => { setLockedPostId(null) }, [activeType])

  // Push-based "new post" indicator — never mutates `posts` directly, since
  // splicing into a scroll-snap feed mid-view would shift what's under the
  // user's finger. Requires edufeed_posts added to the Supabase Realtime
  // publication (Database → Replication) or this silently never fires.
  useEffect(() => {
    const channel = supabase
      .channel('edufeed-new-posts')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'edufeed_posts', filter: 'is_published=eq.true' },
        () => setNewPostsAvailable(prev => prev + 1))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const progressPct = posts.length > 1 ? (currentCardIndex / (posts.length - 1)) * 100 : 0

  return (
    <div className="edufeed-wrapper">
      {showProModal && (
        <ProUpgradeModal
          onClose={() => setShowProModal(false)}
          onUpgrade={() => {
            setShowProModal(false)
            if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('open-billing'))
          }}
        />
      )}

      {/* ── Quiz Arena modal ── */}
      {arenaRoomId && (
        <QuizArenaModal
          roomId={arenaRoomId}
          onClose={() => setArenaRoomId(null)}
        />
      )}

      {showDashboardModal && (
        <PointsDashboard onClose={() => setShowDashboardModal(false)} />
      )}

      <div className="edufeed-live-header">
        <PlayerSpotlight />
        <LiveChallengeBanner onJoinRoom={(id) => setArenaRoomId(id)} />
      </div>

      <div className="edufeed-type-filter-bar">
        <select
          className="edufeed-type-select"
          value={activeType}
          onChange={e => setActiveType(e.target.value)}
        >
          {POST_TYPES.map(t => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>
      </div>

      <div className="edufeed-feed">
        {activeType === 'leaderboard' ? (
          <PointsDashboard embedded />
        ) : loading ? (
          <div className="edufeed-loading">
            {[1, 2, 3].map(i => <div key={i} className="edufeed-skeleton" />)}
          </div>
        ) : posts.length === 0 ? (
          <div className="edufeed-empty">
            <span className="edufeed-empty-icon">📭</span>
            <h4>No posts yet</h4>
            <p>Create a quiz or start a community!</p>
          </div>
) : (
          <>
            {newPostsAvailable > 0 && (
              <button type="button" className="ef-new-posts-banner" onClick={handleRefreshNewPosts}>
                ✨ {newPostsAvailable} new {newPostsAvailable === 1 ? 'post' : 'posts'} — Tap to refresh
              </button>
            )}
            {posts.length > 1 && (
              <div className="edufeed-progress-track">
                <div className="edufeed-progress-fill" style={{ height: `${progressPct}%` }} />
              </div>
            )}
            <div className="edufeed-snap-scroll" ref={feedRef} onScroll={handleFeedScroll}>
              {posts.map(post => (
                <div key={post.id} className="edufeed-snap-slide" data-post-id={post.id}>
                  <div className="edufeed-card">
                    {renderCard(post)}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default Edufeed