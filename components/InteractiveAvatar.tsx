import { useEffect, useRef, useState } from "react";
import { useMemoizedFn, useUnmount } from "ahooks";

import { Button } from "./Button";
import { AvatarVideo } from "./AvatarSession/AvatarVideo";
import { useStreamingAvatarSession } from "./logic/useStreamingAvatarSession";
import { AvatarControls } from "./AvatarSession/AvatarControls";
import { useVoiceChat } from "./logic/useVoiceChat";
import {
  StreamingAvatarProvider,
  StreamingAvatarSessionState,
} from "./logic";
import { useStreamingAvatarContext } from "./logic/context";
import { useConversationState } from "./logic/useConversationState";
import { useInterrupt } from "./logic/useInterrupt";
import { LoadingIcon } from "./Icons";
import { MessageHistory } from "./AvatarSession/MessageHistory";

import { AVATARS } from "@/app/lib/constants";
import {
  AvatarStartError,
  FriendlyError,
  mapAvatarError,
} from "@/app/lib/errorMessages";
import { useMediaQuery } from "./logic/useMediaQuery";
import { MicOverlay } from "./AvatarSession/MicOverlay";
import { TextOverlay } from "./AvatarSession/TextOverlay";

const PREFERRED_AVATAR_ID = AVATARS[0].avatar_id;
const PREFERRED_VOICE_ID =
  process.env.NEXT_PUBLIC_LIVEAVATAR_VOICE_ID ||
  "c4172817-d52b-4237-98b0-140679312b5b";
const PREFERRED_CONTEXT_ID =
  process.env.NEXT_PUBLIC_LIVEAVATAR_CONTEXT_ID ?? null;

const PORTRAIT_OBJECT_POSITION = "30% center";

interface SessionConfig {
  avatar_id: string;
  language: string;
  voice_id: string | null;
  context_id: string | null;
}

const DEFAULT_CONFIG: SessionConfig = {
  avatar_id: PREFERRED_AVATAR_ID,
  language: "de",
  voice_id: PREFERRED_VOICE_ID,
  context_id: PREFERRED_CONTEXT_ID,
};

interface TokenResponse {
  session_id: string;
  session_token: string;
}

interface InteractiveAvatarProps {
  fullscreen?: boolean;
  hideChat?: boolean;
  forcePortrait?: boolean;
}

interface StartupOverlayProps {
  isStarting: boolean;
  micPermissionDenied: boolean;
  startError: FriendlyError | null;
  onStart: () => void;
  onTextStart: () => void;
}

function ErrorBanner({ error }: { error: FriendlyError }) {
  return (
    <div
      role="alert"
      className="w-full max-w-sm rounded-xl border border-red-400/30 bg-red-950/50 px-4 py-3 text-left"
    >
      <p className="text-red-200 text-sm font-medium">{error.title}</p>
      <p className="text-white/85 text-sm mt-1 leading-snug">{error.message}</p>
      {error.hint && (
        <p className="text-white/55 text-xs mt-2 leading-snug">{error.hint}</p>
      )}
      {error.technical && (
        <p className="text-white/35 text-[10px] mt-2 font-mono break-all">
          {error.technical}
        </p>
      )}
    </div>
  );
}

function StartupOverlay({
  isStarting,
  micPermissionDenied,
  startError,
  onStart,
  onTextStart,
}: StartupOverlayProps) {
  const startLabel = startError?.retryable === false
    ? "Beratung starten"
    : startError
      ? "Erneut versuchen"
      : "Beratung starten";
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black">
      <div className="flex flex-col items-center gap-4 px-6 text-center">
        <h2 className="text-white text-xl font-medium">
          Sprechen Sie mit Alex
        </h2>
        <p className="text-white/70 text-sm max-w-xs">
          Ihrem digitalen Berater der Sparkasse Pforzheim Calw. Beim Start
          wird der Mikrofon-Zugriff abgefragt — bitte erlauben.
        </p>
        {startError && <ErrorBanner error={startError} />}
        <button
          onClick={onStart}
          disabled={isStarting}
          className="h-12 rounded-full bg-[#E60000] text-white font-medium px-6 text-base shadow-lg border border-black/10 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
          aria-label="Beratung starten"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
          {isStarting ? "Verbindung wird hergestellt…" : startLabel}
        </button>
        <button
          onClick={onTextStart}
          disabled={isStarting}
          className="h-9 rounded-full bg-white/10 text-white text-sm px-4 hover:bg-white/20 disabled:opacity-50 transition"
        >
          Lieber per Text chatten
        </button>
        {micPermissionDenied && (
          <p className="text-red-400 text-xs max-w-xs">
            Mikrofon-Zugriff wurde abgelehnt. Bitte im Browser erlauben oder
            stattdessen den Text-Chat nutzen.
          </p>
        )}
      </div>
    </div>
  );
}

