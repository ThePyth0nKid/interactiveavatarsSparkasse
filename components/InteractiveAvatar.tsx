import { ConnectionQuality } from "@heygen/liveavatar-web-sdk";
import { useEffect, useRef, useState } from "react";
import { useMemoizedFn, useUnmount } from "ahooks";

import { Button } from "./Button";
import { AvatarVideo } from "./AvatarSession/AvatarVideo";
import { useStreamingAvatarSession } from "./logic/useStreamingAvatarSession";
import { AvatarControls } from "./AvatarSession/AvatarControls";
import { useVoiceChat } from "./logic/useVoiceChat";
import { StreamingAvatarProvider, StreamingAvatarSessionState } from "./logic";
import { useConversationState } from "./logic/useConversationState";
import { useConnectionQuality } from "./logic/useConnectionQuality";
import { useInterrupt } from "./logic/useInterrupt";
import { LoadingIcon } from "./Icons";
import { MessageHistory } from "./AvatarSession/MessageHistory";

import { AVATARS } from "@/app/lib/constants";
import { useMediaQuery } from "./logic/useMediaQuery";
import { MicOverlay } from "./AvatarSession/MicOverlay";
import { TextOverlay } from "./AvatarSession/TextOverlay";

const CUSTOM_AVATAR_ID =
  process.env.NEXT_PUBLIC_CUSTOM_AVATAR_ID ?? AVATARS[0].avatar_id;

function getPreferredAvatarId(): string {
  return CUSTOM_AVATAR_ID;
}

type SessionConfig = {
  avatar_id: string;
  language: string;
};

const DEFAULT_CONFIG: SessionConfig = {
  avatar_id: CUSTOM_AVATAR_ID,
  language: "de",
};

const PORTRAIT_OBJECT_POSITION = "30% center";

type InteractiveAvatarProps = {
  fullscreen?: boolean;
  hideChat?: boolean;
  forcePortrait?: boolean;
};

