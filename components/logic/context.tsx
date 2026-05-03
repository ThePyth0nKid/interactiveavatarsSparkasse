import {
  AgentEventsEnum,
  ConnectionQuality,
  LiveAvatarSession,
} from "@heygen/liveavatar-web-sdk";
import React, { useRef, useState } from "react";

export enum StreamingAvatarSessionState {
  INACTIVE = "inactive",
  CONNECTING = "connecting",
  CONNECTED = "connected",
}

export enum MessageSender {
  CLIENT = "CLIENT",
  AVATAR = "AVATAR",
}

export interface Message {
  id: string;
  sender: MessageSender;
  content: string;
}

export type TranscriptionEvent = {
  event_type:
    | AgentEventsEnum.USER_TRANSCRIPTION
    | AgentEventsEnum.USER_TRANSCRIPTION_CHUNK
    | AgentEventsEnum.AVATAR_TRANSCRIPTION
    | AgentEventsEnum.AVATAR_TRANSCRIPTION_CHUNK;
  event_id: string;
  text: string;
};

export type StreamingAvatarContextProps = {
  sessionRef: React.MutableRefObject<LiveAvatarSession | null>;
  apiUrl?: string;

  isMuted: boolean;
  setIsMuted: (isMuted: boolean) => void;
  isVoiceChatLoading: boolean;
  setIsVoiceChatLoading: (isVoiceChatLoading: boolean) => void;
  isVoiceChatActive: boolean;
  setIsVoiceChatActive: (isVoiceChatActive: boolean) => void;

  sessionState: StreamingAvatarSessionState;
  setSessionState: (sessionState: StreamingAvatarSessionState) => void;

  // Replaces old `stream: MediaStream | null`. The LiveAvatar SDK attaches
  // tracks directly to a media element via `session.attach(element)`.
  isStreamReady: boolean;
  setIsStreamReady: (isStreamReady: boolean) => void;

  isFullyReady: boolean;
  setIsFullyReady: (isFullyReady: boolean) => void;
  isMicrophoneReady: boolean;
  setIsMicrophoneReady: (isMicrophoneReady: boolean) => void;

  messages: Message[];
  clearMessages: () => void;
  handleUserTranscriptionChunk: (event: TranscriptionEvent) => void;
  handleAvatarTranscriptionChunk: (event: TranscriptionEvent) => void;
  handleEndMessage: () => void;

  isListening: boolean;
  setIsListening: (isListening: boolean) => void;
  isUserTalking: boolean;
  setIsUserTalking: (isUserTalking: boolean) => void;
  isAvatarTalking: boolean;
  setIsAvatarTalking: (isAvatarTalking: boolean) => void;

  connectionQuality: ConnectionQuality;
  setConnectionQuality: (connectionQuality: ConnectionQuality) => void;

  lastDisconnectReason: string | null;
  setLastDisconnectReason: (reason: string | null) => void;
};

const StreamingAvatarContext = React.createContext<StreamingAvatarContextProps>(
  {
    sessionRef: { current: null },
    isMuted: true,
    setIsMuted: () => {},
    isVoiceChatLoading: false,
    setIsVoiceChatLoading: () => {},
    sessionState: StreamingAvatarSessionState.INACTIVE,
    setSessionState: () => {},
    isVoiceChatActive: false,
    setIsVoiceChatActive: () => {},
    isStreamReady: false,
    setIsStreamReady: () => {},
    isFullyReady: false,
    setIsFullyReady: () => {},
    isMicrophoneReady: false,
    setIsMicrophoneReady: () => {},
    messages: [],
    clearMessages: () => {},
    handleUserTranscriptionChunk: () => {},
    handleAvatarTranscriptionChunk: () => {},
    handleEndMessage: () => {},
    isListening: false,
    setIsListening: () => {},
    isUserTalking: false,
    setIsUserTalking: () => {},
    isAvatarTalking: false,
    setIsAvatarTalking: () => {},
    connectionQuality: ConnectionQuality.UNKNOWN,
    setConnectionQuality: () => {},
    lastDisconnectReason: null,
    setLastDisconnectReason: () => {},
  },
);

const useStreamingAvatarSessionState = () => {
  const [sessionState, setSessionState] = useState(
    StreamingAvatarSessionState.INACTIVE,
  );
  const [isStreamReady, setIsStreamReady] = useState(false);

  return {
    sessionState,
    setSessionState,
    isStreamReady,
    setIsStreamReady,
  };
};

