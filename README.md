# HeyGen Interactive Avatar NextJS Demo

![HeyGen Interactive Avatar NextJS Demo Screenshot](./public/demo.png)

This is a sample project and was bootstrapped using [NextJS](https://nextjs.org/).
Feel free to play around with the existing code and please leave any feedback for the SDK [here](https://github.com/HeyGen-Official/StreamingAvatarSDK/discussions).

## Getting Started FAQ

### Setting up the demo

1. Clone this repo

2. Navigate to the repo folder in your terminal

3. Run `npm install` (assuming you have npm installed. If not, please follow these instructions: https://docs.npmjs.com/downloading-and-installing-node-js-and-npm/)

4. Enter your HeyGen Enterprise API Token in the `.env` file. Replace `HEYGEN_API_KEY` with your API key. This will allow the Client app to generate secure Access Tokens with which to create interactive sessions.

   You can retrieve either the API Key by logging in to HeyGen and navigating to this page in your settings: [https://app.heygen.com/settings?from=&nav=Subscriptions%20%26%20API]. 

5. (Optional) If you would like to use the OpenAI features, enter your OpenAI Api Key in the `.env` file.

6. Run `npm run dev`

### Starting sessions

NOTE: Make sure you have enter your token into the `.env` file and run `npm run dev`.

To start your 'session' with a Interactive Avatar, first click the 'start' button. If your HeyGen API key is entered into the Server's .env file, then you should see our demo Interactive Avatar appear.

If you want to see a different Avatar or try a different voice, you can close the session and enter the IDs and then 'start' the session again. Please see below for information on where to retrieve different Avatar and voice IDs that you can use.

### Which Avatars can I use with this project?

By default, there are several Public Avatars that can be used in Interactive Avatar. (AKA Interactive Avatars.) You can find the Avatar IDs for these Public Avatars by navigating to [labs.heygen.com/interactive-avatar](https://labs.heygen.com/interactive-avatar) and clicking 'Select Avatar' and copying the avatar id.

You can create your own custom Interactive Avatars at labs.heygen.com/interactive-avatar by clicking 'create interactive avatar' on the top-left of the screen.

### Where can I read more about enterprise-level usage of the Interactive Avatar API?

Please read our Interactive Avatar 101 article for more information on pricing: https://help.heygen.com/en/articles/9182113-interactive-avatar-101-your-ultimate-guide

## Features & Funktionalität

### Intelligente Interrupt-Steuerung

Dieses Projekt implementiert eine intelligente Interrupt-Steuerung für den interaktiven Avatar:

#### 🎯 Kernfunktionalität

- **Nur manuelle Unterbrechung:** Der Avatar kann während des Sprechens **nur noch über den "Unterbrechen"-Button** gestoppt werden
- **Keine automatische Unterbrechung:** Verbale Eingaben des Users während der Avatar spricht werden ignoriert
- **Voice Activity Detection (VAD) gesteuert:** Das System deaktiviert automatisch die Spracherkennung während der Avatar spricht

#### 🔧 Technische Implementierung

Das System nutzt die Event-Handler des HeyGen Streaming Avatar SDK:

1. **`AVATAR_START_TALKING`** → Spracherkennung wird deaktiviert (`stopListening()`)
2. **`AVATAR_STOP_TALKING`** → Spracherkennung wird reaktiviert (`startListening()`)
3. **Interrupt-Button** → Ruft direkt `avatar.interrupt()` auf (funktioniert unabhängig vom Listening-Status)

#### 🎨 UI-Features

**Button-Platzierung (Fullscreen & Widget):**
- Interrupt-Button unten links im Video-Overlay (neben Mikrofon-Button)
- Im selben visuellen Stil wie die anderen Controls
- Button ist nur aktiv wenn Avatar spricht (ausgegraut wenn inaktiv)
- Optimiertes Styling mit rotem Sparkassen-Rot (#E60000)

**Im Widget-Modus (`/`):**
- Zusätzlich: Interrupt-Button in den erweiterten Controls unter dem Video
- Konsistentes Design über alle Modi hinweg

**Mikrofon-Button:**
- Wird automatisch ausgegraut während Avatar spricht
- Cursor ändert sich zu "not-allowed"
- ARIA-Label informiert über die Verwendung des Interrupt-Buttons

#### 📊 User Experience Flow

```
1. Avatar startet sprechen
   ↓
2. Mikrofon wird ausgegraut (deaktiviert)
   ↓
3. User versucht zu sprechen
   ↓
4. Keine Reaktion (VAD ist deaktiviert)
   ↓
5. User klickt "Unterbrechen"-Button
   ↓
6. Avatar stoppt sofort
   ↓
7. Mikrofon wird reaktiviert
   ↓
8. User kann normal sprechen
```

#### 💡 Vorteile

- ✅ Verhindert ungewollte Unterbrechungen
- ✅ Klare Kontrollmechanismen
- ✅ Bessere Benutzererfahrung durch gezieltes Feedback
- ✅ Nutzt native SDK-Funktionen (keine Workarounds)
- ✅ Optimale Performance ohne Verbindungsabbrüche

### Voice & Text Chat Modi

Das Projekt unterstützt zwei Kommunikationsmodi:

- **Voice Chat:** Echtzeit-Sprachkommunikation über LiveKit
- **Text Chat:** Textbasierte Kommunikation mit dem Avatar

Zwischen beiden Modi kann während einer laufenden Session nahtlos gewechselt werden.

### Technischer Stack

- **Framework:** Next.js 15.3.0 mit React 19
- **SDK:** HeyGen Streaming Avatar SDK 2.0.13
- **Voice Transport:** LiveKit
- **STT Provider:** Deepgram
- **Styling:** TailwindCSS
- **Voice Model:** ElevenLabs Flash v2.5

## Projektstruktur

```
components/
├── InteractiveAvatar.tsx          # Hauptkomponente mit Session-Management
├── AvatarSession/
│   ├── AvatarControls.tsx        # Steuerung mit Interrupt-Button
│   ├── MicOverlay.tsx            # Mikrofon-Button mit visuellem Feedback
│   ├── TextOverlay.tsx           # Text-Chat Overlay
│   └── MessageHistory.tsx        # Konversationsverlauf
└── logic/
    ├── useVoiceChat.ts           # Voice Chat Management
    ├── useInterrupt.ts           # Interrupt-Funktionalität
    ├── useConversationState.ts   # Listening & Talking State
    └── useStreamingAvatarSession.ts  # Avatar Session Management
```

## Entwicklung & Anpassung

### Event-Handler erweitern

Die Event-Handler in `InteractiveAvatar.tsx` können nach Bedarf erweitert werden:

```typescript
avatar.on(StreamingEvents.AVATAR_START_TALKING, (e) => {
  // Eigene Logik hier
  stopListening();
});
```

### Styling anpassen

Das Projekt verwendet TailwindCSS. Farben und Abstände können in den Komponenten direkt angepasst werden:

```typescript
// Beispiel: Interrupt-Button Farbe ändern
className="bg-[#E60000]"  // Sparkassen-Rot
```

### Avatar-Konfiguration

Die Avatar-Konfiguration befindet sich in `InteractiveAvatar.tsx`:

```typescript
const DEFAULT_CONFIG: StartAvatarRequest = {
  quality: AvatarQuality.High,
  language: "de",
  voice: {
    rate: 1.5,
    emotion: VoiceEmotion.EXCITED,
    model: ElevenLabsModel.eleven_flash_v2_5,
  },
  // ...
};
```

## Changelog

### Version 0.0.2 (Aktuell)
- ✨ Intelligente Interrupt-Steuerung implementiert
- ✨ Voice Activity Detection automatisch gesteuert
- ✨ Interrupt-Button im Fullscreen-Modus hinzugefügt
- ✨ Visuelles Feedback für Mikrofon-Button
- ✨ Optimiertes Button-Styling
- ✨ Verbesserte Accessibility mit ARIA-Labels

### Version 0.0.1 (Initial)
- 🎉 Initiale Version mit Voice & Text Chat
- 🎉 HeyGen Streaming Avatar Integration
- 🎉 LiveKit Voice Transport