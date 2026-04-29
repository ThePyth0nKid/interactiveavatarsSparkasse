// Pipeline diagnostics for LiveAvatar / LiveKit. The HeyGen SDK keeps its
// internal LiveKit Room private, but at runtime we can still reach it via the
// instance fields. We tap that Room for events and pull WebRTC inbound-RTP
// stats so we can prove whether silent audio is "no bytes received" (codec
// issue / TTS not generating) vs "bytes received but silent samples"
// (provider mis-routing the wrong voice).
//
// Output is heavy on purpose — when the user reports "I hear nothing" we want
// the answer in one console log, not five round-trips.

import type { LiveAvatarSession } from "@heygen/liveavatar-web-sdk";

interface InboundAudioStats {
  bytesReceived: number;
  packetsReceived: number;
  packetsLost: number;
  jitter: number;
  audioLevel: number;
  totalAudioEnergy: number;
  totalSamplesReceived: number;
  silentConcealedSamples: number;
  concealedSamples: number;
  concealmentEvents: number;
  insertedSamplesForDeceleration: number;
  removedSamplesForAcceleration: number;
  fecPacketsReceived: number;
  codec?: string;
}

interface InboundVideoStats {
  bytesReceived: number;
  packetsReceived: number;
  packetsLost: number;
  framesReceived: number;
  framesDecoded: number;
  framesDropped: number;
  freezeCount: number;
  totalFreezesDuration: number;
}

type CodecMap = Map<string, string>;

const DIAG_PREFIX = "[pipeline]";

function logEvent(name: string, payload?: unknown) {
  if (payload === undefined) {
    console.info(`${DIAG_PREFIX} ${name}`);
  } else {
    console.info(`${DIAG_PREFIX} ${name}`, payload);
  }
}

function logWarn(name: string, payload?: unknown) {
  if (payload === undefined) {
    console.warn(`${DIAG_PREFIX} ${name}`);
  } else {
    console.warn(`${DIAG_PREFIX} ${name}`, payload);
  }
}

interface SdkRoomShape {
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  off?: (event: string, handler: (...args: unknown[]) => void) => void;
  state?: string;
  remoteParticipants?: unknown;
  engine?: {
    pcManager?: {
      subscriber?: { getConnectedAddress?: () => unknown; pc?: RTCPeerConnection };
      publisher?: { pc?: RTCPeerConnection };
    };
    client?: { ws?: WebSocket };
  };
}

interface LiveKitRemoteTrackShape {
  sid?: string;
  kind: string;
  isMuted: boolean;
  streamState?: string;
  mediaStreamTrack?: MediaStreamTrack;
  getRTCStatsReport?: () => Promise<RTCStatsReport | undefined>;
}

interface LiveKitParticipantShape {
  identity: string;
  sid: string;
  audioTrackPublications?: Map<string, unknown>;
  videoTrackPublications?: Map<string, unknown>;
  trackPublications?: Map<string, unknown>;
}

function extractRoom(session: LiveAvatarSession): SdkRoomShape | null {
  const sessionAny = session as unknown as { room?: SdkRoomShape };
  return sessionAny.room ?? null;
}

function extractRemoteAudioTrack(
  session: LiveAvatarSession,
): LiveKitRemoteTrackShape | null {
  const sessionAny = session as unknown as {
    _remoteAudioTrack?: LiveKitRemoteTrackShape;
  };
  return sessionAny._remoteAudioTrack ?? null;
}

function extractRemoteVideoTrack(
  session: LiveAvatarSession,
): LiveKitRemoteTrackShape | null {
  const sessionAny = session as unknown as {
    _remoteVideoTrack?: LiveKitRemoteTrackShape;
  };
  return sessionAny._remoteVideoTrack ?? null;
}

function readCodecs(report: RTCStatsReport): CodecMap {
  const codecs: CodecMap = new Map();
  report.forEach((stat) => {
    if ((stat as { type?: string }).type === "codec") {
      const codec = stat as { id?: string; mimeType?: string };
      if (codec.id && codec.mimeType) {
        codecs.set(codec.id, codec.mimeType);
      }
    }
  });
  return codecs;
}