type TokenResponse = {
  session_id: string;
  session_token: string;
};

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
  const { connectionQuality } = useConnectionQuality();
  const { interrupt } = useInterrupt();

  const [config] = useState<SessionConfig>(DEFAULT_CONFIG);
  const [showTextOverlay, setShowTextOverlay] = useState<boolean>(false);

  const mediaStream = useRef<HTMLVideoElement>(null);
  const startedOnMountRef = useRef<boolean>(false);
  const isMobile = useMediaQuery("(max-width: 639px)");
  const reinitInProgressRef = useRef<boolean>(false);
  const lastVoiceEventTsRef = useRef<number>(0);

  async function waitFor(
    predicate: () => boolean,
    timeoutMs = 3000,
    stepMs = 50,
  ): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (predicate()) return true;
      await new Promise((r) => setTimeout(r, stepMs));
    }
    return predicate();
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

  const startSessionV2 = useMemoizedFn(async (isVoiceChat: boolean) => {
    const configToUse: SessionConfig = {
      ...config,
      avatar_id: getPreferredAvatarId(),
    };
    try {
      const sessionToken = await fetchSessionToken(configToUse);
      initAvatar(sessionToken, { voiceChat: false });
      await startAvatar(sessionToken, { voiceChat: false });

      if (isVoiceChat) {
        await startVoiceChat();
      }
    } catch (error) {
      console.error("Error starting avatar session:", error);

      if (configToUse.avatar_id !== AVATARS[0].avatar_id) {
        const fallbackConfig: SessionConfig = {
          ...configToUse,
          avatar_id: AVATARS[0].avatar_id,
        };
        try {
          console.warn(
            "Retrying with default avatar:",
            fallbackConfig.avatar_id,
          );
          const fallbackToken = await fetchSessionToken(fallbackConfig);
          initAvatar(fallbackToken, { voiceChat: false });
          await startAvatar(fallbackToken, { voiceChat: false });
          if (isVoiceChat) {
            await startVoiceChat();
          }
          return;
        } catch (fallbackError) {
          console.error("Fallback start failed as well:", fallbackError);
        }
      }
    }
  });

  const ensureVoiceOperational = useMemoizedFn(async () => {
    if (reinitInProgressRef.current) return;
    reinitInProgressRef.current = true;
    try {
      await new Promise((r) => setTimeout(r, 700));
      const noUserEventRecently =
        Date.now() - lastVoiceEventTsRef.current > 2000;
      const badConn =
        connectionQuality === ConnectionQuality.BAD ||
        connectionQuality === ConnectionQuality.UNKNOWN;
      if (badConn || noUserEventRecently) {
        await stopVoiceChat();
        await new Promise((r) => setTimeout(r, 250));
        await startVoiceChat(false);
        unmuteInputAudio();
        startListening();
        await new Promise((r) => setTimeout(r, 700));
        if (Date.now() - lastVoiceEventTsRef.current > 2000) {
          if (
            [
              StreamingAvatarSessionState.CONNECTED,
              StreamingAvatarSessionState.CONNECTING,
            ].includes(sessionState)
          ) {
            await stopAvatar();
            await waitFor(
              () =>
                [StreamingAvatarSessionState.INACTIVE].includes(sessionState),
              4000,
              50,
            );
          }
          if (
            [StreamingAvatarSessionState.INACTIVE].includes(sessionState)
          ) {
            await startSessionV2(true);
          }
        }
      } else {
        unmuteInputAudio();
      }
    } finally {
      reinitInProgressRef.current = false;
    }
  });

  const resumeVoiceFromOverlay = useMemoizedFn(async () => {
    setShowTextOverlay(false);
    try {
      await new Promise((r) => setTimeout(r, 100));
      await startVoiceChat(false);
      unmuteInputAudio();
      startListening();
      void ensureVoiceOperational();
    } catch (e) {
      console.error("Resume voice from overlay failed:", e);
    }
  });

  useUnmount(() => {
    void stopAvatar();
  });

  useEffect(() => {
    if (isStreamReady && mediaStream.current) {
      attachMedia(mediaStream.current);
      mediaStream.current.play().catch((err) => {
        console.warn("Video play() failed:", err);
      });
    }
  }, [isStreamReady, attachMedia]);

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

  useEffect(() => {
    if (
      !startedOnMountRef.current &&
      sessionState === StreamingAvatarSessionState.INACTIVE
    ) {
      startedOnMountRef.current = true;
      void startSessionV2(true);
    }
  }, [sessionState, startSessionV2]);

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
                  />
                </div>
              </div>
            ) : (
              <AvatarVideo ref={mediaStream} />
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
                onClick={async () => {
                  if (showTextOverlay) {
                    setShowTextOverlay(false);
                    try {
                      await new Promise((r) => setTimeout(r, 100));
                      await startVoiceChat(false);
                      unmuteInputAudio();
                      startListening();
                      void ensureVoiceOperational();
                    } catch (e) {
                      console.error("Start voice chat failed:", e);
                    }
                  } else {
                    if (isVoiceChatActive) {
                      await stopVoiceChat();
                      await new Promise((r) => setTimeout(r, 300));
                    }
                    setShowTextOverlay(true);
                  }
                }}
                className="h-10 rounded-full bg-white/95 text-zinc-900 shadow-lg border border-black/10 px-4 text-sm font-medium hover:bg-white"
                aria-pressed={showTextOverlay}
                aria-label="Text-Chat umschalten"
              >
                {showTextOverlay ? "Voice" : "Text"}
              </button>
            </div>
          </div>

          {showTextOverlay && <TextOverlay onClose={resumeVoiceFromOverlay} />}
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
              <Button onClick={() => startSessionV2(true)}>
                Start Voice Chat
              </Button>
              <Button onClick={() => startSessionV2(false)}>
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
