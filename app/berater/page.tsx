"use client";

import SparkasseHeader from "@/components/SparkasseHeader";
import InteractiveAvatar from "@/components/InteractiveAvatar";

export default function AdvisorFullPage() {
  return (
    <div className="w-screen h-screen flex flex-col bg-white text-black">
      <SparkasseHeader />
      <section className="relative flex-1 bg-zinc-100">
        <div className="h-full">
          <InteractiveAvatar fullscreen />
        </div>
      </section>
    </div>
  );
}