function readInboundAudio(
  report: RTCStatsReport,
  codecs: CodecMap,
): InboundAudioStats | null {
  let result: InboundAudioStats | null = null;
  report.forEach((raw) => {
    const stat = raw as Record<string, unknown> & { type?: string; kind?: string };
    if (stat.type === "inbound-rtp" && stat.kind === "audio") {
      const codecId = stat.codecId as string | undefined;
      result = {
        bytesReceived: Number(stat.bytesReceived ?? 0),
        packetsReceived: Number(stat.packetsReceived ?? 0),
        packetsLost: Number(stat.packetsLost ?? 0),
        jitter: Number(stat.jitter ?? 0),
        audioLevel: Number(stat.audioLevel ?? 0),
        totalAudioEnergy: Number(stat.totalAudioEnergy ?? 0),
        totalSamplesReceived: Number(stat.totalSamplesReceived ?? 0),
        silentConcealedSamples: Number(stat.silentConcealedSamples ?? 0),
        concealedSamples: Number(stat.concealedSamples ?? 0),
        concealmentEvents: Number(stat.concealmentEvents ?? 0),
        insertedSamplesForDeceleration: Number(
          stat.insertedSamplesForDeceleration ?? 0,
        ),
        removedSamplesForAcceleration: Number(
          stat.removedSamplesForAcceleration ?? 0,
        ),
        fecPacketsReceived: Number(stat.fecPacketsReceived ?? 0),
        codec: codecId ? codecs.get(codecId) : undefined,
      };
    }
  });
  return result;
}

function readInboundVideo(report: RTCStatsReport): InboundVideoStats | null {
  let result: InboundVideoStats | null = null;
  report.forEach((raw) => {
    const stat = raw as Record<string, unknown> & { type?: string; kind?: string };
    if (stat.type === "inbound-rtp" && stat.kind === "video") {
      result = {
        bytesReceived: Number(stat.bytesReceived ?? 0),
        packetsReceived: Number(stat.packetsReceived ?? 0),
        packetsLost: Number(stat.packetsLost ?? 0),
        framesReceived: Number(stat.framesReceived ?? 0),
        framesDecoded: Number(stat.framesDecoded ?? 0),
        framesDropped: Number(stat.framesDropped ?? 0),
        freezeCount: Number(stat.freezeCount ?? 0),
        totalFreezesDuration: Number(stat.totalFreezesDuration ?? 0),
      };
    }
  });
  return result;
}

const ROOM_EVENTS_TO_LOG: readonly string[] = [
  "connected",
  "reconnecting",
  "signalReconnecting",
  "reconnected",
  "disconnected",
  "connectionStateChanged",
  "mediaDevicesError",
  "participantConnected",
  "participantDisconnected",
  "trackPublished",
  "trackSubscribed",
  "trackSubscriptionFailed",
  "trackUnsubscribed",
  "trackUnpublished",
  "trackMuted",
  "trackUnmuted",
  "trackStreamStateChanged",
  "audioPlaybackChanged",
  "activeSpeakersChanged",
  "dataReceived",
];

interface DiagnosticsHandle {
  stop: () => void;
}

