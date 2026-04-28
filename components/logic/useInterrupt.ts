import { useCallback } from "react";

import { useStreamingAvatarContext } from "./context";

export const useInterrupt = () => {
  const { sessionRef } = useStreamingAvatarContext();

  const interrupt = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    try {
      session.interrupt();
    } catch (error) {
      console.error("Failed to interrupt avatar:", error);
    }
  }, [sessionRef]);

  return { interrupt };
};
