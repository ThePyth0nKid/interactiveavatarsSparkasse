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
  useStreamingAvatarContext,
} from "./logic";
import { useConversationState } from "./logic/useConversationState";
import { useInterrupt } from "./logic/useInterrupt";
import { LoadingIcon } from "./Icons";
import { MessageHistory } from "./AvatarSession/MessageHistory";

import { AVATARS } from "@/app/lib/constants";
import { useMediaQuery } from "./logic/useMediaQuery";
import { MicOverlay } from "./AvatarSession/MicOverlay";
import { TextOverlay } from "./AvatarSession/TextOverlay";

const PREFERRED_AVATAR_ID = AVATARS[0].avatar_id;

const OPENING_GREETING =
  "Hallo, ich bin Alex, Ihr digitaler Berater der Sparkasse Pforzheim Calw. Wie kann ich Ihnen heute weiterhelfen?";

const PORTRAIT_OBJECT_POSITION = "30% center";

interface SessionConfig {
  avatar_id: string;
  language: string;
}

const DEFAULT_CONFIG: SessionConfig = {
  avatar_id: PREFERRED_AVATAR_ID,
  language: "de",
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

async function fetchSessionToken(
  sessionConfig: SessionConfig,
): Promise<string> {
  const response = await fetch("/api/get-access-token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      avatar_id: sessionConfig.avatar_id,
      language: sessionConfig.language,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to obtain session token (${response.status}): ${errorText}`,
    );
  }

  const data = (await response.json()) as TokenResponse;
  if (!data.session_token) {
    throw new Error("Session token missing in response");
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
  const { sessionRef } = useStreamingAvatarContext();

  const [showTextOverlay, setShowTextOverlay] = useState<boolean>(false);
  const mediaStream = useRef<HTMLVideoElement>(null);
  const startedOnMountRef = useRef<boolean>(false);
  const greetedRef = useRef<boolean>(false);
  const isMobile = useMediaQuery("(max-width: 639px)");

  const startSession = useMemoizedFn(async (withVoiceChat: boolean) => {
    try {
      const sessionToken = await fetchSessionToken(DEFAULT_CONFIG);
      // Voice chat is started explicitly after the session is connected so
      // we control the order: stream-ready event fires before mic capture
      // begins. This avoids races where the SDK publishes a mic track to a
      // room that isn't fully wired up.
      initAvatar(sessionToken, { voiceChat: false });
      await startAvatar(sessionToken, { voiceChat: false });

      if (withVoiceChat) {
        await startVoiceChat();
      }
    } catch (error) {
      console.error("Error starting avatar session:", error);
    }
  });

  useUnmount(() => {
    void stopAvatar();
  });

  // Auto-start the session in voice mode on mount.
  useEffect(() => {
    if (
      !startedOnMountRef.current &&
      sessionState === StreamingAvatarSessionState.INACTIVE
    ) {
      startedOnMountRef.current = true;
      void startSession(true);
    }
    if (sessionState === StreamingAvatarSessionState.INACTIVE) {
      greetedRef.current = false;
    }
  }, [sessionState, startSession]);

  // When the LiveKit stream is ready, attach SDK tracks to our video element.
  // The opening greeting is deferred to handleAudioReady (fires after the
  // user's unmute click) so the user actually hears it. Triggering it here
  // would speak into a muted pipeline.
  useEffect(() => {
    if (!isStreamReady || !mediaStream.current) return;
    const video = mediaStream.current;
    attachMedia(video);
  }, [isStreamReady, attachMedia]);

  const handleAudioReady = useMemoizedFn(() => {
    if (greetedRef.current || !sessionRef.current) return;
    greetedRef.current = true;
    try {
      sessionRef.current.repeat(OPENING_GREETING);
      console.info("[avatar] opening greeting triggered post-unmute");
    } catch (err) {
      console.warn("[avatar] opening greeting failed", err);
    }
  });

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
                        fit="cover"
                        objectPosition={PORTRAIT_OBJECT_POSITION}
                        onAudioReady={handleAudioReady}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="relative w-full h-full bg-black">
                    <div className="absolute inset-0">
                      <AvatarVideo
                        ref={mediaStream}
                        fit="contain"
                        objectPosition="center center"
                        onAudioReady={handleAudioReady}
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
                    fit="cover"
                    objectPosition={PORTRAIT_OBJECT_POSITION}
                    onAudioReady={handleAudioReady}
                  />
                </div>
              </div>
            ) : (
              <AvatarVideo ref={mediaStream} onAudioReady={handleAudioReady} />
            ))}
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
              <button
                disabled={isVoiceChatLoading}
                onClick={() => void handleToggleTextMode()}
                className="h-10 rounded-full bg-white/95 text-zinc-900 shadow-lg border border-black/10 px-4 text-sm font-medium hover:bg-white"
                aria-pressed={showTextOverlay}
                aria-label="Text-Chat umschalten"
              >
                {showTextOverlay ? "Voice" : "Text"}
              </button>
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
            <div className="flex flex-row gap-4">
              <Button onClick={() => startSession(true)}>
                Start Voice Chat
              </Button>
              <Button onClick={() => startSession(false)}>
                Start Text Chat
              </Button>
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
