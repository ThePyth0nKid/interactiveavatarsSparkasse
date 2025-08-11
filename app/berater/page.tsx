"use client";

import SparkasseHeader from "@/components/SparkasseHeader";
import InteractiveAvatar from "@/components/InteractiveAvatar";

export default function AdvisorFullPage() {
  return (
    <div className="w-screen h-screen flex flex-col bg-white text-black">
      <SparkasseHeader />
      <section className="relative flex-1 grid place-items-start bg-zinc-100">
        <div className="w-full max-w-[900px] mx-auto px-4 py-8">
          {/* Die Komponente kapselt selbst Video-Container und den transkribierten Chat darunter */}
          <InteractiveAvatar />
        </div>
      </section>
    </div>
  );
}