interface ApiErrorBody {
  error?: string;
  code?: number | string | null;
  status?: number | null;
  upstreamMessage?: string | null;
}

async function fetchSessionToken(
  sessionConfig: SessionConfig,
): Promise<string> {
  let response: Response;
  try {
    response = await fetch("/api/get-access-token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        avatar_id: sessionConfig.avatar_id,
        language: sessionConfig.language,
        voice_id: sessionConfig.voice_id,
        context_id: sessionConfig.context_id,
      }),
    });
  } catch (err) {
    throw new AvatarStartError({
      cause: "fetch_token",
      status: 0,
      code: "network_error",
      message: err instanceof Error ? err.message : "Network error",
    });
  }

  if (!response.ok) {
    let body: ApiErrorBody | null = null;
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      body = null;
    }
    throw new AvatarStartError({
      cause: "fetch_token",
      status: body?.status ?? response.status,
      code: body?.code ?? null,
      upstreamMessage: body?.upstreamMessage ?? body?.error ?? null,
      message: body?.error ?? `HTTP ${response.status}`,
    });
  }

  const data = (await response.json()) as TokenResponse;
  if (!data.session_token) {
    throw new AvatarStartError({
      cause: "fetch_token",
      message: "Session token missing in response",
    });
  }

  return data.session_token;
}

