// supabase/functions/livekit-token/index.ts
import { AccessToken, RoomServiceClient } from 'https://esm.sh/livekit-server-sdk@2';

const LIVEKIT_API_KEY = Deno.env.get('LIVEKIT_API_KEY')!;
const LIVEKIT_API_SECRET = Deno.env.get('LIVEKIT_API_SECRET')!;

// RoomServiceClient talks to LiveKit's HTTP API, not the wss:// media URL
// your frontend connects to — so we derive the https host from the same
// wss:// value you'd otherwise have to duplicate as a second env var.
// Set LIVEKIT_URL as either wss://... or https://... and this normalizes it.
const RAW_LIVEKIT_URL = Deno.env.get('LIVEKIT_URL') ?? 'wss://vaibes-s8oidlpy.livekit.cloud';
const LIVEKIT_HTTP_URL = RAW_LIVEKIT_URL.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://');

const roomService = new RoomServiceClient(LIVEKIT_HTTP_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { roomName, identity, name } = await req.json();

    if (!roomName || !identity) {
      return new Response(
        JSON.stringify({ error: 'Missing roomName or identity' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Evict any stale connection under this same identity before minting a
    // new token. Without this, a tab that closed without a clean disconnect
    // leaves the old participant registered on LiveKit's media server —
    // the next join with the same identity gets rejected with "Client
    // initiated disconnect" even though your DB thinks the session is fine.
    try {
      await roomService.removeParticipant(roomName, identity);
    } catch (evictErr) {
      // Expected in the common case — no stale participant to remove.
      // LiveKit returns 404/"not found" here; only log anything unexpected.
      const msg = String(evictErr?.message || evictErr);
      if (!/not found|404/i.test(msg)) {
        console.warn('removeParticipant unexpected error (continuing):', msg);
      }
    }

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      name,
    });
    at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });

    const token = await at.toJwt();

    return new Response(JSON.stringify({ token }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('livekit-token error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Token generation failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});