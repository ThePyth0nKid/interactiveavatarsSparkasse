import { useCallback } from "react";

import { useStreamingAvatarContext } from "./context";

export const useConversationState = () => {
  const { sessionRef, isAvatarTalking, isUserTalking, isListening, setIsListening } =
    useStreamingAvatarContext();

  const startListening = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    try {
      session.startListening();
      setIsListening(true);
    } catch (error) {
      console.error("Failed to start listening:", error);
    }
  }, [sessionRef, setIsListening]);

  const stopListening = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    try {
      session.stopListening();
      setIsListening(false);
    } catch (error) {
      console.error("Failed to stop listening:", error);
    }
  }, [sessionRef, setIsListening]);

  return {
    isAvatarListening: isListening,
    startListening,
    stopListening,
    isUserTalking,
    isAvatarTalking,
  };
};
