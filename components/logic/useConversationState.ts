import { useCallback } from "react";

import { useStreamingAvatarContext } from "./context";

export const useConversationState = () => {
  const { avatarRef, isAvatarTalking, isUserTalking, isListening } =
    useStreamingAvatarContext();

  const startListening = useCallback(() => {
    if (!avatarRef.current) {
      console.log('[useConversationState] startListening - avatarRef not available');
      return;
    }
    console.log('[useConversationState] startListening() called - SDK startListening()');
    avatarRef.current.startListening();
  }, [avatarRef]);

  const stopListening = useCallback(() => {
    if (!avatarRef.current) {
      console.log('[useConversationState] stopListening - avatarRef not available');
      return;
    }
    console.log('[useConversationState] stopListening() called - SDK stopListening()');
    avatarRef.current.stopListening();
  }, [avatarRef]);

  return {
    isAvatarListening: isListening,
    startListening,
    stopListening,
    isUserTalking,
    isAvatarTalking,
  };
};
