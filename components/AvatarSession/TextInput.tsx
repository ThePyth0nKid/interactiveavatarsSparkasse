import React, { useCallback, useEffect, useState } from "react";
import { usePrevious } from "ahooks";

import { Button } from "../Button";
import { SendIcon } from "../Icons";
import { useTextChat } from "../logic/useTextChat";
import { Input } from "../Input";
import { useConversationState } from "../logic/useConversationState";

type Mode = "talk" | "repeat";

export const TextInput: React.FC = () => {
  const { sendMessage, repeatMessage } = useTextChat();
  const { startListening, stopListening } = useConversationState();
  const [mode, setMode] = useState<Mode>("talk");
  const [message, setMessage] = useState("");

  const handleSend = useCallback(() => {
    if (message.trim() === "") {
      return;
    }
    if (mode === "talk") {
      sendMessage(message);
    } else {
      repeatMessage(message);
    }
    setMessage("");
  }, [mode, message, sendMessage, repeatMessage]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        handleSend();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSend]);

  const previousText = usePrevious(message);

  useEffect(() => {
    if (!previousText && message) {
      startListening();
    } else if (previousText && !message) {
      stopListening();
    }
  }, [message, previousText, startListening, stopListening]);

  return (
    <div className="flex flex-row gap-2 items-end w-full">
      <div className="flex rounded-lg bg-zinc-800 p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("talk")}
          className={`px-3 py-1.5 rounded-md transition-colors ${
            mode === "talk" ? "bg-zinc-700 text-white" : "text-zinc-400"
          }`}
        >
          TALK
        </button>
        <button
          type="button"
          onClick={() => setMode("repeat")}
          className={`px-3 py-1.5 rounded-md transition-colors ${
            mode === "repeat" ? "bg-zinc-700 text-white" : "text-zinc-400"
          }`}
        >
          REPEAT
        </button>
      </div>
      <Input
        className="min-w-[500px]"
        placeholder={`Type something for the avatar to ${mode === "repeat" ? "repeat" : "respond"}...`}
        value={message}
        onChange={setMessage}
      />
      <Button className="!p-2" onClick={handleSend}>
        <SendIcon size={20} />
      </Button>
    </div>
  );
};
