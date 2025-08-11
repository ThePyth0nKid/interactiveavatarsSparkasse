"use client";

import SparkasseHeader from "@/components/SparkasseHeader";
import InteractiveAvatar from "@/components/InteractiveAvatar";
import { useMediaQuery } from "@/components/logic/useMediaQuery";

export default function AdvisorFullPage() {
  const isMobile = useMediaQuery("(max-width: 639px)");
  return (
    <div className="w-screen h-screen flex flex-col bg-white text-black">
      <SparkasseHeader />
      <section className="relative flex-1 bg-zinc-100">
        {isMobile ? (
          <div className="h-full">
            <InteractiveAvatar fullscreen />
          </div>
        ) : (
          <div className="w-full max-w-[900px] mx-auto px-4 py-8">
            <InteractiveAvatar />
          </div>
        )}
      </section>
    </div>
  );
}


