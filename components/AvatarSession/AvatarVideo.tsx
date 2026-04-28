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

interface AvatarVideoProps {
  fit?: "contain" | "cover";
  objectPosition?: string;
}

// Single <video> element. The SDK's `session.attach(video)` calls
// `videoTrack.attach()` and `audioTrack.attach()` synchronously on the same
// element. LiveKit merges both tracks into srcObject and sets
// `element.muted = false` (because audio is present). We never set a React
// `muted` prop — that fights LiveKit's imperative mutation.
//
// Playback strategy: we only call play() once srcObject contains an audio
// track (i.e. attach has run). First we try unmuted; if Chromium's autoplay
// policy blocks, we fall back to muted autoplay and surface a "Ton
// aktivieren" button that calls play() inside a real user gesture.
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
    const playingUnmutedRef = useRef<boolean>(false);

    const isVideoReady =
      sessionState === StreamingAvatarSessionState.CONNECTED && isStreamReady;

    const showVoiceStartingHint = isVideoReady && isVoiceChatLoading;
    const showMicPermissionHint =
      isVideoReady && isVoiceChatActive && !isMicrophoneReady;

    const tryPlay = useCallback(async () => {
      const video = localVideoRef.current;
      if (!video) return;
      const stream = video.srcObject as MediaStream | null;
      const audioTracks = stream?.getAudioTracks() ?? [];
      if (!stream || audioTracks.length === 0) {
        // attach() has not run yet, or audio track missing. Skip — we'll
        // retry on loadedmetadata / canplay.
        return;
      }

      if (playingUnmutedRef.current && !video.paused && !video.muted) {
        return;
      }

      video.muted = false;
      video.volume = 1;

      try {
        await video.play();
        playingUnmutedRef.current = !video.muted;
        console.info("[avatar] play() ok", {
          muted: String(video.muted),
          volume: String(video.volume),
          paused: String(video.paused),
          audioTrackId: audioTracks[0]?.id,
          audioTrackMuted: String(audioTracks[0]?.muted),
          audioTrackEnabled: String(audioTracks[0]?.enabled),
          audioTrackReadyState: audioTracks[0]?.readyState,
        });
        setNeedsUnmute(false);
      } catch (err) {
        console.warn("[avatar] unmuted play() blocked", {
          name: (err as Error)?.name,
          message: (err as Error)?.message,
        });
        // Fall back to muted autoplay so video is visible, and prompt for
        // the user gesture needed to unmute.
        video.muted = true;
        try {
          await video.play();
        } catch (err2) {
          console.error("[avatar] muted play() also failed", err2);
        }
        playingUnmutedRef.current = false;
        setNeedsUnmute(true);
      }
    }, []);

    useEffect(() => {
      const video = localVideoRef.current;
      if (!isVideoReady || !video) return;

      // Attempt immediately in case attach already ran.
      void tryPlay();

      const onLoadedMetadata = () => {
        const stream = video.srcObject as MediaStream | null;
        console.info("[avatar] loadedmetadata", {
          videoTracks: stream?.getVideoTracks().length ?? 0,
          audioTracks: stream?.getAudioTracks().length ?? 0,
        });
        void tryPlay();
      };
      const onCanPlay = () => void tryPlay();
      const onPlaying = () => {
        const stream = video.srcObject as MediaStream | null;
        const audioTrack = stream?.getAudioTracks()[0];
        console.info("[avatar] playing event", {
          muted: String(video.muted),
          volume: String(video.volume),
          audioTrackMuted: String(audioTrack?.muted),
        });
      };

      video.addEventListener("loadedmetadata", onLoadedMetadata);
      video.addEventListener("canplay", onCanPlay);
      video.addEventListener("playing", onPlaying);

      return () => {
        video.removeEventListener("loadedmetadata", onLoadedMetadata);
        video.removeEventListener("canplay", onCanPlay);
        video.removeEventListener("playing", onPlaying);
      };
    }, [isVideoReady, tryPlay]);

    const handleUnmute = useCallback(() => {
      const video = localVideoRef.current;
      if (!video) return;
      // We are inside a user gesture handler — unmuted play() will be
      // permitted regardless of autoplay policy / MEI score.
      video.muted = false;
      video.volume = 1;
      video
        .play()
        .then(() => {
          playingUnmutedRef.current = true;
          console.info("[avatar] user-gesture unmute play() ok");
          setNeedsUnmute(false);
        })
        .catch((err) => {
          console.error("[avatar] user-gesture unmute play() failed", err);
        });
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
