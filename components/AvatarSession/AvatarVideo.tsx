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

// Audio architecture: the previous build proved that audio data DOES reach
// the browser (Web Audio analyser saw range=146 on the track) but the
// <video> element on desktop Windows Chrome silently drops the audio output
// even when muted=false, volume=1, paused=false, setSinkId('default') and
// audio track muted=false. This is a known issue with HTMLMediaElement
// audio output on some Windows audio driver / device configurations.
//
// Solution: bypass <video> audio entirely. Keep <video> permanently muted
// (only used for picture) and route the audio MediaStreamTrack through
// Web Audio API into AudioContext.destination, which uses the system
// speaker output directly. This is the same path Web Audio uses for
// every browser sound and reliably reaches the speakers.
type WindowWithWebkitAudio = Window & {
  webkitAudioContext?: typeof AudioContext;
};

export const AvatarVideo = forwardRef<HTMLVideoElement, AvatarVideoProps>(
  ({ fit = "contain", objectPosition = "center" }, ref) => {
    const { sessionState } = useStreamingAvatarSession();
    const { connectionQuality } = useConnectionQuality();
    const { isStreamReady } = useStreamingAvatarContext();
    const { isMicrophoneReady, isVoiceChatActive, isVoiceChatLoading } =
      useVoiceChat();

    const localVideoRef = useRef<HTMLVideoElement | null>(null);
    useImperativeHandle(ref, () => localVideoRef.current as HTMLVideoElement);

    const [needsUnmute, setNeedsUnmute] = useState<boolean>(true);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const audioGainRef = useRef<GainNode | null>(null);
    const routedTrackIdRef = useRef<string | null>(null);
    const startedMutedRef = useRef<boolean>(false);

    const isVideoReady =
      sessionState === StreamingAvatarSessionState.CONNECTED && isStreamReady;

    const showVoiceStartingHint = isVideoReady && isVoiceChatLoading;
    const showMicPermissionHint =
      isVideoReady && isVoiceChatActive && !isMicrophoneReady;

    const ensureAudioContext = useCallback((): AudioContext | null => {
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        return audioCtxRef.current;
      }
      const Ctor =
        window.AudioContext ||
        (window as unknown as WindowWithWebkitAudio).webkitAudioContext;
      if (!Ctor) {
        console.error("[avatar] AudioContext not supported");
        return null;
      }
      audioCtxRef.current = new Ctor();
      console.info("[avatar] AudioContext created", {
        state: audioCtxRef.current.state,
        sampleRate: audioCtxRef.current.sampleRate,
      });
      return audioCtxRef.current;
    }, []);

    const routeAudioToSpeakers = useCallback(() => {
      const video = localVideoRef.current;
      if (!video) return false;
      const stream = video.srcObject as MediaStream | null;
      if (!stream) return false;
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) return false;
      const track = audioTracks[0];
      // Already routing this exact track? Skip — re-creating the source node
      // detaches the previous one and can introduce gaps.
      if (routedTrackIdRef.current === track.id && audioSourceRef.current) {
        return true;
      }

      const ctx = ensureAudioContext();
      if (!ctx) return false;
      if (ctx.state === "suspended") {
        void ctx.resume();
      }

      // Tear down any previous source node from a stale track.
      if (audioSourceRef.current) {
        try {
          audioSourceRef.current.disconnect();
        } catch {
          /* ignore */
        }
        audioSourceRef.current = null;
      }
      if (audioGainRef.current) {
        try {
          audioGainRef.current.disconnect();
        } catch {
          /* ignore */
        }
        audioGainRef.current = null;
      }

      try {
        track.enabled = true;
        const source = ctx.createMediaStreamSource(new MediaStream([track]));
        const gain = ctx.createGain();
        gain.gain.value = 1.0;
        source.connect(gain);
        gain.connect(ctx.destination);
        audioSourceRef.current = source;
        audioGainRef.current = gain;
        routedTrackIdRef.current = track.id;
        console.info("[avatar] audio routed to AudioContext.destination", {
          trackId: track.id,
          trackMuted: String(track.muted),
          trackEnabled: String(track.enabled),
          trackReadyState: track.readyState,
          ctxState: ctx.state,
        });
        return true;
      } catch (err) {
        console.error("[avatar] routeAudioToSpeakers failed", err);
        return false;
      }
    }, [ensureAudioContext]);

    // When the stream is ready: start muted-autoplay so the avatar is
    // visible. Audio routing happens on the user gesture in handleUnmute.
    useEffect(() => {
      const video = localVideoRef.current;
      if (!isVideoReady || !video) return;
      if (startedMutedRef.current) return;

      const tryMutedPlay = async () => {
        const stream = video.srcObject as MediaStream | null;
        if (!stream || stream.getVideoTracks().length === 0) return;
        startedMutedRef.current = true;
        // <video> is permanently muted — audio plays via Web Audio API.
        video.muted = true;
        try {
          await video.play();
          console.info("[avatar] muted autoplay ok", {
            videoTracks: stream.getVideoTracks().length,
            audioTracks: stream.getAudioTracks().length,
          });
        } catch (err) {
          console.warn("[avatar] muted autoplay failed", err);
        }
      };

      void tryMutedPlay();
      const onLoadedMetadata = () => void tryMutedPlay();
      video.addEventListener("loadedmetadata", onLoadedMetadata);
      return () => {
        video.removeEventListener("loadedmetadata", onLoadedMetadata);
      };
    }, [isVideoReady]);

    const handleUnmute = useCallback(async () => {
      console.info("[avatar] handleUnmute: user gesture received");
      const video = localVideoRef.current;
      if (!video) return;

      // Keep <video> muted forever — audio goes through Web Audio API.
      video.muted = true;
      try {
        await video.play();
      } catch {
        /* ignore */
      }

      const ctx = ensureAudioContext();
      if (ctx && ctx.state === "suspended") {
        try {
          await ctx.resume();
          console.info("[avatar] AudioContext resumed", { state: ctx.state });
        } catch (err) {
          console.warn("[avatar] AudioContext.resume() failed", err);
        }
      }

      const ok = routeAudioToSpeakers();
      if (!ok) {
        console.warn(
          "[avatar] audio routing not yet possible — will retry on track ready",
        );
      }

      setNeedsUnmute(false);
    }, [ensureAudioContext, routeAudioToSpeakers]);

    // Re-route whenever the audio track in the video element changes (e.g.
    // SDK re-attaches after reconnect). Only effective AFTER the user has
    // unmuted, since an AudioContext requires user gesture to start.
    useEffect(() => {
      if (needsUnmute) return;
      const video = localVideoRef.current;
      if (!video) return;
      routeAudioToSpeakers();
      const onLoadedMetadata = () => routeAudioToSpeakers();
      video.addEventListener("loadedmetadata", onLoadedMetadata);
      return () => {
        video.removeEventListener("loadedmetadata", onLoadedMetadata);
      };
    }, [needsUnmute, routeAudioToSpeakers, isVideoReady]);

    useEffect(() => {
      return () => {
        if (audioSourceRef.current) {
          try {
            audioSourceRef.current.disconnect();
          } catch {
            /* ignore */
          }
        }
        if (audioGainRef.current) {
          try {
            audioGainRef.current.disconnect();
          } catch {
            /* ignore */
          }
        }
        if (
          audioCtxRef.current &&
          audioCtxRef.current.state !== "closed"
        ) {
          void audioCtxRef.current.close();
        }
        audioSourceRef.current = null;
        audioGainRef.current = null;
        audioCtxRef.current = null;
        routedTrackIdRef.current = null;
      };
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
