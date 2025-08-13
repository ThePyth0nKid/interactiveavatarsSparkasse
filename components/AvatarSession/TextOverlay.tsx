"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Input } from "../Input";
import { SendIcon } from "../Icons";
import { useTextChat } from "../logic/useTextChat";
import { useVoiceChat } from "../logic/useVoiceChat";

type TextOverlayProps = {
  onClose?: () => void;
};

export const TextOverlay: React.FC<TextOverlayProps> = ({ onClose }) => {
  const { sendMessage } = useTextChat();
  const { stopVoiceChat, isVoiceChatActive } = useVoiceChat();
  const [message, setMessage] = useState("");

  useEffect(() => {
    // Sicherheit: Wenn Text-Overlay geöffnet ist, Voice-Chat ausschalten
    if (isVoiceChatActive) {
      stopVoiceChat();
    }
  }, [isVoiceChatActive, stopVoiceChat]);

  const handleSend = useCallback(() => {
    const trimmed = message.trim();
    if (!trimmed) return;
    sendMessage(trimmed);
    setMessage("");
  }, [message, sendMessage]);

  return (
    <div className="absolute inset-x-3 bottom-3 sm:inset-x-6 sm:bottom-6 z-10">
      <div className="backdrop-blur-md bg-black/45 text-white rounded-xl shadow-lg border border-white/10 p-2 sm:p-3">
        <div className="flex items-center gap-2">
          <Input
            className="bg-white/10 placeholder-white/60 text-white"
            placeholder="Schreibe eine Nachricht…"
            value={message}
            onChange={setMessage}
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


