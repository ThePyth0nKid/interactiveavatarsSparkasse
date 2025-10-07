"use client";

import React from "react";

import { useVoiceChat } from "../logic/useVoiceChat";
import { useConversationState } from "../logic/useConversationState";
import { MicIcon, MicOffIcon } from "../Icons";

export const MicOverlay: React.FC = () => {
  const { muteInputAudio, unmuteInputAudio, isMuted, isVoiceChatLoading } =
    useVoiceChat();
  const { isUserTalking, isAvatarTalking } = useConversationState();

  const toggleMute = () => {
    if (isMuted) {
      unmuteInputAudio();
    } else {
      muteInputAudio();
    }
  };

  return (
    <button
      aria-label={
        isAvatarTalking 
          ? "Avatar spricht - Unterbrechen-Button verwenden" 
          : isMuted 
          ? "Mikrofon einschalten" 
          : "Mikrofon stummschalten"
      }
      disabled={isVoiceChatLoading || isAvatarTalking}
      onClick={toggleMute}
      className={`relative z-10 h-12 w-12 rounded-full bg-[#E60000] text-white shadow-lg border border-black/10 flex items-center justify-center hover:brightness-110 disabled:opacity-60 mx-auto transition-opacity ${
        isAvatarTalking ? 'cursor-not-allowed' : ''
      }`}
    >
      <span
        className={`absolute -inset-1 rounded-full ring-2 ring-[#E60000] ${
          isUserTalking && !isMuted ? "animate-ping" : "hidden"
        }`}
        aria-hidden
      />
      {isMuted ? <MicOffIcon size={18} /> : <MicIcon size={18} />}
    </button>
  );
};


