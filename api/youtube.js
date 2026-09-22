// /api/youtube.js
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const channelCache = new Map();
const CACHE_DURATION_MS = 15 * 60 * 1000;
const MAX_CHANNELS_PER_REQUEST = 25;

// ── shared helpers ──
function toChannelShape(item) {
  const stats = item.statistics;
  return {
    id: item.id,
    title: item.snippet.title,
    thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
    description: item.snippet.description || '',
    subscriberCount: stats && !stats.hiddenSubscriberCount ? Number(stats.subscriberCount) : null,
  };
}

// ── feed mode (was youtube-feed.js) ──
async function getUploadsPlaylistId(channelId, apiKey) {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Failed to resolve channel');
  const uploadsId = data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsId) throw new Error(`No uploads playlist found for channel ${channelId}`);
  return uploadsId;
}

async function getPlaylistVideos(playlistId, apiKey, maxResults = 12) {
  const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=${maxResults}&key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Failed to fetch playlist items');
  return (data.items || [])
    .filter(item => item.snippet?.resourceId?.videoId)
    .map(item => ({
      id: item.snippet.resourceId.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
      publishedAt: item.snippet.publishedAt,
      channelTitle: item.snippet.channelTitle,
      platform: 'youtube',
      embedUrl: `https://www.youtube-nocookie.com/embed/${item.snippet.resourceId.videoId}`,
      watchUrl: `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}`,
    }));
}

async function getChannelVideos(channelId, apiKey, forceRefresh) {
  const cached = channelCache.get(channelId);
  const now = Date.now();
  if (!forceRefresh && cached && now - cached.timestamp < CACHE_DURATION_MS) return cached.videos;
  const uploadsPlaylistId = await getUploadsPlaylistId(channelId, apiKey);
  const videos = await getPlaylistVideos(uploadsPlaylistId, apiKey);
  channelCache.set(channelId, { videos, timestamp: now });
  return videos;
}

async function handleFeed(req, res, apiKey) {
  let channelIds = [];
  let forceRefresh = false;
  if (req.method === 'POST') {
    channelIds = Array.isArray(req.body?.channelIds) ? req.body.channelIds : [];
    forceRefresh = !!req.body?.refresh;
  } else if (req.query?.channelId) {
    channelIds = [req.query.channelId];
    forceRefresh = req.query?.refresh === '1';
  }
  channelIds = [...new Set(channelIds.filter(Boolean))].slice(0, MAX_CHANNELS_PER_REQUEST);
  if (channelIds.length === 0) return res.status(200).json({ videos: [], noChannels: true });

  // Server-side enforcement — this is the actual gate. No channel's videos are
  // ever fetched unless it's tier1 or approved, regardless of what the client sends.
  const { data: approvedRows } = await supabaseAdmin
    .from('vidfeed_channels')
    .select('id')
    .in('id', channelIds)
    .in('status', ['tier1', 'approved']);
  channelIds = (approvedRows || []).map(r => r.id);
  if (channelIds.length === 0) return res.status(200).json({ videos: [], noChannels: true });

  const results = await Promise.allSettled(channelIds.map(id => getChannelVideos(id, apiKey, forceRefresh)));
  const allVideos = [];
  const failedChannels = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') allVideos.push(...r.value);
    else failedChannels.push(channelIds[i]);
  });
  allVideos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  return res.status(200).json({ videos: allVideos, ...(failedChannels.length ? { failedChannels: failedChannels.length } : {}) });
}

// ── resolve mode (was resolve-youtube-channel.js) ──
async function lookupById(id, apiKey) {
  const r = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${id}&key=${apiKey}`);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || 'Channel lookup failed');
  return data.items?.[0] ? toChannelShape(data.items[0]) : null;
}

async function lookupByHandle(handle, apiKey) {
  const r = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet&forHandle=${encodeURIComponent(handle)}&key=${apiKey}`);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || 'Handle lookup failed');
  return data.items?.[0] ? toChannelShape(data.items[0]) : null;
}

