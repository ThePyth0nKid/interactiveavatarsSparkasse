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
  onAudioReady?: () => void;
}

// Audio architecture (after researching LiveKit + webrtchacks):
// Chromium has a documented quirk where createMediaStreamSource(remoteTrack)
// emits silence unless an HTMLMediaElement is ALSO consuming that exact
// MediaStreamTrack — the WebRTC audio render path is only "pumped" by media
// elements, not by AudioContext. Our <video> is muted (necessary for
// autoplay), so Web Audio API alone gets silence.
//
// Solution: a dedicated <audio> element receives an audio-only MediaStream
// built from the remote audio track. The <video> stays muted (picture only).
// On the user's gesture we set audio.muted = false and await audio.play().
// This is the canonical LiveKit pattern (RemoteAudioTrack.attach()).
export const AvatarVideo = forwardRef<HTMLVideoElement, AvatarVideoProps>(
  ({ fit = "contain", objectPosition = "center", onAudioReady }, ref) => {
    const { sessionState } = useStreamingAvatarSession();
    const { connectionQuality } = useConnectionQuality();
    const { isStreamReady } = useStreamingAvatarContext();
    const { isMicrophoneReady, isVoiceChatActive, isVoiceChatLoading } =
      useVoiceChat();

    const localVideoRef = useRef<HTMLVideoElement | null>(null);
    const audioElRef = useRef<HTMLAudioElement | null>(null);
    useImperativeHandle(ref, () => localVideoRef.current as HTMLVideoElement);

    const [needsUnmute, setNeedsUnmute] = useState<boolean>(true);
    const startedMutedRef = useRef<boolean>(false);
    const routedTrackIdRef = useRef<string | null>(null);
    const audioReadyFiredRef = useRef<boolean>(false);

    const isVideoReady =
      sessionState === StreamingAvatarSessionState.CONNECTED && isStreamReady;

    const showVoiceStartingHint = isVideoReady && isVoiceChatLoading;
    const showMicPermissionHint =
      isVideoReady && isVoiceChatActive && !isMicrophoneReady;

    const attachAudioToElement = useCallback((): boolean => {
      const video = localVideoRef.current;
      const audioEl = audioElRef.current;
      if (!video || !audioEl) return false;
      const stream = video.srcObject as MediaStream | null;
      if (!stream) return false;
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) return false;
      const track = audioTracks[0];

      if (routedTrackIdRef.current === track.id) {
        return true;
      }

      try {
        track.enabled = true;
        const audioOnlyStream = new MediaStream([track]);
        audioEl.srcObject = audioOnlyStream;
        audioEl.volume = 1.0;
        routedTrackIdRef.current = track.id;
        console.info("[avatar] audio attached to <audio> element", {
          trackId: track.id,
          trackMuted: String(track.muted),
          trackEnabled: String(track.enabled),
          trackReadyState: track.readyState,
        });
        return true;
      } catch (err) {
        console.error("[avatar] attachAudioToElement failed", err);
        return false;
      }
    }, []);

    // When the stream is ready: attach audio track to dedicated <audio>
    // element AND start muted-autoplay on <video> for the picture.
    useEffect(() => {
      const video = localVideoRef.current;
      if (!isVideoReady || !video) return;

      const tryStart = async () => {
        const stream = video.srcObject as MediaStream | null;
        if (!stream || stream.getVideoTracks().length === 0) return;

        attachAudioToElement();

        if (!startedMutedRef.current) {
          startedMutedRef.current = true;
          video.muted = true;
          try {
            await video.play();
            console.info("[avatar] muted video autoplay ok", {
              videoTracks: stream.getVideoTracks().length,
              audioTracks: stream.getAudioTracks().length,
            });
          } catch (err) {
            console.warn("[avatar] muted video autoplay failed", err);
          }
        }
      };

      void tryStart();
      const onLoadedMetadata = () => void tryStart();
      video.addEventListener("loadedmetadata", onLoadedMetadata);
      return () => {
        video.removeEventListener("loadedmetadata", onLoadedMetadata);
      };
    }, [isVideoReady, attachAudioToElement]);

    // Re-attach when the audio track changes (SDK can re-publish).
    useEffect(() => {
      if (!isVideoReady) return;
      const video = localVideoRef.current;
      if (!video) return;
      const onLoadedMetadata = () => attachAudioToElement();
      video.addEventListener("loadedmetadata", onLoadedMetadata);
      return () => {
        video.removeEventListener("loadedmetadata", onLoadedMetadata);
      };
    }, [isVideoReady, attachAudioToElement]);

    const handleUnmute = useCallback(async () => {
      console.info("[avatar] handleUnmute: user gesture received");
      const video = localVideoRef.current;
      const audioEl = audioElRef.current;
      if (!video || !audioEl) return;

      // Make sure audio track is attached.
      attachAudioToElement();

      // <video> stays muted forever — picture only.
      video.muted = true;
      try {
        await video.play();
      } catch {
        /* ignore */
      }

      // <audio> carries the speech.
      audioEl.muted = false;
      audioEl.volume = 1.0;
      try {
        if (typeof (audioEl as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }).setSinkId === "function") {
          await (audioEl as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> }).setSinkId("");
        }
      } catch (err) {
        console.warn("[avatar] setSinkId failed (non-fatal)", err);
      }
      try {
        await audioEl.play();
        console.info("[avatar] <audio> play() ok", {
          muted: String(audioEl.muted),
          volume: String(audioEl.volume),
          paused: String(audioEl.paused),
          readyState: audioEl.readyState,
          currentTime: audioEl.currentTime,
        });
      } catch (err) {
        console.error("[avatar] <audio> play() failed", err);
      }

      setNeedsUnmute(false);

      if (!audioReadyFiredRef.current) {
        audioReadyFiredRef.current = true;
        onAudioReady?.();
      }
    }, [attachAudioToElement, onAudioReady]);

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
          muted
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
        <audio
          ref={audioElRef}
          autoPlay
          playsInline
          muted
          style={{ display: "none" }}
        >
          <track kind="captions" />
        </audio>
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
          <div
            className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 cursor-pointer"
            onClick={handleUnmute}
            role="button"
            tabIndex={0}
            aria-label="Ton aktivieren"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                void handleUnmute();
              }
            }}
          >
            <div className="bg-white/95 hover:bg-white text-zinc-900 text-base rounded-full px-6 py-3 shadow-2xl border border-black/10 flex items-center gap-3 font-medium">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
              <span>Klicken, um zu starten</span>
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
