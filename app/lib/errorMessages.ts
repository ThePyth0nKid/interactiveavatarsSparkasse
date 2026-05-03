export type AvatarErrorCause =
  | "fetch_token"
  | "session_start"
  | "session_disconnect"
  | "voice_chat"
  | "unknown";

export interface AvatarErrorInput {
  cause?: AvatarErrorCause;
  status?: number | null;
  code?: number | string | null;
  message?: string | null;
  reason?: string | null;
}

export interface FriendlyError {
  title: string;
  message: string;
  hint?: string;
  technical?: string;
  retryable: boolean;
}

const NO_CREDITS: FriendlyError = {
  title: "Avatar derzeit nicht verfügbar",
  message:
    "Die Sitzung kann momentan nicht gestartet werden, weil das Guthaben für den digitalen Berater aufgebraucht ist. Bitte laden Sie das Kontingent auf oder wenden Sie sich an Ihren Ansprechpartner.",
  hint: "LiveAvatar-Guthaben (Credits) erschöpft.",
  retryable: false,
};

const CONCURRENT_LIMIT: FriendlyError = {
  title: "Berater gerade besetzt",
  message:
    "Aktuell sprechen bereits andere Personen mit dem Berater. Bitte versuchen Sie es in einem Moment erneut.",
  hint: "Concurrent-Session-Limit erreicht.",
  retryable: true,
};

const RATE_LIMITED: FriendlyError = {
  title: "Zu viele Anfragen",
  message:
    "Bitte warten Sie einen kurzen Moment, bevor Sie das Gespräch erneut starten.",
  hint: "Rate-Limit (HTTP 429) erreicht.",
  retryable: true,
};

const AUTH_FAILED: FriendlyError = {
  title: "Verbindungsproblem",
  message:
    "Der digitale Berater kann derzeit nicht erreicht werden. Bitte versuchen Sie es später erneut oder kontaktieren Sie den Support.",
  hint: "Authentifizierung gegen LiveAvatar fehlgeschlagen (API-Key).",
  retryable: false,
};

const AVATAR_NOT_AVAILABLE: FriendlyError = {
  title: "Avatar derzeit nicht verfügbar",
  message:
    "Der digitale Berater ist gerade nicht erreichbar. Bitte versuchen Sie es in wenigen Minuten erneut.",
  hint: "Avatar/Persona ist serverseitig nicht verfügbar.",
  retryable: true,
};

const SERVER_ERROR: FriendlyError = {
  title: "Service vorübergehend gestört",
  message:
    "Beim Starten der Beratung ist ein Fehler beim Anbieter aufgetreten. Bitte versuchen Sie es gleich erneut.",
  hint: "Upstream-Server lieferte 5xx.",
  retryable: true,
};

const NETWORK_ERROR: FriendlyError = {
  title: "Verbindung fehlgeschlagen",
  message:
    "Bitte prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.",
  hint: "Netzwerk-/Fetch-Fehler.",
  retryable: true,
};

const SESSION_DISCONNECTED_SERVER: FriendlyError = {
  title: "Verbindung unterbrochen",
  message:
    "Die Sitzung wurde vom Anbieter beendet. Sie können das Gespräch jederzeit erneut starten.",
  hint: "SESSION_DISCONNECTED (server-initiated).",
  retryable: true,
};

const SESSION_START_FAILED: FriendlyError = {
  title: "Verbindung fehlgeschlagen",
  message:
    "Der Berater konnte nicht gestartet werden. Bitte versuchen Sie es erneut.",
  hint: "SESSION_START_FAILED.",
  retryable: true,
};

const CONFIG_MISSING: FriendlyError = {
  title: "Konfigurationsfehler",
  message:
    "Der digitale Berater ist nicht korrekt konfiguriert. Bitte informieren Sie den Betreiber.",
  hint: "Server-Env (z. B. LIVEAVATAR_API_KEY) fehlt.",
  retryable: false,
};

const GENERIC: FriendlyError = {
  title: "Etwas ist schiefgelaufen",
  message:
    "Beim Starten der Beratung ist ein unerwarteter Fehler aufgetreten. Bitte versuchen Sie es erneut.",
  retryable: true,
};

