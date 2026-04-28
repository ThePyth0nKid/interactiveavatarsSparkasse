import React, { forwardRef } from "react";
import { ConnectionQuality } from "@heygen/liveavatar-web-sdk";

import { useConnectionQuality } from "../logic/useConnectionQuality";
import { useStreamingAvatarSession } from "../logic/useStreamingAvatarSession";
import { StreamingAvatarSessionState, useStreamingAvatarContext } from "../logic";
// removed in-video close button in favor of global close in InteractiveAvatar
// import { Button } from "../Button";
import LoadingOverlay from "../LoadingOverlay";
import { useVoiceChat } from "../logic/useVoiceChat";

type AvatarVideoProps = {
  fit?: "contain" | "cover";
  objectPosition?: string; // e.g. "center" or "65% center"
};

export const AvatarVideo = forwardRef<HTMLVideoElement, AvatarVideoProps>(
  ({ fit = "contain", objectPosition = "center" }, ref) => {
  const { sessionState } = useStreamingAvatarSession();
  const { connectionQuality } = useConnectionQuality();
  const { isStreamReady } = useStreamingAvatarContext();
  const { isMicrophoneReady, isVoiceChatActive, isVoiceChatLoading } = useVoiceChat();

  // The avatar video is ready as soon as the session is connected and the
  // remote stream is attached. Voice-chat readiness is a separate concern —
  // gating the overlay on it would keep the spinner visible whenever voice
  // is intentionally off (e.g. user switched to text mode).
  const isVideoReady =
    sessionState === StreamingAvatarSessionState.CONNECTED && isStreamReady;

  // Surface a soft "voice is starting" hint only while voice chat is
  // actively coming up — never as a hard blocker.
  const showVoiceStartingHint =
    isVideoReady && isVoiceChatLoading;
  const showMicPermissionHint =
    isVideoReady && isVoiceChatActive && !isMicrophoneReady;

  return (
    <>
      {connectionQuality !== ConnectionQuality.UNKNOWN && (
        <div className="absolute top-1.5 left-1.5 bg-black/70 text-white rounded px-2 py-0.5 text-[10px] leading-none pointer-events-none select-none shadow-sm">
          {connectionQuality}
        </div>
      )}
      <video
        ref={ref}
        autoPlay
        playsInline
        style={{
          width: "100%",
          height: "100%",
          objectFit: fit,
          objectPosition,
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
