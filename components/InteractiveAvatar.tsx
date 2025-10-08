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
import { useConversationState } from "./logic/useConversationState";
import { ConnectionQuality } from "@heygen/streaming-avatar";
import { useConnectionQuality } from "./logic/useConnectionQuality";
import { useInterrupt } from "./logic/useInterrupt";
import { LoadingIcon } from "./Icons";
import { MessageHistory } from "./AvatarSession/MessageHistory";

import { AVATARS } from "@/app/lib/constants";
import { useMediaQuery } from "./logic/useMediaQuery";
import { MicOverlay } from "./AvatarSession/MicOverlay";
import { TextOverlay } from "./AvatarSession/TextOverlay";

// Read custom avatar id from environment with a safe fallback
const CUSTOM_AVATAR_ID =
  process.env.NEXT_PUBLIC_CUSTOM_AVATAR_ID ?? AVATARS[0].avatar_id;

function getPreferredAvatarId(): string {
  return CUSTOM_AVATAR_ID;
}

const DEFAULT_CONFIG: StartAvatarRequest = {
  // Qualität entsprechend Screenshot: high
  quality: AvatarQuality.High,
  // Custom Avatar ID entsprechend Screenshot / Standard (nur Alexander)
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

// Fine-tuning: horizontal position of subject within 9:16 portrait crop
// Lower than 50% verschiebt den sichtbaren Bereich nach links (Subjekt rückt nach rechts ins Bild)
const PORTRAIT_OBJECT_POSITION = "30% center";

type InteractiveAvatarProps = {
  fullscreen?: boolean;
  hideChat?: boolean;
  forcePortrait?: boolean;
};

function InteractiveAvatar({ fullscreen = false, hideChat = false, forcePortrait = false }: InteractiveAvatarProps) {
  const { initAvatar, startAvatar, stopAvatar, sessionState, stream } =
    useStreamingAvatarSession();
  const { startVoiceChat, stopVoiceChat, isVoiceChatActive, muteInputAudio, unmuteInputAudio, isVoiceChatLoading, isMicrophoneReady } = useVoiceChat();
  const { startListening, stopListening, isAvatarTalking } = useConversationState();
  const { connectionQuality } = useConnectionQuality();
  const { interrupt } = useInterrupt();

  const [config] = useState<StartAvatarRequest>(DEFAULT_CONFIG);
  const [showTextOverlay, setShowTextOverlay] = useState<boolean>(false);

  const mediaStream = useRef<HTMLVideoElement>(null);
  const startedOnMountRef = useRef<boolean>(false);
  const isMobile = useMediaQuery("(max-width: 639px)");
  const reinitInProgressRef = useRef<boolean>(false);
  const lastVoiceEventTsRef = useRef<number>(0);

  async function waitFor(predicate: () => boolean, timeoutMs = 3000, stepMs = 50): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (predicate()) return true;
      await new Promise((r) => setTimeout(r, stepMs));
    }
    return predicate();
  }

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
    const configToUse: StartAvatarRequest = { ...config, avatarName: getPreferredAvatarId() };
    try {
      const newToken = await fetchAccessToken();
      const avatar = initAvatar(newToken);

      // Event-Handler werden zentral in useStreamingAvatarSession.ts verwaltet
      // State-Updates für isAvatarTalking lösen useEffect aus (siehe unten)
      avatar.on(StreamingEvents.STREAM_DISCONNECTED, () => {
        console.log("Stream disconnected");
      });
      avatar.on(StreamingEvents.STREAM_READY, (event) => {
        console.log(">>>>> Stream ready:", event.detail);
      });
      avatar.on(StreamingEvents.USER_START, (event) => {
        console.log(">>>>> User started talking:", event);
        lastVoiceEventTsRef.current = Date.now();
      });
      avatar.on(StreamingEvents.USER_STOP, (event) => {
        console.log(">>>>> User stopped talking:", event);
      });
      avatar.on(StreamingEvents.USER_END_MESSAGE, (event) => {
        console.log(">>>>> User end message:", event);
      });
      avatar.on(StreamingEvents.USER_TALKING_MESSAGE, (event) => {
        console.log(">>>>> User talking message:", event);
        lastVoiceEventTsRef.current = Date.now();
      });
      avatar.on(StreamingEvents.AVATAR_TALKING_MESSAGE, (event) => {
        console.log(">>>>> Avatar talking message:", event);
      });
      avatar.on(StreamingEvents.AVATAR_END_MESSAGE, (event) => {
        console.log(">>>>> Avatar end message:", event);
      });
      console.log("Starting avatar with config:", configToUse, {
        basePath: process.env.NEXT_PUBLIC_BASE_API_URL,
      });

      await startAvatar(configToUse);

      if (isVoiceChat) {
        await startVoiceChat();
      }
    } catch (error) {
      console.error("Error starting avatar session:", error);
      // Retry once with a known public avatar to help diagnose invalid custom IDs
      if (configToUse.avatarName !== AVATARS[0].avatar_id) {
        const fallbackConfig = { ...configToUse, avatarName: AVATARS[0].avatar_id };
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

  // Robust re-init of voice transport if switching back from text fails
  const ensureVoiceOperational = useMemoizedFn(async () => {
    if (reinitInProgressRef.current) return;
    reinitInProgressRef.current = true;
    try {
      // kurze Wartezeit
      await new Promise((r) => setTimeout(r, 700));
      const noUserEventRecently = Date.now() - lastVoiceEventTsRef.current > 2000;
      const badConn = connectionQuality === ConnectionQuality.BAD || connectionQuality === ConnectionQuality.UNKNOWN;
      if (badConn || noUserEventRecently) {
        // 1) versuche Voice-Transport neu zu starten
        await stopVoiceChat();
        await new Promise((r) => setTimeout(r, 250));
        await startVoiceChat(false);
        unmuteInputAudio();
        startListening();
        await new Promise((r) => setTimeout(r, 700));
        if (Date.now() - lastVoiceEventTsRef.current > 2000) {
          // 2) harter Reset: Avatar-Stream neu aufbauen
          if ([StreamingAvatarSessionState.CONNECTED, StreamingAvatarSessionState.CONNECTING].includes(sessionState)) {
            await stopAvatar();
            await waitFor(() => [StreamingAvatarSessionState.INACTIVE].includes(sessionState), 4000, 50);
          }
          // Nur starten, wenn wirklich INACTIVE
          if ([StreamingAvatarSessionState.INACTIVE].includes(sessionState)) {
            await startAvatar(config);
            await waitFor(() => [StreamingAvatarSessionState.CONNECTED].includes(sessionState), 4000, 50);
            await startVoiceChat(false);
            unmuteInputAudio();
            startListening();
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
    // Close overlay and bring voice back reliably
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

  // Listening-Steuerung basierend auf Avatar-Sprechstatus
  useEffect(() => {
    console.log('[Listening Control] isAvatarTalking:', isAvatarTalking, 'isVoiceChatActive:', isVoiceChatActive, 'showTextOverlay:', showTextOverlay);
    
    if (isAvatarTalking) {
      // Avatar spricht -> Listening stoppen UND Mikrofon muten um Unterbrechungen zu verhindern
      console.log('[Listening Control] Avatar started talking - STOPPING listening + MUTING audio');
      stopListening();
      muteInputAudio();
    } else if (isVoiceChatActive && !showTextOverlay) {
      // Avatar fertig + Voice Chat aktiv + kein Text-Overlay -> Listening reaktivieren UND Mikrofon unmuten
      console.log('[Listening Control] Avatar stopped talking - STARTING listening + UNMUTING audio');
      startListening();
      unmuteInputAudio();
    }
  }, [isAvatarTalking, isVoiceChatActive, showTextOverlay, stopListening, startListening, muteInputAudio, unmuteInputAudio]);

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
    <div className={`w-full flex flex-col gap-4 ${fullscreen || forcePortrait ? "h-full" : ""}`}>
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
          {sessionState !== StreamingAvatarSessionState.INACTIVE && (
            fullscreen ? (
              <div className="w-full h-full flex items-center justify-center">
                {isMobile ? (
                  <div className="relative h-full max-h-full max-w-[100vw] aspect-[9/16] bg-black">
                    <div className="absolute inset-0">
                      <AvatarVideo ref={mediaStream} fit="cover" objectPosition={PORTRAIT_OBJECT_POSITION} />
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
            ) : forcePortrait ? (
              <div className="relative w-full h-full bg-black">
                <div className="absolute inset-0">
                  <AvatarVideo ref={mediaStream} fit="cover" objectPosition={PORTRAIT_OBJECT_POSITION} />
                </div>
              </div>
            ) : (
              <AvatarVideo ref={mediaStream} />
            )
          )}
          {/* Bottom controls: Interrupt + Mic zentriert, TextChat toggle rechts */}
          <div className="absolute bottom-5 inset-x-0 flex items-center justify-center gap-3 px-3">
            {/* Linker Spacer für Balance */}
            <div className="flex-1" />
            
            {/* Zentrierter Bereich: Interrupt-Button + Mikrofon */}
            <div className="flex items-center gap-3">
              {/* Interrupt-Button (nur wenn Avatar spricht und kein Text-Overlay) */}
              {!showTextOverlay && sessionState === StreamingAvatarSessionState.CONNECTED && (
                <button
                  onClick={interrupt}
                  disabled={!isAvatarTalking}
                  className="h-10 rounded-full bg-[#E60000] text-white shadow-lg border border-black/10 px-4 text-sm font-medium hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                  aria-label="Avatar unterbrechen"
                >
                  Unterbrechen
                </button>
              )}
              {/* Mikrofon zentriert */}
              {!showTextOverlay && <MicOverlay />}
            </div>
            
            {/* Rechter Spacer + Text/Voice Toggle */}
            <div className="flex-1 flex justify-end">
              <button
                disabled={isVoiceChatLoading}
                onClick={async () => {
                  if (showTextOverlay) {
                    // Wechsel zu Voice
                    setShowTextOverlay(false);
                    // Start Voice-Chat erneut (gleiche Session)
                    try {
                      // Mini-Delay, um den Transport vom Text-Modus zu lösen
                      await new Promise((r) => setTimeout(r, 100));
                      await startVoiceChat(false);
                      // Sicherheitshalber explizit entmuten
                      unmuteInputAudio();
                      // Listening aktivieren, damit USER_START/STOP Events kommen
                      startListening();
                      // Nachlauf-Check
                      void ensureVoiceOperational();
                    } catch (e) {
                      console.error("Start voice chat failed:", e);
                    }
                  } else {
                    // Wechsel zu Text: Voice sofort stoppen, damit nichts mehr mithört
                    if (isVoiceChatActive) {
                      await stopVoiceChat();
                      // kurze Abkühlzeit, damit Transport sauber schließt
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

          {showTextOverlay && (
            <TextOverlay onClose={resumeVoiceFromOverlay} />
          )}
          {/* Close-Button oben rechts (nur im Vollbild/berater) */}
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
            (fullscreen || hideChat ? "hidden" : "flex flex-col gap-3 items-center justify-center")
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
      {sessionState === StreamingAvatarSessionState.CONNECTED && !fullscreen && !hideChat && (
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
