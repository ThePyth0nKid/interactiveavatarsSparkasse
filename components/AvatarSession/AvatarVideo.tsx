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

// LiveKit's track.attach() routes audio + video into one MediaStream on the
// <video> element. Two complications on Chromium desktop:
//  1) <video muted> is required for autoplay before the user has gestured.
//     If we mute the video, we also mute the audio that lives inside it.
//  2) React's controlled `muted` prop fights LiveKit's attachToElement(),
//     which sets `element.muted = audioTracks.length === 0`. The result is
//     a flicker that often leaves the element silently muted.
// Fix: render a dedicated <audio> element, mirror only the audio tracks
// onto it, and keep the <video> element permanently muted. The audio
// element starts muted (so autoplay never blocks) and we unmute it
// imperatively on the first user gesture.
export const AvatarVideo = forwardRef<HTMLVideoElement, AvatarVideoProps>(
  ({ fit = "contain", objectPosition = "center" }, ref) => {
    const { sessionState } = useStreamingAvatarSession();
    const { connectionQuality } = useConnectionQuality();
    const { isStreamReady } = useStreamingAvatarContext();
    const { isMicrophoneReady, isVoiceChatActive, isVoiceChatLoading } =
      useVoiceChat();

    const localVideoRef = useRef<HTMLVideoElement | null>(null);
    const localAudioRef = useRef<HTMLAudioElement | null>(null);
    useImperativeHandle(ref, () => localVideoRef.current as HTMLVideoElement);

    const [isAudioMuted, setIsAudioMuted] = useState<boolean>(true);
    const [isAudioRouted, setIsAudioRouted] = useState<boolean>(false);

    const isVideoReady =
      sessionState === StreamingAvatarSessionState.CONNECTED && isStreamReady;

    const showVoiceStartingHint = isVideoReady && isVoiceChatLoading;
    const showMicPermissionHint =
      isVideoReady && isVoiceChatActive && !isMicrophoneReady;

    const routeAudio = useCallback(() => {
      const video = localVideoRef.current;
      const audio = localAudioRef.current;
      if (!video || !audio) return false;
      const stream = video.srcObject as MediaStream | null;
      if (!stream) return false;
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) return false;

      const audioStream = new MediaStream(audioTracks);
      audio.srcObject = audioStream;
      audio.muted = true;
      audio.play().catch((err) => {
        console.warn("[avatar] <audio> play() failed", {
          name: err?.name,
          message: err?.message,
        });
      });
      console.info("[avatar] audio routed to dedicated <audio>", {
        audioTracks: audioTracks.length,
        trackEnabled: audioTracks.map((t) => t.enabled),
        trackMuted: audioTracks.map((t) => t.muted),
        trackReadyState: audioTracks.map((t) => t.readyState),
      });
      return true;
    }, []);

    // Try to route audio whenever the video starts playing, since LiveKit
    // sets srcObject inside attachToElement(). Retry on `playing` and
    // `loadedmetadata` to handle race conditions between parent/child
    // useEffect ordering.
    useEffect(() => {
      const video = localVideoRef.current;
      if (!isVideoReady || !video) return;

      if (routeAudio()) {
        setIsAudioRouted(true);
      }

      const tryRoute = () => {
        if (routeAudio()) setIsAudioRouted(true);
      };
      video.addEventListener("loadedmetadata", tryRoute);
      video.addEventListener("playing", tryRoute);
      video.addEventListener("play", tryRoute);

      return () => {
        video.removeEventListener("loadedmetadata", tryRoute);
        video.removeEventListener("playing", tryRoute);
        video.removeEventListener("play", tryRoute);
      };
    }, [isVideoReady, routeAudio]);

    const unmuteAudio = useCallback(() => {
      const audio = localAudioRef.current;
      if (!audio) return;
      // Best-effort re-route in case the user clicked before the audio
      // tracks were attached.
      if (!audio.srcObject) routeAudio();
      audio.muted = false;
      audio.play().catch((err) => {
        console.warn("[avatar] <audio> unmute play() failed", {
          name: err?.name,
          message: err?.message,
        });
      });
      setIsAudioMuted(false);
      console.info("[avatar] user unmuted audio");
    }, [routeAudio]);

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
          muted
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
        <audio ref={localAudioRef} autoPlay playsInline />
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
        {isVideoReady && isAudioRouted === false && !isAudioMuted && (
          <div className="absolute top-3 right-3 z-10 pointer-events-none">
            <div className="bg-black/70 text-white text-xs rounded-full px-3 py-1 shadow-lg border border-white/10">
              Audio wird vorbereitet…
            </div>
          </div>
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
