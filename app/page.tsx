"use client";

import ChatWidget from "@/components/ChatWidget";
import SparkasseHeader from "@/components/SparkasseHeader";
export default function App() {
  return (
    <div className="w-screen h-screen flex flex-col bg-white text-black">
      <SparkasseHeader />
      {/* Hero */}
      <section className="relative flex-1">
        <img
          src="https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=2070&auto=format&fit=crop"
          alt="Hero"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative z-10 max-w-[1200px] mx-auto px-4 pt-16">
          <div className="bg-white/95 rounded-xl shadow-xl max-w-[520px] p-6">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-black">
              Modernisierungsrechner
            </h2>
            <p className="mt-2 text-black/80 text-sm">
              Erstellen Sie einen individuellen Modernisierungsplan für Ihr
              Haus. Weniger Verbrauch, weniger Kosten – mit schnellen
              Einschätzungen zu Einsparpotenzialen und Maßnahmen.
            </p>
            <button className="mt-4 inline-flex items-center gap-2 bg-[#E60000] text-white font-semibold rounded-full px-5 py-2">
              Mehr erfahren
            </button>
          </div>
        </div>
      </section>

      {/* Floating chat widget */}
      <ChatWidget />
    </div>
  );
}
