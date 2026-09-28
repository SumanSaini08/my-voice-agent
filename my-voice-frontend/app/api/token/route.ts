import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { AccessToken, type AccessTokenOptions, type VideoGrant } from 'livekit-server-sdk';
import { RoomConfiguration } from '@livekit/protocol';
import { SESSION_COOKIE, evaluateSession, isAuthConfigured } from '@/lib/auth';
import { getClientIp, getRateLimiter } from '@/lib/rate-limit';

type ConnectionDetails = {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
};

// NOTE: you are expected to define the following environment variables in `.env.local`:
const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

const isDev = process.env.NODE_ENV !== 'production';
const sessionSecret = process.env.SESSION_SECRET ?? '';
const tokenApiKey = process.env.TOKEN_API_KEY ?? '';

// don't cache the results
export const revalidate = 0;

export async function POST(req: Request) {
  // This route mints LiveKit participant tokens, so it is the single most
  // sensitive endpoint in the app. It requires a valid httpOnly session that
  // was issued by /api/auth in exchange for the server-side access code.
  // Both secrets stay server-side; nothing is exposed via NEXT_PUBLIC_*.
  const ip = getClientIp(req.headers);
  const limited = getRateLimiter('token-issuance', 30, 60_000).check(ip);
  if (!limited.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait and try again.' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } }
    );
  }

  const store = await cookies();
  const session = await evaluateSession({
    cookie: store.get(SESSION_COOKIE)?.value,
    sessionSecret,
    isDev,
    authEnabled: isAuthConfigured({ tokenApiKey, sessionSecret }),
  });

  if (session === 'unconfigured') {
    return NextResponse.json(
      { error: 'Server auth is not configured. Set TOKEN_API_KEY and SESSION_SECRET.' },
      { status: 503 }
    );
  }

  if (session === 'deny') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (LIVEKIT_URL === undefined) {
      throw new Error('LIVEKIT_URL is not defined');
    }
    if (API_KEY === undefined) {
      throw new Error('LIVEKIT_API_KEY is not defined');
    }
    if (API_SECRET === undefined) {
      throw new Error('LIVEKIT_API_SECRET is not defined');
    }

    // Parse room config from request body.
    const body = await req.json();
    const roomConfig = body?.room_config
      ? RoomConfiguration.fromJson(body.room_config, { ignoreUnknownFields: true })
      : new RoomConfiguration();

    // Generate participant token
    const participantName = 'user';
    const participantIdentity = `voice_assistant_user_${Math.floor(Math.random() * 10_000)}`;
    const roomName = `voice_assistant_room_${Math.floor(Math.random() * 10_000)}`;

    const participantToken = await createParticipantToken(
      { identity: participantIdentity, name: participantName },
      roomName,
      roomConfig
    );

    // Return connection details
    const data: ConnectionDetails = {
      serverUrl: LIVEKIT_URL,
      roomName,
      participantName,
      participantToken,
    };
    const headers = new Headers({
      'Cache-Control': 'no-store',
    });
    return NextResponse.json(data, { headers });
  } catch (error) {
    if (error instanceof Error) {
      console.error(error);
      return new NextResponse(error.message, { status: 500 });
    }
  }
}

function createParticipantToken(
  userInfo: AccessTokenOptions,
  roomName: string,
  roomConfig: RoomConfiguration | undefined
): Promise<string> {
  const at = new AccessToken(API_KEY, API_SECRET, {
    ...userInfo,
    ttl: '15m',
  });
  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  };
  at.addGrant(grant);

  if (roomConfig) {
    at.roomConfig = roomConfig;
  }

  return at.toJwt();
}