function InteractiveAvatar({
  fullscreen = false,
  hideChat = false,
  forcePortrait = false,
}: InteractiveAvatarProps) {
  const {
    initAvatar,
    startAvatar,
    stopAvatar,
    sessionState,
    isStreamReady,
    attachMedia,
  } = useStreamingAvatarSession();
  const {
    startVoiceChat,
    stopVoiceChat,
    isVoiceChatActive,
    muteInputAudio,
    unmuteInputAudio,
    isVoiceChatLoading,
  } = useVoiceChat();
  const { startListening, stopListening, isAvatarTalking } =
    useConversationState();
  const { interrupt } = useInterrupt();
  const { lastDisconnectReason, setLastDisconnectReason } =
    useStreamingAvatarContext();

  const [showTextOverlay, setShowTextOverlay] = useState<boolean>(false);
  const [micPermissionDenied, setMicPermissionDenied] =
    useState<boolean>(false);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [startError, setStartError] = useState<FriendlyError | null>(null);
  const mediaStream = useRef<HTMLVideoElement>(null);
  // When the user picks the text-only entry path, we want the TextOverlay to
  // appear automatically the moment the session is connected — not after a
  // second click. Tracked as a ref so the value survives any re-renders that
  // happen during the async startSession() call.
  const pendingTextModeRef = useRef<boolean>(false);
  const isMobile = useMediaQuery("(max-width: 639px)");

  const startSession = useMemoizedFn(async (withVoiceChat: boolean) => {
    const sessionToken = await fetchSessionToken(DEFAULT_CONFIG);
    // Voice chat is started explicitly after the session is connected so
    // we control the order: stream-ready event fires before mic capture
    // begins. This avoids races where the SDK publishes a mic track to a
    // room that isn't fully wired up.
    initAvatar(sessionToken, { voiceChat: false });
    try {
      await startAvatar(sessionToken, { voiceChat: false });
    } catch (err) {
      const sdkErr = err as {
        message?: string;
        errorCode?: number;
        status?: number;
        name?: string;
      };
      // Dump the raw SDK error so the operator can read the upstream
      // payload from the browser console even if the UI banner falls
      // back to a generic message. This is the only place the original
      // SessionApiError is reachable.
      console.error("[avatar][session_start] raw SDK error", {
        name: sdkErr?.name,
        message: sdkErr?.message,
        errorCode: sdkErr?.errorCode,
        status: sdkErr?.status,
        full: err,
      });
      throw new AvatarStartError({
        cause: "session_start",
        status: sdkErr?.status ?? null,
        code: sdkErr?.errorCode ?? null,
        upstreamMessage: sdkErr?.message ?? null,
        message: sdkErr?.message,
      });
    }

    if (withVoiceChat) {
      try {
        await startVoiceChat();
      } catch (err) {
        throw new AvatarStartError({
          cause: "voice_chat",
          message: err instanceof Error ? err.message : "Voice chat failed",
        });
      }
    }
  });

  // Single entry point: ensures we have the user gesture + microphone
  // permission BEFORE we start the LiveAvatar session. This way the agent's
  // auto-greeting plays through an already-unmuted audio pipeline — the user
  // hears Alex from the very first word, in Adrian's voice, no duplicates.
  const handleStart = useMemoizedFn(async (withVoiceChat: boolean) => {
    if (isStarting) return;
    setIsStarting(true);
    setMicPermissionDenied(false);
    setStartError(null);
    setLastDisconnectReason(null);
    pendingTextModeRef.current = !withVoiceChat;
    try {
      if (withVoiceChat) {
        try {
          const probe = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          probe.getTracks().forEach((t) => t.stop());
        } catch (err) {
          console.warn("[avatar] mic permission denied or unavailable", err);
          setMicPermissionDenied(true);
          setIsStarting(false);
          return;
        }
      }
      await startSession(withVoiceChat);
    } catch (err) {
      console.error("[avatar] start failed", err);
      if (err instanceof AvatarStartError) {
        setStartError(
          mapAvatarError({
            cause: err.cause,
            status: err.status,
            code: err.code,
            message: err.upstreamMessage ?? err.message,
          }),
        );
      } else {
        setStartError(
          mapAvatarError({
            cause: "unknown",
            message: err instanceof Error ? err.message : String(err),
          }),
        );
      }
      pendingTextModeRef.current = false;
    } finally {
      setIsStarting(false);
    }
  });

  // When the user entered via the text path, surface the TextOverlay as soon
  // as the session is fully connected. The agent's voice greeting still
  // plays through the unmuted audio pipeline, but the user gets the input
  // field immediately so they can type their first question.
  useEffect(() => {
    if (
      sessionState === StreamingAvatarSessionState.CONNECTED &&
      pendingTextModeRef.current
    ) {
      pendingTextModeRef.current = false;
      setShowTextOverlay(true);
    }
    if (sessionState === StreamingAvatarSessionState.INACTIVE) {
      pendingTextModeRef.current = false;
    }
  }, [sessionState]);

  // Surface server-side disconnects (e.g. session expired, kicked, network)
  // as a friendly error on the start screen so the user knows why the
  // session ended instead of just landing back on a blank entry point.
  // Important: SESSION_DISCONNECTED fires DURING session.start() failure,
  // BEFORE the catch in handleStart can attach the actual upstream
  // SessionApiError. Use a functional update so we never overwrite a more
  // specific error that handleStart already set.
  useEffect(() => {
    if (
      sessionState === StreamingAvatarSessionState.INACTIVE &&
      lastDisconnectReason &&
      lastDisconnectReason !== "CLIENT_INITIATED"
    ) {
      setStartError((prev) =>
        prev
          ? prev
          : mapAvatarError({
              cause: "session_disconnect",
              reason: lastDisconnectReason,
            }),
      );
    }
  }, [sessionState, lastDisconnectReason]);

  useUnmount(() => {
    void stopAvatar();
  });

  // When the LiveKit stream is ready, attach SDK tracks to our video element.
  // Audio is unmuted automatically (autoUnmute on AvatarVideo) because the
  // user's gesture happened on the start button — we already have permission
  // to play audio for this document.
  useEffect(() => {
    if (!isStreamReady || !mediaStream.current) return;
    const video = mediaStream.current;
    attachMedia(video);
  }, [isStreamReady, attachMedia]);

  // Switch listening on/off based on who is speaking. While the avatar talks,
  // we mute the user's mic so it doesn't bleed back into the STT and trigger
  // a self-interrupt.
  useEffect(() => {
    if (isAvatarTalking) {
      stopListening();
      muteInputAudio();
    } else if (isVoiceChatActive && !showTextOverlay) {
      startListening();
      unmuteInputAudio();
    }
  }, [
    isAvatarTalking,
    isVoiceChatActive,
    showTextOverlay,
    stopListening,
    startListening,
    muteInputAudio,
    unmuteInputAudio,
  ]);

  const handleToggleTextMode = useMemoizedFn(async () => {
    if (showTextOverlay) {
      // Returning from text → voice
      setShowTextOverlay(false);
      try {
        if (!isVoiceChatActive) {
          await startVoiceChat(false);
        }
        unmuteInputAudio();
        startListening();
      } catch (e) {
        console.error("Resume voice from overlay failed:", e);
      }
    } else {
      // Switching voice → text
      if (isVoiceChatActive) {
        await stopVoiceChat();
      }
      setShowTextOverlay(true);
    }
  });

  return (
    <div
      className={`w-full flex flex-col gap-4 ${fullscreen || forcePortrait ? "h-full" : ""}`}
    >
      <div
        className={
          `flex flex-col overflow-hidden h-full ` +
          (fullscreen ? "bg-black rounded-none" : "rounded-xl bg-zinc-900")
        }
      >
        <div
          className={
            `relative w-full overflow-hidden flex flex-col items-center justify-center ` +
            (fullscreen || forcePortrait ? "h-full" : "aspect-video")
          }
        >
          {sessionState !== StreamingAvatarSessionState.INACTIVE &&
            (fullscreen ? (
              <div className="w-full h-full flex items-center justify-center">
                {isMobile ? (
                  <div className="relative h-full max-h-full max-w-[100vw] aspect-[9/16] bg-black">
                    <div className="absolute inset-0">
                      <AvatarVideo
                        ref={mediaStream}
                        autoUnmute
                        fit="cover"
                        objectPosition={PORTRAIT_OBJECT_POSITION}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="relative w-full h-full bg-black">
                    <div className="absolute inset-0">
                      <AvatarVideo
                        ref={mediaStream}
                        autoUnmute
                        fit="contain"
                        objectPosition="center center"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : forcePortrait ? (
              <div className="relative w-full h-full bg-black">
                <div className="absolute inset-0">
                  <AvatarVideo
                    ref={mediaStream}
                    autoUnmute
                    fit="cover"
                    objectPosition={PORTRAIT_OBJECT_POSITION}
                  />
                </div>
              </div>
            ) : (
              <AvatarVideo ref={mediaStream} autoUnmute />
            ))}
          {sessionState === StreamingAvatarSessionState.INACTIVE &&
            (fullscreen || forcePortrait) && (
              <StartupOverlay
                isStarting={isStarting}
                micPermissionDenied={micPermissionDenied}
                startError={startError}
                onStart={() => void handleStart(true)}
                onTextStart={() => void handleStart(false)}
              />
            )}
          <div className="absolute bottom-5 inset-x-0 flex items-center justify-center gap-3 px-3">
            <div className="flex-1" />

            <div className="flex items-center gap-3">
              {!showTextOverlay &&
                sessionState === StreamingAvatarSessionState.CONNECTED && (
                  <button
                    onClick={interrupt}
                    disabled={!isAvatarTalking}
                    className="h-10 rounded-full bg-[#E60000] text-white shadow-lg border border-black/10 px-4 text-sm font-medium hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                    aria-label="Avatar unterbrechen"
                  >
                    Unterbrechen
                  </button>
                )}
              {!showTextOverlay && <MicOverlay />}
            </div>

            <div className="flex-1 flex justify-end">
              {!showTextOverlay &&
                sessionState === StreamingAvatarSessionState.CONNECTED && (
                  <button
                    disabled={isVoiceChatLoading}
                    onClick={() => void handleToggleTextMode()}
                    className="h-10 rounded-full bg-white/95 text-zinc-900 shadow-lg border border-black/10 px-4 text-sm font-medium hover:bg-white"
                    aria-pressed={showTextOverlay}
                    aria-label="Text-Chat einblenden"
                  >
                    Text
                  </button>
                )}
            </div>
          </div>

          {showTextOverlay && (
            <TextOverlay onClose={() => void handleToggleTextMode()} />
          )}
          {fullscreen && (
            <div className="absolute top-3 right-3">
              <a
                href="/"
                aria-label="Schließen und zur Widget-Seite zurückkehren"
                className="h-9 w-9 rounded-full bg-white/95 text-zinc-900 shadow-lg border border-black/10 flex items-center justify-center hover:bg-white"
              >
                <span className="text-lg leading-none">×</span>
              </a>
            </div>
          )}
        </div>
        <div
          className={
            `p-4 border-t border-zinc-700 w-full ` +
            (fullscreen || hideChat
              ? "hidden"
              : "flex flex-col gap-3 items-center justify-center")
          }
        >
          {sessionState === StreamingAvatarSessionState.CONNECTED ? (
            <AvatarControls />
          ) : sessionState === StreamingAvatarSessionState.INACTIVE ? (
            <div className="flex flex-col items-center gap-3">
              <div className="flex flex-row gap-4">
                <Button
                  disabled={isStarting}
                  onClick={() => void handleStart(true)}
                >
                  {isStarting ? "Starte…" : "Start Voice Chat"}
                </Button>
                <Button
                  disabled={isStarting}
                  onClick={() => void handleStart(false)}
                >
                  Start Text Chat
                </Button>
              </div>
              {micPermissionDenied && (
                <p className="text-xs text-red-400">
                  Mikrofon-Zugriff wurde abgelehnt. Bitte im Browser erlauben
                  oder Text-Chat starten.
                </p>
              )}
              {startError && <ErrorBanner error={startError} />}
            </div>
          ) : (
            <LoadingIcon />
          )}
        </div>
      </div>
      {sessionState === StreamingAvatarSessionState.CONNECTED &&
        !fullscreen &&
        !hideChat && <MessageHistory />}
    </div>
  );
}

export default function InteractiveAvatarWrapper(props: InteractiveAvatarProps) {
  return (
    <StreamingAvatarProvider apiUrl={process.env.NEXT_PUBLIC_LIVEAVATAR_API_URL}>
      <InteractiveAvatar {...props} />
    </StreamingAvatarProvider>
  );
}
