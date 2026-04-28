import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { ConnectionQuality } from "@heygen/liveavatar-web-sdk";

import { useConnectionQuality } from "../logic/useConnectionQuality";
import { useStreamingAvatarSession } from "../logic/useStreamingAvatarSession";
import { StreamingAvatarSessionState, useStreamingAvatarContext } from "../logic";
import LoadingOverlay from "../LoadingOverlay";
import { useVoiceChat } from "../logic/useVoiceChat";

type AvatarVideoProps = {
  fit?: "contain" | "cover";
  objectPosition?: string;
};

// Single <video> element. The SDK's `session.attach(video)` calls
// `videoTrack.attach()` and `audioTrack.attach()` on the same element, which
// LiveKit handles correctly: it merges both MediaStreamTracks into srcObject
// and sets `element.muted = false` (because audio is present). We never set a
// React `muted` prop — that fights LiveKit's imperative mutation. We try
// unmuted autoplay first; if Chromium's autoplay policy blocks, we fall back
// to muted autoplay and surface an "Ton aktivieren" button.
export const AvatarVideo = forwardRef<HTMLVideoElement, AvatarVideoProps>(
  ({ fit = "contain", objectPosition = "center" }, ref) => {
    const { sessionState } = useStreamingAvatarSession();
    const { connectionQuality } = useConnectionQuality();
    const { isStreamReady } = useStreamingAvatarContext();
    const { isMicrophoneReady, isVoiceChatActive, isVoiceChatLoading } =
      useVoiceChat();

    const localVideoRef = useRef<HTMLVideoElement | null>(null);
    useImperativeHandle(ref, () => localVideoRef.current as HTMLVideoElement);

    const [needsUnmute, setNeedsUnmute] = useState<boolean>(false);

    const isVideoReady =
      sessionState === StreamingAvatarSessionState.CONNECTED && isStreamReady;

    const showVoiceStartingHint = isVideoReady && isVoiceChatLoading;
    const showMicPermissionHint =
      isVideoReady && isVoiceChatActive && !isMicrophoneReady;

    const playUnmuted = useCallback(async (video: HTMLVideoElement) => {
      video.muted = false;
      video.volume = 1;
      await video.play();
    }, []);

    const playMuted = useCallback(async (video: HTMLVideoElement) => {
      video.muted = true;
      await video.play();
    }, []);

    useEffect(() => {
      const video = localVideoRef.current;
      if (!isVideoReady || !video) return;

      let cancelled = false;
      const start = async () => {
        try {
          await playUnmuted(video);
          if (!cancelled) setNeedsUnmute(false);
        } catch {
          if (cancelled) return;
          // Autoplay policy blocked unmuted playback — fall back to muted
          // autoplay so the avatar is at least visible, then prompt the user
          // for the gesture needed to unmute.
          try {
            await playMuted(video);
          } catch {
            /* even muted autoplay can fail in unusual contexts */
          }
          if (!cancelled) setNeedsUnmute(true);
        }
      };

      void start();

      const onLoadedMetadata = () => void start();
      video.addEventListener("loadedmetadata", onLoadedMetadata);

      return () => {
        cancelled = true;
        video.removeEventListener("loadedmetadata", onLoadedMetadata);
      };
    }, [isVideoReady, playUnmuted, playMuted]);

    const handleUnmute = useCallback(() => {
      const video = localVideoRef.current;
      if (!video) return;
      // User gesture is now provided — unmuted play() is allowed.
      video.muted = false;
      video.volume = 1;
      void video.play().catch(() => {
        /* ignore — overlay stays visible if it really fails */
      });
      setNeedsUnmute(false);
    }, []);

    return (
      <>
        {connectionQuality !== ConnectionQuality.UNKNOWN && (
          <div className="absolute top-1.5 left-1.5 bg-black/70 text-white rounded px-2 py-0.5 text-[10px] leading-none pointer-events-none select-none shadow-sm">
            {connectionQuality}
          </div>
        )}
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          onClick={needsUnmute ? handleUnmute : undefined}
          style={{
            width: "100%",
            height: "100%",
            objectFit: fit,
            objectPosition,
            cursor: needsUnmute && isVideoReady ? "pointer" : "default",
          }}
        >
          <track kind="captions" />
        </video>
        {!isVideoReady && (
          <LoadingOverlay
            message={
              sessionState === StreamingAvatarSessionState.CONNECTING
                ? "Avatar wird geladen..."
                : "Verbindung wird hergestellt..."
            }
            subMessage={
              sessionState === StreamingAvatarSessionState.CONNECTING
                ? "Verbindung wird hergestellt…"
                : "Stream wird vorbereitet…"
            }
          />
        )}
        {isVideoReady && needsUnmute && (
          <button
            type="button"
            onClick={handleUnmute}
            aria-label="Ton aktivieren"
            className="absolute top-3 right-3 z-10 bg-black/85 hover:bg-black text-white text-sm rounded-full px-4 py-2 shadow-lg border border-white/20 flex items-center gap-2 backdrop-blur-sm font-medium animate-pulse"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M11 5L6 9H2v6h4l5 4V5z" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
            <span>Ton aktivieren</span>
          </button>
        )}
        {isVideoReady && (showVoiceStartingHint || showMicPermissionHint) && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
            <div className="bg-black/70 text-white text-xs rounded-full px-3 py-1 shadow-lg border border-white/10">
              {showMicPermissionHint
                ? "Mikrofon-Zugriff erforderlich"
                : "Mikrofon wird vorbereitet…"}
            </div>
          </div>
        )}
      </>
    );
  },
);
AvatarVideo.displayName = "AvatarVideo";
