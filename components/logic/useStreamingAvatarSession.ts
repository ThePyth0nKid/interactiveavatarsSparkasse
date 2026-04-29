import {
  AgentEventsEnum,
  ConnectionQuality,
  LiveAvatarSession,
  SessionEvent,
} from "@heygen/liveavatar-web-sdk";
import { useCallback, useRef } from "react";

import {
  StreamingAvatarSessionState,
  type TranscriptionEvent,
  useStreamingAvatarContext,
} from "./context";
import { useVoiceChat } from "./useVoiceChat";
import { useMessageHistory } from "./useMessageHistory";
import { startPipelineDiagnostics } from "./pipelineDiagnostics";

type InitOptions = {
  voiceChat?: boolean;
};

export const useStreamingAvatarSession = () => {
  const {
    sessionRef,
    apiUrl,
    sessionState,
    setSessionState,
    isStreamReady,
    setIsStreamReady,
    setIsListening,
    setIsUserTalking,
    setIsAvatarTalking,
    setConnectionQuality,
    handleUserTranscriptionChunk,
    handleAvatarTranscriptionChunk,
    handleEndMessage,
    clearMessages,
  } = useStreamingAvatarContext();
  const { stopVoiceChat } = useVoiceChat();
  const diagnosticsRef = useRef<{ stop: () => void } | null>(null);

  useMessageHistory();

  const init = useCallback(
    (token: string, options: InitOptions = {}) => {
      sessionRef.current = new LiveAvatarSession(token, {
        apiUrl,
        voiceChat: options.voiceChat ?? false,
      });
      try {
        diagnosticsRef.current?.stop();
        diagnosticsRef.current = startPipelineDiagnostics(sessionRef.current);
      } catch (err) {
        console.warn("[avatar] pipeline diagnostics failed to start", err);
      }
      return sessionRef.current;
    },
    [apiUrl, sessionRef],
  );

  const stop = useCallback(async () => {
    const session = sessionRef.current;
    clearMessages();
    await stopVoiceChat();
    setIsListening(false);
    setIsUserTalking(false);
    setIsAvatarTalking(false);
    setIsStreamReady(false);
    if (diagnosticsRef.current) {
      try {
        diagnosticsRef.current.stop();
      } catch {
        /* ignore */
      }
      diagnosticsRef.current = null;
    }
    if (session) {
      try {
        await session.stop();
      } catch (error) {
        console.error("Error stopping session:", error);
      }
      session.removeAllListeners();
      sessionRef.current = null;
    }
    setSessionState(StreamingAvatarSessionState.INACTIVE);
  }, [
    sessionRef,
    setSessionState,
    setIsStreamReady,
    setIsListening,
    stopVoiceChat,
    clearMessages,
    setIsUserTalking,
    setIsAvatarTalking,
  ]);

  const start = useCallback(
    async (token?: string, options: InitOptions = {}) => {
      if (sessionState !== StreamingAvatarSessionState.INACTIVE) {
        throw new Error("There is already an active session");
      }

      if (!sessionRef.current) {
        if (!token) {
          throw new Error("Token is required");
        }
        init(token, options);
      }

      const session = sessionRef.current;
      if (!session) {
        throw new Error("Session is not initialized");
      }

      setSessionState(StreamingAvatarSessionState.CONNECTING);

      session.on(SessionEvent.SESSION_STREAM_READY, () => {
        console.info("[avatar] SESSION_STREAM_READY", { ts: Date.now() });
        setIsStreamReady(true);
        setSessionState(StreamingAvatarSessionState.CONNECTED);
      });

      session.on(
        SessionEvent.SESSION_CONNECTION_QUALITY_CHANGED,
        (quality: ConnectionQuality) => {
          setConnectionQuality(quality);
        },
      );

      session.on(SessionEvent.SESSION_DISCONNECTED, (reason?: unknown) => {
        console.warn("[avatar] SESSION_DISCONNECTED", { reason });
        void stop();
      });

      session.on(AgentEventsEnum.USER_SPEAK_STARTED, () => {
        setIsUserTalking(true);
      });

      session.on(AgentEventsEnum.USER_SPEAK_ENDED, () => {
        setIsUserTalking(false);
      });

      session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, () => {
        console.info("[avatar] AVATAR_SPEAK_STARTED");
        setIsAvatarTalking(true);
      });

      session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => {
        console.info("[avatar] AVATAR_SPEAK_ENDED");
        setIsAvatarTalking(false);
        handleEndMessage();
      });

      session.on(
        AgentEventsEnum.USER_TRANSCRIPTION_CHUNK,
        (chunk: TranscriptionEvent) => {
          console.info("[avatar] USER_TRANSCRIPTION_CHUNK", {
            length: chunk?.text?.length ?? 0,
          });
          handleUserTranscriptionChunk(chunk);
        },
      );
      session.on(
        AgentEventsEnum.AVATAR_TRANSCRIPTION_CHUNK,
        (chunk: TranscriptionEvent) => {
          console.info("[avatar] AVATAR_TRANSCRIPTION_CHUNK", {
            length: chunk?.text?.length ?? 0,
          });
          handleAvatarTranscriptionChunk(chunk);
        },
      );

      await session.start();

      return session;
    },
    [
      init,
      stop,
      setSessionState,
      setIsStreamReady,
      sessionRef,
      sessionState,
      setConnectionQuality,
      setIsUserTalking,
      setIsAvatarTalking,
      handleUserTranscriptionChunk,
      handleAvatarTranscriptionChunk,
      handleEndMessage,
    ],
  );

  const attachMedia = useCallback(
    (element: HTMLMediaElement | null) => {
      if (!element || !sessionRef.current) return;
      sessionRef.current.attach(element);
    },
    [sessionRef],
  );

  return {
    sessionRef,
    sessionState,
    isStreamReady,
    attachMedia,
    initAvatar: init,
    startAvatar: start,
    stopAvatar: stop,
  };
};