const useStreamingAvatarVoiceChatState = () => {
  const [isMuted, setIsMuted] = useState(true);
  const [isVoiceChatLoading, setIsVoiceChatLoading] = useState(false);
  const [isVoiceChatActive, setIsVoiceChatActive] = useState(false);

  return {
    isMuted,
    setIsMuted,
    isVoiceChatLoading,
    setIsVoiceChatLoading,
    isVoiceChatActive,
    setIsVoiceChatActive,
  };
};

const useStreamingAvatarMessageState = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const currentSenderRef = useRef<MessageSender | null>(null);

  const appendChunkFor = (sender: MessageSender, text: string) => {
    if (!text) return;
    if (currentSenderRef.current === sender) {
      setMessages((prev) => {
        if (prev.length === 0) {
          return [
            {
              id: Date.now().toString(),
              sender,
              content: text,
            },
          ];
        }
        const last = prev[prev.length - 1];
        return [
          ...prev.slice(0, -1),
          {
            ...last,
            content: `${last.content}${text}`,
          },
        ];
      });
    } else {
      currentSenderRef.current = sender;
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          sender,
          content: text,
        },
      ]);
    }
  };

  const handleUserTranscriptionChunk = (event: TranscriptionEvent) => {
    appendChunkFor(MessageSender.CLIENT, event.text);
  };

  const handleAvatarTranscriptionChunk = (event: TranscriptionEvent) => {
    appendChunkFor(MessageSender.AVATAR, event.text);
  };

  const handleEndMessage = () => {
    currentSenderRef.current = null;
  };

  return {
    messages,
    clearMessages: () => {
      setMessages([]);
      currentSenderRef.current = null;
    },
    handleUserTranscriptionChunk,
    handleAvatarTranscriptionChunk,
    handleEndMessage,
  };
};

const useStreamingAvatarListeningState = () => {
  const [isListening, setIsListening] = useState(false);

  return { isListening, setIsListening };
};

const useStreamingAvatarTalkingState = () => {
  const [isUserTalking, setIsUserTalking] = useState(false);
  const [isAvatarTalking, setIsAvatarTalking] = useState(false);

  return {
    isUserTalking,
    setIsUserTalking,
    isAvatarTalking,
    setIsAvatarTalking,
  };
};

const useStreamingAvatarConnectionQualityState = () => {
  const [connectionQuality, setConnectionQuality] = useState(
    ConnectionQuality.UNKNOWN,
  );

  return { connectionQuality, setConnectionQuality };
};

const useStreamingAvatarDisconnectState = () => {
  const [lastDisconnectReason, setLastDisconnectReason] = useState<
    string | null
  >(null);
  return { lastDisconnectReason, setLastDisconnectReason };
};

const useStreamingAvatarReadinessState = () => {
  const [isFullyReady, setIsFullyReady] = useState(false);
  const [isMicrophoneReady, setIsMicrophoneReady] = useState(false);

  return {
    isFullyReady,
    setIsFullyReady,
    isMicrophoneReady,
    setIsMicrophoneReady,
  };
};

export const StreamingAvatarProvider = ({
  children,
  apiUrl,
}: {
  children: React.ReactNode;
  apiUrl?: string;
}) => {
  const sessionRef = useRef<LiveAvatarSession | null>(null);
  const voiceChatState = useStreamingAvatarVoiceChatState();
  const sessionState = useStreamingAvatarSessionState();
  const messageState = useStreamingAvatarMessageState();
  const listeningState = useStreamingAvatarListeningState();
  const talkingState = useStreamingAvatarTalkingState();
  const connectionQualityState = useStreamingAvatarConnectionQualityState();
  const readinessState = useStreamingAvatarReadinessState();
  const disconnectState = useStreamingAvatarDisconnectState();

  return (
    <StreamingAvatarContext.Provider
      value={{
        sessionRef,
        apiUrl,
        ...voiceChatState,
        ...sessionState,
        ...messageState,
        ...listeningState,
        ...talkingState,
        ...connectionQualityState,
        ...readinessState,
        ...disconnectState,
      }}
    >
      {children}
    </StreamingAvatarContext.Provider>
  );
};

export const useStreamingAvatarContext = () => {
  return React.useContext(StreamingAvatarContext);
};
