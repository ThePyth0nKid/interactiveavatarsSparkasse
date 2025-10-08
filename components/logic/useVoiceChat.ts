import { useCallback, useEffect } from "react";

import { useStreamingAvatarContext } from "./context";
import { StreamingAvatarSessionState } from "./context";

export const useVoiceChat = () => {
  const {
    avatarRef,
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
      if (!avatarRef.current) return;
      setIsVoiceChatLoading(true);
      setIsMicrophoneReady(false);
      
      try {
        await avatarRef.current?.startVoiceChat({
          isInputAudioMuted,
        });
        
        // Check microphone permissions and readiness
        try {
          // First check if we have permissions
          const permissionStatus = await navigator.permissions?.query?.({ name: 'microphone' as PermissionName });
          if (permissionStatus?.state === 'denied') {
            console.warn("Microphone permission denied");
            setIsMicrophoneReady(false);
          } else {
            // Try to access the microphone
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            // Test if we can actually access the microphone
            if (stream && stream.getAudioTracks().length > 0) {
              const audioTrack = stream.getAudioTracks()[0];
              if (audioTrack.readyState === 'live') {
                setIsMicrophoneReady(true);
              }
              // Clean up the test stream
              stream.getTracks().forEach(track => track.stop());
            } else {
              setIsMicrophoneReady(false);
            }
          }
        } catch (micError) {
          console.warn("Microphone access failed:", micError);
          setIsMicrophoneReady(false);
        }
        
        setIsVoiceChatActive(true);
        setIsMuted(!!isInputAudioMuted);
      } catch (error) {
        console.error("Voice chat start failed:", error);
        setIsMicrophoneReady(false);
      } finally {
        setIsVoiceChatLoading(false);
      }
    },
    [avatarRef, setIsMuted, setIsVoiceChatActive, setIsVoiceChatLoading, setIsMicrophoneReady],
  );

  const stopVoiceChat = useCallback(async () => {
    if (!avatarRef.current) return;
    try {
      await avatarRef.current?.closeVoiceChat();
    } finally {
      setIsVoiceChatActive(false);
      setIsMuted(true);
      setIsMicrophoneReady(false);
      setIsFullyReady(false);
    }
  }, [avatarRef, setIsMuted, setIsVoiceChatActive, setIsMicrophoneReady, setIsFullyReady]);

  const muteInputAudio = useCallback(() => {
    if (!avatarRef.current) {
      console.log('[useVoiceChat] muteInputAudio - avatarRef not available');
      return;
    }
    console.log('[useVoiceChat] muteInputAudio() called - SDK muteInputAudio()');
    avatarRef.current?.muteInputAudio();
    setIsMuted(true);
  }, [avatarRef, setIsMuted]);

  const unmuteInputAudio = useCallback(() => {
    if (!avatarRef.current) {
      console.log('[useVoiceChat] unmuteInputAudio - avatarRef not available');
      return;
    }
    console.log('[useVoiceChat] unmuteInputAudio() called - SDK unmuteInputAudio()');
    avatarRef.current?.unmuteInputAudio();
    setIsMuted(false);
  }, [avatarRef, setIsMuted]);

  // Effect to calculate full readiness based on avatar and microphone state
  useEffect(() => {
    const isAvatarReady = sessionState === StreamingAvatarSessionState.CONNECTED;
    const isFullyReady = isAvatarReady && isMicrophoneReady && isVoiceChatActive && !isVoiceChatLoading;
    
    setIsFullyReady(isFullyReady);
  }, [sessionState, isMicrophoneReady, isVoiceChatActive, isVoiceChatLoading, setIsFullyReady]);

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
