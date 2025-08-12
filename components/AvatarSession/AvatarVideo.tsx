import React, { forwardRef } from "react";
import { ConnectionQuality } from "@heygen/streaming-avatar";

import { useConnectionQuality } from "../logic/useConnectionQuality";
import { useStreamingAvatarSession } from "../logic/useStreamingAvatarSession";
import { StreamingAvatarSessionState } from "../logic";
// removed in-video close button in favor of global close in InteractiveAvatar
// import { Button } from "../Button";
import LoadingOverlay from "../LoadingOverlay";

type AvatarVideoProps = {
  fit?: "contain" | "cover";
  objectPosition?: string; // e.g. "center" or "65% center"
};

export const AvatarVideo = forwardRef<HTMLVideoElement, AvatarVideoProps>(
  ({ fit = "contain", objectPosition = "center" }, ref) => {
  const { sessionState, stopAvatar } = useStreamingAvatarSession();
  const { connectionQuality } = useConnectionQuality();

  const isLoaded = sessionState === StreamingAvatarSessionState.CONNECTED;

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
      {!isLoaded && <LoadingOverlay />}
    </>
  );
  },
);
AvatarVideo.displayName = "AvatarVideo";
