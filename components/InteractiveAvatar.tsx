import {
  AvatarQuality,
  StreamingEvents,
  VoiceChatTransport,
  VoiceEmotion,
  StartAvatarRequest,
  STTProvider,
  ElevenLabsModel,
} from "@heygen/streaming-avatar";
import { useEffect, useRef, useState } from "react";
import { useMemoizedFn, useUnmount } from "ahooks";

import { Button } from "./Button";
import { AvatarVideo } from "./AvatarSession/AvatarVideo";
import { useStreamingAvatarSession } from "./logic/useStreamingAvatarSession";
import { AvatarControls } from "./AvatarSession/AvatarControls";
import { useVoiceChat } from "./logic/useVoiceChat";
import { StreamingAvatarProvider, StreamingAvatarSessionState } from "./logic";
import { LoadingIcon } from "./Icons";
import { MessageHistory } from "./AvatarSession/MessageHistory";

import { AVATARS } from "@/app/lib/constants";
import { useMediaQuery } from "./logic/useMediaQuery";
import { MicOverlay } from "./AvatarSession/MicOverlay";

// Read custom avatar id from environment with a safe fallback
const CUSTOM_AVATAR_ID =
  process.env.NEXT_PUBLIC_CUSTOM_AVATAR_ID ?? AVATARS[0].avatar_id;

const DEFAULT_CONFIG: StartAvatarRequest = {
  // Qualität entsprechend Screenshot: high
  quality: AvatarQuality.High,
  // Custom Avatar ID entsprechend Screenshot
  avatarName: CUSTOM_AVATAR_ID,
  // Keine Knowledge Base ID gesetzt
  knowledgeId: undefined,
  voice: {
    rate: 1.5,
    emotion: VoiceEmotion.EXCITED,
    model: ElevenLabsModel.eleven_flash_v2_5,
  },
  // Sprache entsprechend Screenshot: German (de)
  language: "de",
  // Transport entsprechend Screenshot: livekit
  voiceChatTransport: VoiceChatTransport.LIVEKIT,
  sttSettings: {
    provider: STTProvider.DEEPGRAM,
  },
};

type InteractiveAvatarProps = {
  fullscreen?: boolean;
};

