import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import CommunityRoomPlay from './CommunityRoomPlay';
import QuizArenaModal from './QuizArenaModal';
import PlayerSpotlight from './PlayerSpotlight';
import LiveChallengeBanner from './LiveChallengeBanner';
import PointsDashboard from './PointsDashboard';
import BadgeRow from './BadgeRow';
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
// ── Card Header ──
const CardHeader = ({ post, locked, onToggleLock, badges, onOpenDashboard }) => {
  const isCommunity = post.type === 'community' || post.community_data?.is_community
  
  let displayLabel = '🧠 Quiz'
  let displayClass = 'type-quiz'
  
  if (isCommunity) {
    displayLabel = '🏆 Community'
    displayClass = 'type-community'
  } else if (post.type === 'subject_quiz' || post.quiz_data?.mode === 'subject_qa') {
    displayLabel = '📚 Subject Quiz'
    displayClass = 'type-subject-quiz'
  } else if (post.type === 'flashcard' || post.quiz_data?.mode === 'flashcard') {
    displayLabel = '🃏 Flashcard'
    displayClass = 'type-flashcard'
  }
  
  return (
    <div className="edufeed-card-header">
      {post.profiles?.avatar_url
        ? <img src={post.profiles.avatar_url} alt="" className="edufeed-avatar" />
        : <div className="edufeed-avatar-placeholder">
            {post.profiles?.display_name?.[0]?.toUpperCase() || '?'}
          </div>}
      <div className="edufeed-user-info">
        <div className="edufeed-meta" style={{ marginTop: 0, gap: '0.5rem', flexWrap: 'wrap' }}>
          <span className={`edufeed-type-badge ${displayClass}`}>
            {displayLabel}
          </span>
          <span>{new Date(post.created_at).toLocaleDateString()}</span>
          {post.is_pro_only && <span className="edufeed-pro-badge">PRO</span>}
          {badges?.length > 0 && <BadgeRow badges={badges} onClick={onOpenDashboard} />}
        </div>
      </div>
      <button
        className={`edufeed-lock-btn ${locked ? 'locked' : ''}`}
        onClick={onToggleLock}
        title={locked ? 'Unlock scroll' : 'Lock scroll'}
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

// ── Card Attachments ──
const CardAttachments = ({ attachments, variant = 'quiz' }) => {
  if (!attachments?.length) return null

  return (
    <div className={`edufeed-attachments edufeed-attachments-top is-${variant}`}>
      {attachments.map((att, idx) => {
        if (att.type === 'youtube')
          return (
            <div key={idx} className="edufeed-att-frame">
              <iframe src={att.embedUrl} width="100%" height="200" frameBorder="0" allowFullScreen className="edufeed-att-media" title={att.name} />
            </div>
          )
        if (att.type?.startsWith('video/'))
          return (
            <div key={idx} className="edufeed-att-frame">
              <video src={att.url} controls className="edufeed-att-media" />
            </div>
          )
        if (att.type?.startsWith('image/'))
          return (
            <div key={idx} className="edufeed-att-frame">
              <div className="edufeed-att-frame-bg" style={{ backgroundImage: `url(${att.url})` }} aria-hidden="true" />
              <img src={att.url} alt={att.name} className="edufeed-att-media" />
            </div>
          )
        return <a key={idx} href={att.url} target="_blank" rel="noopener noreferrer" className="edufeed-att-file">📎 {att.name}</a>
      })}
    </div>
  )
}

const CardPreview = ({ post, onPlay, completion }) => {
  const quiz = post.quiz_data || {}
  const isSubjectQuiz = post.type === 'subject_quiz' || quiz.mode === 'subject_qa'
  const isFlashcard = post.type === 'flashcard' || quiz.mode === 'flashcard'
  const isInteractiveQuiz = quiz.questions && quiz.questions.length > 0

  let icon = '🧠', typeLabel = 'Quiz'
  let meta = isInteractiveQuiz ? `${quiz.questions.length} question${quiz.questions.length > 1 ? 's' : ''}` : '1 question'
  let teaser = post.title || quiz.question || 'Tap play to test your knowledge.'
  let ctaLabel = '▶ Start Quiz'

  if (isSubjectQuiz) {
    icon = '📚'; typeLabel = 'Subject Quiz'
    teaser = quiz.question || post.title || 'A question is waiting for your answer.'
    meta = 'Free response'
    ctaLabel = '✍️ Answer This'
  } else if (isFlashcard) {
    icon = '🃏'; typeLabel = 'Flashcard'
    teaser = quiz.question || post.title || 'Guess the answer on the flashcard.'
    meta = 'Flip to check'
    ctaLabel = '👀 Flip & Guess'
  }

  const previewImage = isFlashcard
    ? post.attachments?.find(a => a.type?.startsWith('image/'))
    : null

  const creatorName = post.profiles?.display_name || post.profiles?.username || 'Student'

  return (
    <div className="ef-card-preview">
      <div className="ef-card-preview-scroll">
        {previewImage && (
          <div className="ef-card-preview-thumb">
            <div className="ef-card-preview-thumb-bg" style={{ backgroundImage: `url(${previewImage.url})` }} aria-hidden="true" />
            <img src={previewImage.url} alt="" />
          </div>
        )}
        
        {/* ── NEW: Title and Creator placed here instead of the top header ── */}
        <div className="ef-card-preview-title-row">
          <h3 className="ef-card-preview-title">{post.title || 'Untitled Quiz'}</h3>
          <span className="ef-card-preview-creator">by {creatorName}</span>
        </div>

        {post.subject && <span className="edufeed-subject-tag">{post.subject}</span>}
        <div className="ef-card-preview-teaser">{teaser}</div>
        <div className="ef-card-preview-meta">
          <span className="ef-card-preview-badge">{icon} {typeLabel}</span>
          <span className="ef-card-preview-count">{meta}</span>
        </div>
      </div>
      <div className="ef-card-preview-footer">
        {completion ? (
          <div className="ef-card-preview-done-badge">✅ Already taken — {completion.points} pts earned</div>
        ) : (
          <button
            className="ef-card-preview-cta"
            onClick={(e) => {
              e.stopPropagation(); // Prevent snap-scroll from hijacking the mobile tap
              onPlay();
            }}
            type="button"
          >
            {ctaLabel}
          </button>
        )}
      </div>
    </div>
  )
}

const CommunityPreview = ({ community, isRace, completion, onPrimaryClick }) => {
  const ended = community.status !== 'live'
  return (
    <div className="ef-card-preview ef-community-preview">
      <div className="ef-card-preview-scroll">
        <div className="ef-card-preview-top-row">
          {isRace && <span className="community-race-badge">🏁 LIVE RACE</span>}
          <span className="community-subject-tag">{community.subject}</span>
          <span className={`community-status ${community.status}`}>
            {community.status === 'live' ? '🟢 Live' : '🔴 Ended'}
          </span>
        </div>
        <div className="ef-card-preview-teaser">{community.title}</div>
        <div className="ef-card-preview-meta">
          <span className="ef-card-preview-badge">👥 {community.max_players || 15}</span>
          <span className="ef-card-preview-badge">⏱️ {community.time_limit_minutes ?? '∞'}m</span>
          <span className="ef-card-preview-badge capitalize">📊 {community.difficulty || 'medium'}</span>
        </div>
      </div>
      <div className="ef-card-preview-footer">
        {completion ? (
          <div className="ef-card-preview-done-badge">✅ Already taken — {completion.points} pts earned</div>
        ) : (
          <button
  className="ef-card-preview-cta"
  onClick={(e) => {
    e.stopPropagation(); // Prevent snap-scroll from hijacking the mobile tap
    onPrimaryClick(e);
  }}
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

// ── HOC: Media-First Layout ──
const withCardActions = (BodyComponent, { selfContained = false } = {}) => {
  return function WrappedCard({
    post: initialPost, onLike, liked, user, isPro,
    locked, onToggleLock, onPostDeleted, onEditPost,
    onCreateClick, onOpenRacePlay, badges, onOpenDashboard,
  }) {
    const [post] = useState(initialPost)
    const [commentsOpen, setCommentsOpen] = useState(false)
    const [deleteState, setDeleteState] = useState('idle')
    const [commentCount] = useState(post.comment_count ?? 0)
    const [showPlayModal, setShowPlayModal] = useState(false)
    const [hasOpenedQuiz, setHasOpenedQuiz] = useState(false)
    const [shared, setShared] = useState(false)
    // undefined = checking, null = never taken, {points} = already completed.
    // Community rooms (selfContained) have their own separate scoring path.
    const [completion, setCompletion] = useState(selfContained ? null : undefined)

    useEffect(() => {
      if (selfContained || !user?.id) { setCompletion(null); return }
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

    const handleShare = async () => {
  const isCommunityPost = post.type === 'community' || post.community_data?.is_community
  const shareUrl = `${window.location.origin}/share/quiz/${post.id}`
  const plain = (post.title || post.quiz_data?.question || post.quiz_data?.questions?.[0]?.question || '').trim()
  const teaser = plain.length > 120 ? plain.slice(0, 120).trim() + '…' : plain
  const shareText = `${isCommunityPost ? '🏆' : '🧠'} ${post.title} — Play it on vAIbes →\n\n${teaser}`
  // rest unchanged

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

  // Community posts are a thin wrapper around a community_rooms row.
  // Deleting just the post left the room live — the banner had no idea it was gone.
  if (isCommunity && post.community_id) {
    const { error: roomError } = await supabase
      .from('community_rooms')
      .update({ status: 'ended', show_in_banner: false })
      .eq('id', post.community_id)
    if (roomError) console.error('❌ Failed to end room before delete:', roomError)

    // Rooms are only ever soft-ended (status flip), never row-deleted, so a
    // DB-level ON DELETE CASCADE on community_room_winners would never fire.
    // Purge its wins here instead — otherwise a deleted quiz keeps padding
    // the Player Spotlight leaderboard forever.
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

    const openQuiz = () => { if (completion) return; setHasOpenedQuiz(true); setShowPlayModal(true) }

    const shouldShowAttachments = post.type !== 'flashcard'
    const isCommunity = post.type === 'community' || post.community_data?.is_community

    return (
  <div className="edufeed-card-inner">
    <CardHeader post={post} locked={locked} onToggleLock={onToggleLock} badges={badges} onOpenDashboard={onOpenDashboard} />

        {shouldShowAttachments && (
          <CardAttachments attachments={post.attachments} variant={isCommunity ? 'community' : 'quiz'} />
        )}

        {selfContained ? (
          <BodyComponent
            post={post} locked={locked} onToggleLock={onToggleLock}
            user={user} isPro={isPro} onOpenRacePlay={onOpenRacePlay}
          />
        ) : (
          <CardPreview post={post} onPlay={openQuiz} completion={completion} />
        )}

        <CardFooter
          post={post} onLike={onLike} liked={liked} user={user} isPro={isPro}
          onToggleComments={() => setCommentsOpen(o => !o)} commentsOpen={commentsOpen}
          localCommentCount={commentCount}
          onEdit={handleEdit} onDelete={handleDelete}
          deleteState={deleteState} onConfirmDelete={handleConfirmDelete} onCancelDelete={handleCancel}
          onCreateClick={onCreateClick}
          onShare={handleShare} shared={shared}
        />

        {commentsOpen && (
          <CommentsSection post={{ ...post, comment_count: commentCount }} user={user} />
        )}

        {!selfContained && hasOpenedQuiz && createPortal(
          <div
            className={`modal-overlay edufeed-portal-overlay ${showPlayModal ? '' : 'ef-quiz-play-hidden'}`}
            onClick={() => setShowPlayModal(false)}
          >
            <div className="modal-content ef-quiz-play-modal" onClick={e => e.stopPropagation()}>
              <button className="ef-quiz-play-close" onClick={() => setShowPlayModal(false)} aria-label="Close">✕</button>
              <BodyComponent
                post={post} locked={locked} onToggleLock={onToggleLock}
                user={user} isPro={isPro} onOpenRacePlay={onOpenRacePlay}
              />
            </div>
          </div>,
          document.body
        )}
      </div>
    )
  }
}

const QUESTION_TIME_LIMIT = 20 // seconds — client-side deterrent only, not tamper-proof

const StudioQuizPlayer = ({ questions, subject, defaultPoints = 5, userId = null, postId = null, postType = 'quiz', onComplete = null }) => {
  const [selected, setSelected] = useState(null)
  const [answered, setAnswered] = useState(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [showSummary, setShowSummary] = useState(false)
  const [answers, setAnswers] = useState([])
  const [pointsEarned, setPointsEarned] = useState(0)
  const [showPointsAnimation, setShowPointsAnimation] = useState(false)
  const recordedRef = useRef(false)
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_LIMIT)

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

  const handleNextQuestion = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(prev => prev + 1)
      setSelected(null)
      setAnswered(false)
    } else {
      setShowSummary(true)
    }
  }

  const handleReviewQuestion = (index) => {
    setCurrentQuestionIndex(index)
    setSelected(answers[index]?.selected ?? null)
    setAnswered(true)
    setShowSummary(false)
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
      <div className="edufeed-quiz-body">
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
        <div className="quiz-review-section">
          <h4>Review Answers</h4>
          <div className="review-questions-scroll">
            {answers.map((answer, idx) => (
              <button
                key={idx}
                className={`review-question-card ${answer.isCorrect ? 'correct' : 'wrong'}`}
                onClick={() => handleReviewQuestion(idx)}
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
          }}
          style={{ marginTop: '1rem', width: '100%' }}
        >
          🔄 Retake Quiz
        </button>
      </div>
    )
  }

  return (
    <div className="edufeed-quiz-body">
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
      {currentQuestion.image_url && (
  <img 
    src={currentQuestion.image_url} 
    alt="Question" 
    className="edufeed-att-media"
    style={{ 
      marginBottom: '1rem', 
      borderRadius: '12px',
      maxHeight: '420px',
      width: '100%',
      objectFit: 'contain'
    }} 
  />
)}
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
          {currentQuestionIndex < totalQuestions - 1 ? (
            <button className="edufeed-quiz-unlock-btn next-btn" onClick={handleNextQuestion}
              style={{ marginTop: '0.5rem', width: '100%' }}>
              Next Question →
            </button>
          ) : (
            <button className="edufeed-quiz-unlock-btn see-results-btn" onClick={handleNextQuestion}
              style={{ marginTop: '0.5rem', width: '100%',
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      color: 'white',
                      fontWeight: '700',
                      border: 'none',
                      boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)' }}>
              🎉 See Results
            </button>
          )}
        </>
      )}
    </div>
  )
}

// ── QuizBody — handles ALL quiz types: Studio Quiz, Subject Quiz, Flashcard ──
const QuizBody = ({ post, user }) => {
  // ── Subject Quiz hooks (always declared, used conditionally) ──
  const [revealed, setRevealed] = useState(false)
  const [selfGraded, setSelfGraded] = useState(null)
  const [userAnswer, setUserAnswer] = useState('')
  const [hasAnswered, setHasAnswered] = useState(false)

  // ── Flashcard hooks ──
  const [userGuess, setUserGuess] = useState('')
  const [hasGuessed, setHasGuessed] = useState(false)

  const [sqTimeLeft, setSqTimeLeft] = useState(QUESTION_TIME_LIMIT)
  const [sqTimedOut, setSqTimedOut] = useState(false)
  const [fcTimeLeft, setFcTimeLeft] = useState(QUESTION_TIME_LIMIT)
  const [fcTimedOut, setFcTimedOut] = useState(false)

  useEffect(() => {
    if (hasAnswered || sqTimedOut) return
    if (sqTimeLeft <= 0) { setSqTimedOut(true); return }
    const id = setInterval(() => setSqTimeLeft(t => (t > 0 ? t - 1 : 0)), 1000)
    return () => clearInterval(id)
  }, [hasAnswered, sqTimedOut, sqTimeLeft])

  useEffect(() => {
    if (hasGuessed || fcTimedOut) return
    if (fcTimeLeft <= 0) { setFcTimedOut(true); return }
    const id = setInterval(() => setFcTimeLeft(t => (t > 0 ? t - 1 : 0)), 1000)
    return () => clearInterval(id)
  }, [hasGuessed, fcTimedOut, fcTimeLeft])

  const quiz = post.quiz_data || {}
  
  // Subject Quiz has no fixed point value (it's free-response, self-graded),
  // so a correct self-grade is worth the same flat 5 pts the UI already
  // promises below ("🎉 Great job! +5 points").
  const SUBJECT_QUIZ_POINTS = 5
  const FLASHCARD_POINTS = 5

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

  const handleSelfGrade = (isCorrect) => {
    setSelfGraded(isCorrect ? 'correct' : 'wrong')
    recordCompletion(isCorrect && !sqTimedOut ? SUBJECT_QUIZ_POINTS : 0, 'subject_quiz')
   }
  
  // ── Check if this is a Subject Quiz ──
  if (post.type === 'subject_quiz' || quiz.mode === 'subject_qa') {
    return (
      <div className="edufeed-quiz-body subject-quiz-body">
        {post.subject && <span className="edufeed-subject-tag">{post.subject}</span>}
        
        {post.attachments && post.attachments.length > 0 && (
          <div className="subject-qa-media">
            {post.attachments.map((att, idx) => {
              if (att.type === 'youtube') {
                return (
                  <div key={idx} className="subject-qa-media-item">
                    <iframe 
                      src={att.embedUrl || `https://www.youtube-nocookie.com/embed/${att.url.split('v=')[1]}`}
                      width="100%" height="200" frameBorder="0" allowFullScreen title={att.name} className="edufeed-att-media" />
                  </div>
                );
              }
              if (att.type?.startsWith('video/')) {
                return (
                  <div key={idx} className="subject-qa-media-item">
                    <video src={att.url} controls className="edufeed-att-media" />
                  </div>
                );
              }
              if (att.type?.startsWith('image/')) {
                return (
                  <div key={idx} className="subject-qa-media-item">
                    <img src={att.url} alt={att.name} className="edufeed-att-media" />
                  </div>
                );
              }
              return null;
            })}
          </div>
        )}
        
        <div className="sq-block sq-question-block">
          <div className="sq-label">❓ Question</div>
          <div className="sq-text sq-question-text">
            {quiz.question || post.title || 'No question provided'}
          </div>
        </div>
        
        {!hasAnswered ? (
          <>
            <div className={`ef-timer-chip ${sqTimedOut || sqTimeLeft <= 5 ? 'urgent' : ''}`}>
              {sqTimedOut ? "⏱️ Time's up — this one won't earn points, but go ahead and finish" : `⏱ ${sqTimeLeft}s to answer for points`}
            </div>
            <div className="sq-answer-input-wrapper">
              <textarea
                className="sq-answer-input"
                placeholder="Type your answer here..."
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                rows={3}
              />
            </div>
            <button 
              className="sq-submit-btn" 
              onClick={() => setHasAnswered(true)}
              disabled={!userAnswer.trim()}
            >
              ✓ Submit Answer
            </button>
          </>
        ) : (
          <>
            <div className="sq-user-answer">
              <div className="sq-label">📝 Your Answer</div>
              <div className="sq-text">{userAnswer}</div>
            </div>
            
            {!revealed ? (
              <button 
                className="sq-reveal-btn" 
                onClick={() => setRevealed(true)}
              >
                👀 Reveal Correct Answer
              </button>
            ) : (
              <>
                <div className="sq-block sq-answer-block">
                  <div className="sq-label sq-answer-label">✅ Correct Answer</div>
                  <div className="sq-text sq-answer-text">
                    {quiz.answer || 'No answer provided'}
                  </div>
                </div>
                
                {!selfGraded ? (
                  <div className="sq-self-grade">
                    <div className="sq-self-grade-prompt">Did you get it right?</div>
                    <div className="sq-self-grade-btns">
                      <button 
                        className="sq-grade-btn sq-grade-correct"
                        onClick={() => handleSelfGrade(true)}
                      >
                        ✅ Yes, correct!
                      </button>
                      <button 
                        className="sq-grade-btn sq-grade-wrong"
                        onClick={() => handleSelfGrade(false)}
                      >
                        ❌ Need review
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={`sq-feedback sq-feedback-${selfGraded}`}>
                    {selfGraded === 'correct'
                      ? (sqTimedOut ? '⏱️ Correct — but time ran out, no points this round' : '🎉 Great job! +5 points')
                      : '📚 Keep practicing!'}
                  </div>
                )}
                
                <button 
                  className="sq-reset-btn" 
                  onClick={() => { 
                    setUserAnswer(''); 
                    setHasAnswered(false); 
                    setRevealed(false); 
                    setSelfGraded(null); 
                    setSqTimeLeft(QUESTION_TIME_LIMIT);
                    setSqTimedOut(false);
                  }}
                >
                  ↺ Try Another
                </button>
              </>
            )}
          </>
        )}
      </div>
    )
  }

  // ── Check if this is a Flashcard ──
  if (post.type === 'flashcard' || quiz.mode === 'flashcard') {
    const hasImage = post.attachments?.some(a => a.type?.startsWith('image/'))

    const handleFlashcardSubmit = () => {
      const isCorrect = userGuess.trim().toLowerCase() === quiz.answer?.toLowerCase()
      recordCompletion(isCorrect && !fcTimedOut ? FLASHCARD_POINTS : 0, 'flashcard')
      setHasGuessed(true)
    }

    return (
      <div className="edufeed-flashcard-wrap">
        {post.subject && <span className="edufeed-subject-tag">{post.subject}</span>}
        
        {!hasGuessed ? (
          <div className="edufeed-flashcard edufeed-flashcard-front">
            {hasImage && (
              <div className="flashcard-image-container">
                {post.attachments.filter(a => a.type?.startsWith('image/')).map((img, idx) => (
                  <img key={idx} src={img.url} alt="Flashcard question" className="flashcard-image" />
                ))}
              </div>
            )}
            
            {!hasImage && (
              <>
                <span className="edufeed-flashcard-side">❓ Question</span>
                <div className="edufeed-flashcard-text">
                  {quiz.question || post.title}
                </div>
              </>
            )}
            
            <div className={`ef-timer-chip ${fcTimedOut || fcTimeLeft <= 5 ? 'urgent' : ''}`}>
              {fcTimedOut ? "⏱️ Time's up — won't earn points, but go ahead" : `⏱ ${fcTimeLeft}s to answer for points`}
            </div>
            <div className="flashcard-guess-section">
              <input
                type="text"
                className="flashcard-guess-input"
                placeholder="Type your answer..."
                value={userGuess}
                onChange={(e) => setUserGuess(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && userGuess.trim()) {
                    handleFlashcardSubmit()
                  }
                }}
              />
              <button 
                className="flashcard-submit-btn"
                onClick={handleFlashcardSubmit}
                disabled={!userGuess.trim()}
              >
                Submit Answer
              </button>
            </div>
            
            <span className="edufeed-flashcard-hint">
              {hasImage ? 'Identify what\'s in the image' : 'Tap to reveal answer'}
            </span>
          </div>
        ) : (
          <div className="edufeed-flashcard edufeed-flashcard-back flipped">
            {hasImage && (
              <div className="flashcard-image-container">
                {post.attachments.filter(a => a.type?.startsWith('image/')).map((img, idx) => (
                  <img key={idx} src={img.url} alt="Flashcard question" className="flashcard-image" />
                ))}
              </div>
            )}
            
            <span className="edufeed-flashcard-side">✅ Answer</span>
            <div className="edufeed-flashcard-text">
              {quiz.answer}
            </div>
            
            {userGuess.trim().toLowerCase() === quiz.answer?.toLowerCase() && (
              <div className="flashcard-correct-badge">
                {fcTimedOut ? '⏱️ Correct — but over time, no points' : '✓ Correct!'}
              </div>
            )}
            
            <button 
              className="flashcard-reset-btn"
              onClick={() => {
                setUserGuess('')
                setHasGuessed(false)
                setFcTimeLeft(QUESTION_TIME_LIMIT)
                setFcTimedOut(false)
              }}
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── Studio Quiz (multi-choice) — delegate to the shared player. Legacy
  // single-question posts (flat quiz.options/correct_index) get normalized
  // into the same one-question-array shape the interactive format already uses. ──
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
    />
  )
}

// ── Community Body ──
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

  // CommunityPreview is the only card face — no separate "in progress" view.
  // The quiz modal, once opened, stays mounted+hidden via CSS (never
  // unmounted), so closing it to browse the feed keeps progress intact.
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

const QuizCard = withCardActions(QuizBody)
const CommunityCard = withCardActions(CommunityBody, { selfContained: true })
      

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
  const feedRef = useRef(null)
  const isPro = userTier === 'pro'

  const fetchPosts = useCallback(async () => {
    if (activeType === 'leaderboard') { setLoading(false); return }
    setLoading(true)
    let query = supabase
      .from('edufeed_posts')
      .select('*, profiles(id, display_name, username, avatar_url)')
      .eq('is_published', true)
      .eq('is_flagged', false)
      .order('created_at', { ascending: false })
      .limit(30)
    
    if (activeType !== 'all') {
      if (activeType === 'quiz') {
        query = query.or('type.eq.quiz,type.eq.subject_quiz,type.eq.flashcard')
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
  if (isPro) {
    if (onEditPost) onEditPost(null)
  } else {
    setShowProModal(true)
  }
}

  const handlePostDeleted = (postId) => setPosts(prev => prev.filter(p => p.id !== postId))
  const toggleLock = (postId) => setLockedPostId(prev => prev === postId ? null : postId)

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

      <PlayerSpotlight />
      <LiveChallengeBanner onJoinRoom={(id) => setArenaRoomId(id)} />

      <div className="edufeed-type-filter-bar">
  <div className="edufeed-filter-left">
    {POST_TYPES.map(t => (
      <button key={t.key} className={`edufeed-type-filter-pill ${activeType === t.key ? 'active' : ''}`} onClick={() => setActiveType(t.key)}>
        {t.label}
      </button>
          ))}
        </div>
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