const KEYWORD_MAP: ReadonlyArray<{ test: RegExp; result: FriendlyError }> = [
  { test: /\b(insufficient|out of|no)\s+credits?\b/i, result: NO_CREDITS },
  { test: /\bcredits?\s+(exhausted|exceeded|depleted|empty)\b/i, result: NO_CREDITS },
  { test: /\bquota\s+(exceeded|exhausted)\b/i, result: NO_CREDITS },
  { test: /\b(billing|payment|subscription)\b/i, result: NO_CREDITS },
  { test: /\bguthaben\b/i, result: NO_CREDITS },
  { test: /\bconcurrent\s+(session|connection|limit)/i, result: CONCURRENT_LIMIT },
  { test: /\bsession\s+limit\s+(reached|exceeded)/i, result: CONCURRENT_LIMIT },
  { test: /\brate[\s-]?limit/i, result: RATE_LIMITED },
  { test: /\btoo\s+many\s+requests\b/i, result: RATE_LIMITED },
  { test: /\b(unauthorized|invalid\s+(api[\s-]?key|token))\b/i, result: AUTH_FAILED },
  { test: /\bavatar\s+(not\s+(found|available)|unavailable)/i, result: AVATAR_NOT_AVAILABLE },
  { test: /\bpersona\s+not\s+(found|available)/i, result: AVATAR_NOT_AVAILABLE },
];

const NUMERIC_CODE_MAP: Readonly<Record<string, FriendlyError>> = {
  "10005": NO_CREDITS,
  "10006": NO_CREDITS,
  "10007": NO_CREDITS,
  "400118": NO_CREDITS,
  "400119": CONCURRENT_LIMIT,
  "400120": CONCURRENT_LIMIT,
  "10001": AUTH_FAILED,
  "10002": AUTH_FAILED,
  "10003": AUTH_FAILED,
  "40012": AVATAR_NOT_AVAILABLE,
  "40013": AVATAR_NOT_AVAILABLE,
};

function withTechnical(error: FriendlyError, input: AvatarErrorInput): FriendlyError {
  const parts: string[] = [];
  if (input.code !== undefined && input.code !== null) parts.push(`Code ${input.code}`);
  if (input.status !== undefined && input.status !== null) parts.push(`HTTP ${input.status}`);
  if (input.message) parts.push(input.message);
  if (input.reason) parts.push(input.reason);
  return {
    ...error,
    technical: parts.length > 0 ? parts.join(" · ") : undefined,
  };
}

export function mapAvatarError(input: AvatarErrorInput): FriendlyError {
  const status = input.status ?? null;
  const code = input.code !== undefined && input.code !== null ? String(input.code) : null;
  const haystack = `${input.message ?? ""} ${input.reason ?? ""}`.trim();

  if (input.cause === "session_disconnect") {
    if (input.reason === "SESSION_START_FAILED") {
      return withTechnical(SESSION_START_FAILED, input);
    }
    if (input.reason === "SERVER_INITIATED" || input.reason === "UNKNOWN_REASON") {
      return withTechnical(SESSION_DISCONNECTED_SERVER, input);
    }
  }

  if (code && NUMERIC_CODE_MAP[code]) {
    return withTechnical(NUMERIC_CODE_MAP[code], input);
  }

  if (haystack) {
    for (const { test, result } of KEYWORD_MAP) {
      if (test.test(haystack)) {
        return withTechnical(result, input);
      }
    }
  }

  if (status === 401 || status === 403) return withTechnical(AUTH_FAILED, input);
  if (status === 429) return withTechnical(RATE_LIMITED, input);
  if (status && status >= 500 && status < 600) return withTechnical(SERVER_ERROR, input);
  if (status === 0 || input.message?.toLowerCase().includes("failed to fetch")) {
    return withTechnical(NETWORK_ERROR, input);
  }

  if (input.message?.toLowerCase().includes("liveavatar_api_key")) {
    return withTechnical(CONFIG_MISSING, input);
  }

  return withTechnical(GENERIC, input);
}

export class AvatarStartError extends Error {
  readonly cause: AvatarErrorCause;
  readonly status: number | null;
  readonly code: number | string | null;
  readonly upstreamMessage: string | null;

  constructor(args: {
    cause: AvatarErrorCause;
    status?: number | null;
    code?: number | string | null;
    message?: string;
    upstreamMessage?: string | null;
  }) {
    super(args.message ?? args.upstreamMessage ?? `Avatar start failed (${args.cause})`);
    this.name = "AvatarStartError";
    this.cause = args.cause;
    this.status = args.status ?? null;
    this.code = args.code ?? null;
    this.upstreamMessage = args.upstreamMessage ?? null;
  }
}