function InteractiveAvatar({ fullscreen = false }: InteractiveAvatarProps) {
  const { initAvatar, startAvatar, stopAvatar, sessionState, stream } =
    useStreamingAvatarSession();
  const { startVoiceChat } = useVoiceChat();

  const [config] = useState<StartAvatarRequest>(DEFAULT_CONFIG);

  const mediaStream = useRef<HTMLVideoElement>(null);
  const startedOnMountRef = useRef<boolean>(false);
  const isMobile = useMediaQuery("(max-width: 639px)");

  async function fetchAccessToken() {
    try {
      const response = await fetch("/api/get-access-token", {
        method: "POST",
      });
      const token = await response.text();

      console.log("Access Token:", token); // Log the token to verify

      return token;
    } catch (error) {
      console.error("Error fetching access token:", error);
      throw error;
    }
  }

  const startSessionV2 = useMemoizedFn(async (isVoiceChat: boolean) => {
    try {
      const newToken = await fetchAccessToken();
      const avatar = initAvatar(newToken);

      avatar.on(StreamingEvents.AVATAR_START_TALKING, (e) => {
        console.log("Avatar started talking", e);
      });
      avatar.on(StreamingEvents.AVATAR_STOP_TALKING, (e) => {
        console.log("Avatar stopped talking", e);
      });
      avatar.on(StreamingEvents.STREAM_DISCONNECTED, () => {
        console.log("Stream disconnected");
      });
      avatar.on(StreamingEvents.STREAM_READY, (event) => {
        console.log(">>>>> Stream ready:", event.detail);
      });
      avatar.on(StreamingEvents.USER_START, (event) => {
        console.log(">>>>> User started talking:", event);
      });
      avatar.on(StreamingEvents.USER_STOP, (event) => {
        console.log(">>>>> User stopped talking:", event);
      });
      avatar.on(StreamingEvents.USER_END_MESSAGE, (event) => {
        console.log(">>>>> User end message:", event);
      });
      avatar.on(StreamingEvents.USER_TALKING_MESSAGE, (event) => {
        console.log(">>>>> User talking message:", event);
      });
      avatar.on(StreamingEvents.AVATAR_TALKING_MESSAGE, (event) => {
        console.log(">>>>> Avatar talking message:", event);
      });
      avatar.on(StreamingEvents.AVATAR_END_MESSAGE, (event) => {
        console.log(">>>>> Avatar end message:", event);
      });

      console.log("Starting avatar with config:", config, {
        basePath: process.env.NEXT_PUBLIC_BASE_API_URL,
      });

      await startAvatar(config);

      if (isVoiceChat) {
        await startVoiceChat();
      }
    } catch (error) {
      console.error("Error starting avatar session:", error);
      // Retry once with a known public avatar to help diagnose invalid custom IDs
      if (config.avatarName !== AVATARS[0].avatar_id) {
        const fallbackConfig = { ...config, avatarName: AVATARS[0].avatar_id };
        try {
          console.warn(
            "Retrying with public avatar to validate setup:",
            fallbackConfig.avatarName,
          );
          await startAvatar(fallbackConfig);
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

  useUnmount(() => {
    stopAvatar();
  });

  useEffect(() => {
    if (stream && mediaStream.current) {
      mediaStream.current.srcObject = stream;
      mediaStream.current.onloadedmetadata = () => {
        mediaStream.current!.play();
      };
    }
  }, [mediaStream, stream]);

  // Auto-start voice chat on first load
  useEffect(() => {
    if (!startedOnMountRef.current &&
        sessionState === StreamingAvatarSessionState.INACTIVE) {
      startedOnMountRef.current = true;
      // Start with voice chat by default
      void startSessionV2(true);
    }
  }, [sessionState, startSessionV2]);

  return (
    <div className={`w-full flex flex-col gap-4 ${fullscreen ? "h-full" : ""}`}>
      <div
        className={
          `flex flex-col overflow-hidden h-full ` +
          (fullscreen ? "bg-black rounded-none" : "rounded-xl bg-zinc-900")
        }
      >
        <div
          className={
            `relative w-full overflow-hidden flex flex-col items-center justify-center ` +
            (fullscreen ? "h-full" : "aspect-video")
          }
        >
          {sessionState !== StreamingAvatarSessionState.INACTIVE && (
            fullscreen ? (
              <div className="w-full h-full flex items-center justify-center">
                {isMobile ? (
                  <div className="relative h-full max-h-full max-w-[100vw] aspect-[9/16] bg-black">
                    <div className="absolute inset-0">
                      <AvatarVideo ref={mediaStream} fit="cover" objectPosition="35% center" />
                    </div>
                  </div>
                ) : (
                  <div className="relative w-full h-full bg-black">
                    <div className="absolute inset-0">
                      <AvatarVideo ref={mediaStream} fit="contain" objectPosition="center center" />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <AvatarVideo ref={mediaStream} />
            )
          )}
          {/* Mikro-Overlay unten mittig im Videoframe */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2">
            <MicOverlay />
          </div>
          {/* Close-Button oben rechts */}
          <div className="absolute top-3 right-3">
            <a
              href="/"
              aria-label="Schließen und zur Widget-Seite zurückkehren"
              className="h-9 w-9 rounded-full bg-white/95 text-zinc-900 shadow-lg border border-black/10 flex items-center justify-center hover:bg-white"
            >
              <span className="text-lg leading-none">×</span>
            </a>
          </div>
        </div>
        <div
          className={
            `p-4 border-t border-zinc-700 w-full ` +
            (fullscreen ? "hidden" : "flex flex-col gap-3 items-center justify-center")
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
      {sessionState === StreamingAvatarSessionState.CONNECTED && !fullscreen && (
        <MessageHistory />
      )}
    </div>
  );
}

export default function InteractiveAvatarWrapper(props: InteractiveAvatarProps) {
  return (
    <StreamingAvatarProvider basePath={process.env.NEXT_PUBLIC_BASE_API_URL}>
      <InteractiveAvatar {...props} />
    </StreamingAvatarProvider>
  );
}
