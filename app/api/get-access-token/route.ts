import { NextRequest, NextResponse } from "next/server";

interface SessionTokenResponse {
  code: number;
  message?: string;
  data?: {
    session_id: string;
    session_token: string;
  };
}

interface TokenRequestBody {
  avatar_id?: string;
  language?: string;
  voice_id?: string | null;
  context_id?: string | null;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.LIVEAVATAR_API_KEY;
  const apiUrl = process.env.LIVEAVATAR_API_URL ?? "https://api.liveavatar.com";
  const defaultAvatarId = process.env.NEXT_PUBLIC_LIVEAVATAR_AVATAR_ID;

  if (!apiKey) {
    console.error("LIVEAVATAR_API_KEY is missing from .env");
    return NextResponse.json(
      { error: "Server is not configured: LIVEAVATAR_API_KEY missing" },
      { status: 500 },
    );
  }

  let body: TokenRequestBody = {};
  try {
    if (request.headers.get("content-length") !== "0") {
      body = (await request.json()) as TokenRequestBody;
    }
  } catch {
    // allow empty body
  }

  const avatar_id = body.avatar_id ?? defaultAvatarId;
  if (!avatar_id) {
    return NextResponse.json(
      { error: "avatar_id must be provided via body or env" },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(`${apiUrl}/v1/sessions/token`, {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        mode: "FULL",
        avatar_id,
        avatar_persona: {
          voice_id: body.voice_id ?? null,
          context_id: body.context_id ?? null,
          language: body.language ?? "de",
          voice_settings: {
            provider: "elevenLabs",
            model: "eleven_flash_v2_5",
            speed: 1.0,
            stability: 0.55,
            similarity_boost: 0.85,
            style: 0.15,
            use_speaker_boost: true,
          },
        },
      }),
    });

    const data = (await res.json()) as SessionTokenResponse;

    if (!res.ok || data.code !== 1000 || !data.data?.session_token) {
      console.error("LiveAvatar token request failed:", res.status, data);
      return NextResponse.json(
        {
          error:
            data.message ??
            `LiveAvatar token request failed with status ${res.status}`,
        },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        session_id: data.data.session_id,
        session_token: data.data.session_token,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error retrieving LiveAvatar session token:", error);
    return NextResponse.json(
      { error: "Failed to retrieve LiveAvatar session token" },
      { status: 500 },
    );
  }
}
