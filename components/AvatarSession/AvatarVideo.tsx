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

// Strategy: NEVER trust autoplay-with-sound on desktop Chromium. Even when
// `play()` resolves and `video.muted=false`, the browser can silently route
// audio to a null sink if the page lacks user activation (low MEI score in
// incognito, no prior interaction). We therefore always start muted, always
// require a user gesture to unmute, and on the unmute gesture we additionally:
//   - resume any suspended AudioContext (Web Audio API path)
//   - call setSinkId('default') to route around Windows "Communications
//     Device" mis-routing (the most common no-audio-on-desktop bug)
//   - start a Web Audio analyser on the audio track to confirm data flow
//
// If audioLevel never goes above silence after unmute, we know the server
// is not actually sending audio bytes (vs. a routing issue) and surface
// that to the user.
type WindowWithWebkitAudio = Window & {
  webkitAudioContext?: typeof AudioContext;
};

type VideoWithSinkId = HTMLVideoElement & {
  setSinkId?: (sinkId: string) => Promise<void>;
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
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const audioLevelTimerRef = useRef<number | null>(null);
    const startedMutedRef = useRef<boolean>(false);

    const isVideoReady =
      sessionState === StreamingAvatarSessionState.CONNECTED && isStreamReady;

    const showVoiceStartingHint = isVideoReady && isVoiceChatLoading;
    const showMicPermissionHint =
      isVideoReady && isVoiceChatActive && !isMicrophoneReady;

    const stopAudioMonitor = useCallback(() => {
      if (audioLevelTimerRef.current !== null) {
        window.clearInterval(audioLevelTimerRef.current);
        audioLevelTimerRef.current = null;
      }
      analyserRef.current?.disconnect();
      analyserRef.current = null;
    }, []);

    const startAudioMonitor = useCallback((stream: MediaStream) => {
      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) {
        console.warn("[avatar] audio monitor: no audio track on stream");
        return;
      }
      try {
        if (!audioContextRef.current) {
          const Ctor =
            window.AudioContext ||
            (window as unknown as WindowWithWebkitAudio).webkitAudioContext;
          if (!Ctor) {
            console.warn("[avatar] AudioContext not supported");
            return;
          }
          audioContextRef.current = new Ctor();
        }
        const ctx = audioContextRef.current;
        if (ctx.state === "suspended") {
          void ctx.resume();
        }
        const source = ctx.createMediaStreamSource(
          new MediaStream([audioTrack]),
        );
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        analyserRef.current = analyser;

        const buf = new Uint8Array(analyser.fftSize);
        let consecutiveSilent = 0;
        let everHeard = false;
        audioLevelTimerRef.current = window.setInterval(() => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteTimeDomainData(buf);
          let max = 0;
          let min = 255;
          for (let i = 0; i < buf.length; i += 1) {
            const v = buf[i];
            if (v > max) max = v;
            if (v < min) min = v;
          }
          const range = max - min;
          if (range > 6) {
            consecutiveSilent = 0;
            if (!everHeard) {
              everHeard = true;
              console.info("[avatar] audio data CONFIRMED flowing", { range });
            }
          } else {
            consecutiveSilent += 1;
            if (consecutiveSilent === 8) {
              console.warn(
                "[avatar] audio track silent for ~8s — server likely not sending audio data",
              );
            }
          }
        }, 1000);
        console.info("[avatar] audio monitor started", {
          ctxState: ctx.state,
          sampleRate: ctx.sampleRate,
          trackId: audioTrack.id,
          trackMuted: String(audioTrack.muted),
          trackEnabled: String(audioTrack.enabled),
        });
      } catch (err) {
        console.warn("[avatar] audio monitor setup failed", err);
      }
    }, []);

    // When stream is ready: start MUTED autoplay (always allowed). Show the
    // unmute button. We do NOT try unmuted play here — it's unreliable on
    // desktop Chromium without a user gesture.
    useEffect(() => {
      const video = localVideoRef.current;
      if (!isVideoReady || !video) return;
      if (startedMutedRef.current) return;

      const tryMutedPlay = async () => {
        const stream = video.srcObject as MediaStream | null;
        if (!stream || stream.getVideoTracks().length === 0) return;
        startedMutedRef.current = true;
        video.muted = true;
        video.volume = 1;
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
      const video = localVideoRef.current;
      if (!video) return;

      console.info("[avatar] handleUnmute: user gesture received");

      try {
        video.muted = false;
        video.volume = 1;
        await video.play();

        // Force audio output device to system default. Mitigates Windows
        // Chrome routing audio to a stale/disconnected "Communications" sink.
        const videoWithSink = video as VideoWithSinkId;
        if (typeof videoWithSink.setSinkId === "function") {
          try {
            await videoWithSink.setSinkId("");
            console.info("[avatar] setSinkId('') ok — using system default");
          } catch (err) {
            console.warn("[avatar] setSinkId failed", err);
          }
        }

        // Resume / create AudioContext (some browsers create it suspended
        // until user gesture).
        if (audioContextRef.current?.state === "suspended") {
          await audioContextRef.current.resume();
          console.info("[avatar] AudioContext resumed");
        }

        // Start data-flow monitor so we can distinguish "server silent" from
        // "client routing broken".
        const stream = video.srcObject as MediaStream | null;
        if (stream) startAudioMonitor(stream);

        console.info("[avatar] post-unmute state", {
          muted: String(video.muted),
          volume: String(video.volume),
          paused: String(video.paused),
        });
        setNeedsUnmute(false);
      } catch (err) {
        console.error("[avatar] handleUnmute failed", err);
      }
    }, [startAudioMonitor]);

    useEffect(() => {
      return () => {
        stopAudioMonitor();
        if (audioContextRef.current && audioContextRef.current.state !== "closed") {
          void audioContextRef.current.close();
        }
        audioContextRef.current = null;
      };
    }, [stopAudioMonitor]);

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
