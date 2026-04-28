import {
  AgentEventsEnum,
  ConnectionQuality,
  LiveAvatarSession,
  SessionEvent,
} from "@heygen/liveavatar-web-sdk";
import { useCallback } from "react";

import {
  StreamingAvatarSessionState,
  useStreamingAvatarContext,
} from "./context";
import { useVoiceChat } from "./useVoiceChat";
import { useMessageHistory } from "./useMessageHistory";

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

  useMessageHistory();

  const init = useCallback(
    (token: string, options: InitOptions = {}) => {
      sessionRef.current = new LiveAvatarSession(token, {
        apiUrl,
        voiceChat: options.voiceChat ?? false,
      });
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
        setIsStreamReady(true);
        setSessionState(StreamingAvatarSessionState.CONNECTED);
      });

      session.on(
        SessionEvent.SESSION_CONNECTION_QUALITY_CHANGED,
        (quality: ConnectionQuality) => {
          setConnectionQuality(quality);
        },
      );

      session.on(SessionEvent.SESSION_DISCONNECTED, () => {
        void stop();
      });

      session.on(AgentEventsEnum.USER_SPEAK_STARTED, () => {
        setIsUserTalking(true);
      });

      session.on(AgentEventsEnum.USER_SPEAK_ENDED, () => {
        setIsUserTalking(false);
      });

      session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, () => {
        setIsAvatarTalking(true);
      });

      session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => {
        setIsAvatarTalking(false);
        handleEndMessage();
      });

      session.on(
        AgentEventsEnum.USER_TRANSCRIPTION_CHUNK,
        handleUserTranscriptionChunk,
      );
      session.on(
        AgentEventsEnum.AVATAR_TRANSCRIPTION_CHUNK,
        handleAvatarTranscriptionChunk,
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
