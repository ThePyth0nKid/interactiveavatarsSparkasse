import { VoiceChatEvent, VoiceChatState } from "@heygen/liveavatar-web-sdk";
import { useCallback, useEffect } from "react";

import {
  StreamingAvatarSessionState,
  useStreamingAvatarContext,
} from "./context";

export const useVoiceChat = () => {
  const {
    sessionRef,
    isMuted,
    setIsMuted,
    isVoiceChatActive,
    setIsVoiceChatActive,
    isVoiceChatLoading,
    setIsVoiceChatLoading,
    isMicrophoneReady,
    setIsMicrophoneReady,
    sessionState,
    setIsFullyReady,
  } = useStreamingAvatarContext();

  const startVoiceChat = useCallback(
    async (isInputAudioMuted?: boolean) => {
      const session = sessionRef.current;
      if (!session) return;

      setIsVoiceChatLoading(true);
      setIsMicrophoneReady(false);

      // Probe permission BEFORE the SDK grabs the mic track.
      // Chromium-based desktop browsers can revoke the SDK's track when a
      // second concurrent getUserMedia() handle is closed, which manifests
      // as "mic is hot but no audio reaches the backend".
      let permissionGranted = true;
      try {
        const permissionStatus = await navigator.permissions?.query?.({
          name: "microphone" as PermissionName,
        });
        if (permissionStatus?.state === "denied") {
          permissionGranted = false;
        }
      } catch {
        // Permissions API unavailable — let the SDK trigger the prompt.
      }

      const handleMuted = () => setIsMuted(true);
      const handleUnmuted = () => setIsMuted(false);
      const handleStateChanged = (state: VoiceChatState) => {
        setIsVoiceChatActive(state === VoiceChatState.ACTIVE);
      };

      session.voiceChat.on(VoiceChatEvent.MUTED, handleMuted);
      session.voiceChat.on(VoiceChatEvent.UNMUTED, handleUnmuted);
      session.voiceChat.on(VoiceChatEvent.STATE_CHANGED, handleStateChanged);

      try {
        await session.voiceChat.start({
          defaultMuted: isInputAudioMuted ?? false,
        });

        setIsMicrophoneReady(permissionGranted);
        setIsVoiceChatActive(true);
        setIsMuted(!!isInputAudioMuted);
      } catch (error) {
        console.error("Voice chat start failed:", error);
        setIsMicrophoneReady(false);
      } finally {
        setIsVoiceChatLoading(false);
      }
    },
    [
      sessionRef,
      setIsMuted,
      setIsVoiceChatActive,
      setIsVoiceChatLoading,
      setIsMicrophoneReady,
    ],
  );

  const stopVoiceChat = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;
    try {
      session.voiceChat.stop();
      session.voiceChat.removeAllListeners();
    } finally {
      setIsVoiceChatActive(false);
      setIsMuted(true);
      setIsMicrophoneReady(false);
      setIsFullyReady(false);
    }
  }, [
    sessionRef,
    setIsMuted,
    setIsVoiceChatActive,
    setIsMicrophoneReady,
    setIsFullyReady,
  ]);

  const muteInputAudio = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    void session.voiceChat.mute();
    setIsMuted(true);
  }, [sessionRef, setIsMuted]);

  const unmuteInputAudio = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    void session.voiceChat.unmute();
    setIsMuted(false);
  }, [sessionRef, setIsMuted]);

  useEffect(() => {
    const isAvatarReady =
      sessionState === StreamingAvatarSessionState.CONNECTED;
    const isFullyReady =
      isAvatarReady &&
      isMicrophoneReady &&
      isVoiceChatActive &&
      !isVoiceChatLoading;

    setIsFullyReady(isFullyReady);
  }, [
    sessionState,
    isMicrophoneReady,
    isVoiceChatActive,
    isVoiceChatLoading,
    setIsFullyReady,
  ]);

  return {
    startVoiceChat,
    stopVoiceChat,
    muteInputAudio,
    unmuteInputAudio,
    isMuted,
    isVoiceChatActive,
    isVoiceChatLoading,
    isMicrophoneReady,
  };
};
