import { useCallback } from "react";

import { useStreamingAvatarContext } from "./context";

export const useTextChat = () => {
  const { sessionRef } = useStreamingAvatarContext();

  const sendMessage = useCallback(
    (message: string) => {
      const session = sessionRef.current;
      if (!session) return;
      try {
        session.message(message);
      } catch (error) {
        console.error("Failed to send message:", error);
      }
    },
    [sessionRef],
  );

  const repeatMessage = useCallback(
    (message: string) => {
      const session = sessionRef.current;
      if (!session) return;
      try {
        session.repeat(message);
      } catch (error) {
        console.error("Failed to repeat message:", error);
      }
    },
    [sessionRef],
  );

  return {
    sendMessage,
    repeatMessage,
  };
};
