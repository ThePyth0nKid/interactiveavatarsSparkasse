import React, { forwardRef } from "react";
import { ConnectionQuality } from "@heygen/streaming-avatar";

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
  const { sessionState, stopAvatar } = useStreamingAvatarSession();
  const { connectionQuality } = useConnectionQuality();
  const { isFullyReady } = useStreamingAvatarContext();
  const { isMicrophoneReady, isVoiceChatActive, isVoiceChatLoading } = useVoiceChat();

  // Show loading until everything is truly ready
  const isLoaded = isFullyReady;

  return (
    <>
      {connectionQuality !== ConnectionQuality.UNKNOWN && (
        <div className="absolute top-1.5 left-1.5 bg-black/70 text-white rounded px-2 py-0.5 text-[10px] leading-none pointer-events-none select-none shadow-sm">
          {connectionQuality}
        </div>
      )}
      {/* In-Video Close removed */}
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
      {!isLoaded && (
        <LoadingOverlay 
          message={
            sessionState === StreamingAvatarSessionState.CONNECTING 
              ? "Avatar wird geladen..." 
              : sessionState === StreamingAvatarSessionState.CONNECTED && isVoiceChatLoading
                ? "Mikrofon wird vorbereitet..."
                : sessionState === StreamingAvatarSessionState.CONNECTED && !isMicrophoneReady && isVoiceChatActive
                  ? "Mikrofon-Zugriff erforderlich"
                  : sessionState === StreamingAvatarSessionState.CONNECTED && isMicrophoneReady && !isFullyReady
                    ? "Berater wird vorbereitet..."
                    : "Avatar wird geladen..."
          }
          subMessage={
            sessionState === StreamingAvatarSessionState.CONNECTING 
              ? "Verbindung wird hergestellt…" 
              : sessionState === StreamingAvatarSessionState.CONNECTED && isVoiceChatLoading
                ? "Audio-Verbindung wird aufgebaut…"
                : sessionState === StreamingAvatarSessionState.CONNECTED && !isMicrophoneReady && isVoiceChatActive
                  ? "Bitte erlauben Sie den Mikrofon-Zugriff für die Sprachfunktion"
                  : sessionState === StreamingAvatarSessionState.CONNECTED && isMicrophoneReady && !isFullyReady
                    ? "Finalisierung läuft…"
                    : "Verbindung wird hergestellt…"
          }
        />
      )}
    </>
  );
  },
);
AvatarVideo.displayName = "AvatarVideo";