async function searchChannels(query, apiKey) {
  const r = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=5&q=${encodeURIComponent(query)}&key=${apiKey}`);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || 'Channel search failed');
  return (data.items || []).map(item => ({
    id: item.snippet.channelId,
    title: item.snippet.title,
    thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
    description: item.snippet.description || '',
  }));
}

async function getRegistryInfo(channelId) {
  const { data } = await supabaseAdmin
    .from('vidfeed_channels')
    .select('status, subject')
    .eq('id', channelId)
    .maybeSingle();
  if (!data) return { inRegistry: false };
  const { count } = await supabaseAdmin
    .from('user_channel_follows')
    .select('*', { count: 'exact', head: true })
    .eq('channel_id', channelId);
  return { inRegistry: true, status: data.status, subject: data.subject, followerCount: count || 0 };
}

// Called once the user picks a specific candidate from a name-search result list —
// fetches full stats for that one channel, since search results never include them.
async function handleChannelInfo(req, res, apiKey) {
  const { channelId } = req.body || {};
  if (!channelId) return res.status(400).json({ error: 'channelId is required.' });
  const channel = await lookupById(channelId, apiKey);
  if (!channel) return res.status(404).json({ error: 'Channel not found.' });
  const registry = await getRegistryInfo(channel.id);
  return res.status(200).json({ channel: { ...channel, ...registry } });
}

// Adds a channel to the registry (if new) and follows it for the submitting user.
// Requires a valid session — submitted_by/user_id must be the real caller, never
// client-supplied, so a submission can't be spoofed as coming from someone else.
async function handleSubmitChannel(req, res) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  if (!token) return res.status(401).json({ error: 'Missing auth token.' });
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid or expired session.' });

  const { channel, subject, justification } = req.body || {};
  if (!channel?.id || !subject) return res.status(400).json({ error: 'channel and subject are required.' });

  const { data: existing } = await supabaseAdmin
    .from('vidfeed_channels').select('id, status').eq('id', channel.id).maybeSingle();

  if (!existing) {
    const { error: insertErr } = await supabaseAdmin.from('vidfeed_channels').insert({
      id: channel.id,
      title: channel.title,
      thumbnail: channel.thumbnail,
      description: channel.description,
      subscriber_count: channel.subscriberCount,
      subject,
      justification: justification || null,
      submitted_by: user.id,
      status: 'pending',
    });
    if (insertErr) return res.status(500).json({ error: insertErr.message });
  }

  const { error: followErr } = await supabaseAdmin
    .from('user_channel_follows')
    .upsert({ user_id: user.id, channel_id: channel.id }, { onConflict: 'user_id,channel_id' });
  if (followErr) return res.status(500).json({ error: followErr.message });

  return res.status(200).json({ success: true, status: existing?.status || 'pending' });
}

async function handleResolve(req, res, apiKey) {
  const raw = (req.body?.query || '').trim();
  if (!raw) return res.status(400).json({ error: 'Please enter a channel URL, handle, or name.' });

  const idMatch = raw.match(/UC[a-zA-Z0-9_-]{22}/);
  let channel = idMatch ? await lookupById(idMatch[0], apiKey) : null;

  if (!channel) {
    const handleMatch = raw.match(/@([a-zA-Z0-9_.-]+)/);
    if (handleMatch) channel = await lookupByHandle(handleMatch[1], apiKey);
  }

  if (channel) {
    const registry = await getRegistryInfo(channel.id);
    return res.status(200).json({ channels: [{ ...channel, ...registry }] });
  }

  const candidates = await searchChannels(raw, apiKey);
  if (candidates.length === 0) return res.status(200).json({ channels: [], message: 'No matching channel found — try pasting the channel URL instead.' });
  return res.status(200).json({ channels: candidates });
}

// ── dispatcher ──
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'YouTube API key not configured on server' });

  const action = req.method === 'GET' ? 'feed' : (req.body?.action || 'feed');

  try {
        if (action === 'resolve') return await handleResolve(req, res, apiKey);
    if (action === 'channel-info') return await handleChannelInfo(req, res, apiKey);
    if (action === 'submit-channel') return await handleSubmitChannel(req, res);
    return await handleFeed(req, res, apiKey);
  } catch (err) {
    console.error('❌ YouTube API error:', err);
    return res.status(502).json({ error: err.message || 'YouTube API request failed' });
  }
}