export function startPipelineDiagnostics(
  session: LiveAvatarSession,
): DiagnosticsHandle {
  const room = extractRoom(session);
  if (!room) {
    logWarn("startPipelineDiagnostics: no room found on session");
    return { stop: () => {} };
  }

  logEvent("diagnostics: started", {
    roomState: room.state,
    hasEngine: Boolean(room.engine),
    hasPcManager: Boolean(room.engine?.pcManager),
  });

  const eventHandlers: Array<{ event: string; handler: (...args: unknown[]) => void }> = [];

  for (const event of ROOM_EVENTS_TO_LOG) {
    const handler = (...args: unknown[]) => {
      const summary = args.map((a) => {
        if (a == null) return a;
        if (typeof a === "string" || typeof a === "number" || typeof a === "boolean") {
          return a;
        }
        const v = a as Record<string, unknown>;
        return {
          identity: v.identity,
          sid: v.sid,
          kind: v.kind,
          source: v.source,
          isMuted: v.isMuted,
          streamState: v.streamState,
          name: (v.constructor as { name?: string } | undefined)?.name,
        };
      });
      logEvent(`room.${event}`, summary);
    };
    try {
      room.on(event, handler);
      eventHandlers.push({ event, handler });
    } catch (err) {
      logWarn(`failed to subscribe to room.${event}`, err);
    }
  }

  let lastAudioBytes = 0;
  let lastAudioEnergy = 0;
  let lastTimestamp = Date.now();

  const statsTimer = window.setInterval(() => {
    void (async () => {
      try {
        const audioTrack = extractRemoteAudioTrack(session);
        const videoTrack = extractRemoteVideoTrack(session);

        if (!audioTrack && !videoTrack) {
          logEvent("stats: no remote tracks yet");
          return;
        }

        const trackInfo = audioTrack
          ? {
              sid: audioTrack.sid,
              isMuted: audioTrack.isMuted,
              streamState: audioTrack.streamState,
              mstReadyState: audioTrack.mediaStreamTrack?.readyState,
              mstMuted: audioTrack.mediaStreamTrack?.muted,
              mstEnabled: audioTrack.mediaStreamTrack?.enabled,
            }
          : null;

        let inboundAudio: InboundAudioStats | null = null;
        let inboundVideo: InboundVideoStats | null = null;

        if (audioTrack?.getRTCStatsReport) {
          const report = await audioTrack.getRTCStatsReport();
          if (report) {
            const codecs = readCodecs(report);
            inboundAudio = readInboundAudio(report, codecs);
          }
        }

        if (!inboundAudio || !inboundVideo) {
          const subPc = room.engine?.pcManager?.subscriber?.pc;
          if (subPc && typeof subPc.getStats === "function") {
            const pcReport = await subPc.getStats();
            const codecs = readCodecs(pcReport);
            if (!inboundAudio) inboundAudio = readInboundAudio(pcReport, codecs);
            if (!inboundVideo) inboundVideo = readInboundVideo(pcReport);
          }
        }

        const now = Date.now();
        const deltaMs = now - lastTimestamp;
        lastTimestamp = now;

        if (inboundAudio) {
          const bytesDelta = inboundAudio.bytesReceived - lastAudioBytes;
          const energyDelta = inboundAudio.totalAudioEnergy - lastAudioEnergy;
          lastAudioBytes = inboundAudio.bytesReceived;
          lastAudioEnergy = inboundAudio.totalAudioEnergy;

          // Non-zero bytes but zero/near-zero energy = HeyGen sent silent samples.
          // This is the diagnostic signature for the imported-voice silence bug.
          const bytesPerSec = deltaMs > 0 ? Math.round((bytesDelta * 1000) / deltaMs) : 0;
          const verdict =
            bytesDelta > 0 && energyDelta < 1e-6
              ? "BYTES-FLOWING-BUT-SILENT"
              : bytesDelta === 0
                ? "NO-BYTES-RECEIVED"
                : "AUDIO-OK";

          logEvent("stats.audio", {
            verdict,
            bytesPerSec,
            bytesReceived: inboundAudio.bytesReceived,
            packetsReceived: inboundAudio.packetsReceived,
            packetsLost: inboundAudio.packetsLost,
            audioLevel: inboundAudio.audioLevel.toFixed(6),
            totalAudioEnergy: inboundAudio.totalAudioEnergy.toFixed(6),
            energyDelta: energyDelta.toFixed(6),
            silentConcealedSamples: inboundAudio.silentConcealedSamples,
            concealmentEvents: inboundAudio.concealmentEvents,
            jitter: inboundAudio.jitter.toFixed(4),
            codec: inboundAudio.codec,
            track: trackInfo,
          });
        } else {
          logEvent("stats.audio: no inbound-rtp stat", { track: trackInfo });
        }

        if (inboundVideo) {
          logEvent("stats.video", {
            bytesReceived: inboundVideo.bytesReceived,
            packetsReceived: inboundVideo.packetsReceived,
            framesReceived: inboundVideo.framesReceived,
            framesDecoded: inboundVideo.framesDecoded,
            framesDropped: inboundVideo.framesDropped,
            freezeCount: inboundVideo.freezeCount,
          });
        }
      } catch (err) {
        logWarn("stats poll failed", err);
      }
    })();
  }, 2000);

  // Snapshot remote participants after 1.5s — gives the room time to populate.
  const participantsTimer = window.setTimeout(() => {
    try {
      const participants = (room as unknown as {
        remoteParticipants?: Map<string, LiveKitParticipantShape>;
      }).remoteParticipants;
      if (participants) {
        const snapshot: Array<Record<string, unknown>> = [];
        participants.forEach((p) => {
          snapshot.push({
            identity: p.identity,
            sid: p.sid,
            audioTracks: p.audioTrackPublications?.size ?? 0,
            videoTracks: p.videoTrackPublications?.size ?? 0,
            totalTracks: p.trackPublications?.size ?? 0,
          });
        });
        logEvent("participants.snapshot", snapshot);
      }
    } catch (err) {
      logWarn("participants snapshot failed", err);
    }
  }, 1500);

  return {
    stop: () => {
      window.clearInterval(statsTimer);
      window.clearTimeout(participantsTimer);
      if (typeof room.off === "function") {
        for (const { event, handler } of eventHandlers) {
          try {
            room.off(event, handler);
          } catch {
            /* ignore */
          }
        }
      }
      logEvent("diagnostics: stopped");
    },
  };
}
