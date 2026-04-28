import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
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

export const AvatarVideo = forwardRef<HTMLVideoElement, AvatarVideoProps>(
  ({ fit = "contain", objectPosition = "center" }, ref) => {
    const { sessionState } = useStreamingAvatarSession();
    const { connectionQuality } = useConnectionQuality();
    const { isStreamReady } = useStreamingAvatarContext();
    const { isMicrophoneReady, isVoiceChatActive, isVoiceChatLoading } = useVoiceChat();

    const localVideoRef = useRef<HTMLVideoElement | null>(null);
    useImperativeHandle(ref, () => localVideoRef.current as HTMLVideoElement);

    // Start muted so Chromium/Edge autoplay policy never blocks playback.
    // Unmute on first user gesture (click on the video area or on the badge).
    const [isAudioMuted, setIsAudioMuted] = useState<boolean>(true);

    const isVideoReady =
      sessionState === StreamingAvatarSessionState.CONNECTED && isStreamReady;

    const showVoiceStartingHint = isVideoReady && isVoiceChatLoading;
    const showMicPermissionHint =
      isVideoReady && isVoiceChatActive && !isMicrophoneReady;

    const unmuteAudio = useCallback(() => {
      const video = localVideoRef.current;
      if (!video) return;
      video.muted = false;
      void video.play().catch((err) => {
        console.warn("[avatar] unmute play() failed:", err);
      });
      setIsAudioMuted(false);
    }, []);

    // Diagnostic: log audio track presence and playback state once the
    // remote stream is attached. This helps distinguish autoplay-block
    // from missing-track on the server side.
    useEffect(() => {
      const video = localVideoRef.current;
      if (!isVideoReady || !video) return;

      const stream = video.srcObject as MediaStream | null;
      const audioTracks = stream?.getAudioTracks() ?? [];
      const videoTracks = stream?.getVideoTracks() ?? [];
      console.info("[avatar] stream attached", {
        muted: video.muted,
        volume: video.volume,
        paused: video.paused,
        audioTracks: audioTracks.length,
        videoTracks: videoTracks.length,
        audioEnabled: audioTracks.map((t) => t.enabled),
      });

      const onPlay = () => console.info("[avatar] <video> play");
      const onPause = () => console.info("[avatar] <video> pause");
      const onVolumeChange = () =>
        console.info("[avatar] <video> volumechange", {
          muted: video.muted,
          volume: video.volume,
        });
      video.addEventListener("play", onPlay);
      video.addEventListener("pause", onPause);
      video.addEventListener("volumechange", onVolumeChange);
      return () => {
        video.removeEventListener("play", onPlay);
        video.removeEventListener("pause", onPause);
        video.removeEventListener("volumechange", onVolumeChange);
      };
    }, [isVideoReady]);

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
          muted={isAudioMuted}
          onClick={isAudioMuted ? unmuteAudio : undefined}
          style={{
            width: "100%",
            height: "100%",
            objectFit: fit,
            objectPosition,
            cursor: isAudioMuted && isVideoReady ? "pointer" : "default",
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
        {isVideoReady && isAudioMuted && (
          <button
            type="button"
            onClick={unmuteAudio}
            aria-label="Ton aktivieren"
            className="absolute top-3 right-3 z-10 bg-black/75 hover:bg-black/85 text-white text-xs rounded-full px-3 py-1.5 shadow-lg border border-white/15 flex items-center gap-1.5 backdrop-blur-sm"
          >
            <svg
              width="14"
              height="14"
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
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
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
