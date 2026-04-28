"use client";

import React, { useCallback, useState } from "react";
import { SendIcon } from "../Icons";
import { useTextChat } from "../logic/useTextChat";

type TextOverlayProps = {
  onClose?: () => void;
};

export const TextOverlay: React.FC<TextOverlayProps> = ({ onClose }) => {
  const { sendMessage } = useTextChat();
  const [message, setMessage] = useState("");

  const handleSend = useCallback(() => {
    const trimmed = message.trim();
    if (!trimmed) return;
    sendMessage(trimmed);
    setMessage("");
  }, [message, sendMessage]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className="absolute inset-x-3 bottom-3 sm:inset-x-6 sm:bottom-6 z-10">
      <div className="backdrop-blur-md bg-black/45 text-white rounded-xl shadow-lg border border-white/10 p-2 sm:p-3">
        <div className="flex items-center gap-2">
          <input
            className="w-full text-white text-sm bg-white/10 placeholder-white/60 py-2 px-4 rounded-lg outline-none"
            type="text"
            placeholder="Schreibe eine Nachricht…"
            value={message}
            autoFocus
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            className="flex-none h-10 w-10 rounded-lg bg-white text-zinc-900 flex items-center justify-center hover:brightness-95"
            aria-label="Nachricht senden"
            onClick={handleSend}
          >
            <SendIcon size={18} />
          </button>
          {onClose && (
            <button
              className="flex-none h-10 w-10 rounded-lg bg-white text-zinc-900 flex items-center justify-center hover:brightness-95"
              onClick={onClose}
              aria-label="Text-Overlay schließen"
            >
              ×
            </button>
          )}
        </div>
      </div>
    </div>
  );
};


