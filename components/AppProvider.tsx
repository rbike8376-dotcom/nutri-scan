"use client";
// Shared client state: profile + pending (pre-verification) scan + last verdict.
// Images are object URLs kept in memory only — never uploaded, never persisted.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ProfileState = {
  userId: string;
  name: string;
  goals: string[];
  allergies: string[];
  avoidList: string[];
  prescriptionText: string;
  consentHistory: boolean;
};

export type PendingProduct = {
  source: "barcode" | "ocr";
  barcode: string;
  name: string;
  ingredients: string;
  containsStatement: string;
  nutritionPer100g: Record<string, number | string | null>;
  servingSize: string;
  imageUrls: string[];
  productImageUrl?: string;
  rawText?: string;
  confidence?: number;
  demoSample?: boolean;
};

export type AnalyzeVerdict = {
  rating: "good" | "caution" | "avoid";
  headline: string;
  shortSummary: string;
  simpleWords: string;
  calorieNote: string;
  buyOrSkip: string;
  reasons: string[];
  allergyRisks: { name: string; severity: "high" | "medium" | "low"; evidence: string }[];
  goalFit: { goal: string; verdict: "good" | "okay" | "poor" | "unknown"; note: string }[];
  alternatives: string[];
};

const PROFILE_CACHE = "nutriscan.profile";
const USER_ID_KEY = "nutriscan.userId";

export function getOrCreateUserId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(USER_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(USER_ID_KEY, id);
    }
    return id;
  } catch {
    // storage blocked/private mode — ephemeral id (history won't persist)
    return `ephemeral-${Date.now()}`;
  }
}

const emptyProfile: ProfileState = {
  userId: "",
  name: "",
  goals: [],
  allergies: [],
  avoidList: [],
  prescriptionText: "",
  consentHistory: false,
};

type Ctx = {
  profile: ProfileState;
  setProfile: (p: ProfileState) => void;
  profileLoaded: boolean;
  authUser: AuthUser;
  refreshAuth: () => Promise<AuthUser>;
  signOut: () => Promise<void>;
  pendingProduct: PendingProduct | null;
  setPendingProduct: (p: PendingProduct | null) => void;
  verdict: AnalyzeVerdict | null;
  setVerdict: (v: AnalyzeVerdict | null) => void;
  disclaimers: string[];
  setDisclaimers: (d: string[]) => void;
  aiAvailable: boolean;
  setAiAvailable: (v: boolean) => void;
  logged: boolean;
  setLogged: (v: boolean) => void;
  clearPending: () => void;
};

export type AuthUser = { userId: string; username: string; name?: string; email?: string } | null;

const AppContext = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<ProfileState>(emptyProfile);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser>(null);
  const [pendingProduct, setPendingProduct] = useState<PendingProduct | null>(null);
  const [verdict, setVerdict] = useState<AnalyzeVerdict | null>(null);
  const [disclaimers, setDisclaimers] = useState<string[]>([]);
  const [aiAvailable, setAiAvailable] = useState(true);
  const [logged, setLogged] = useState(false);

  /** Re-read the signed-in session; align the local userId so one account sees the same profile everywhere. */
  const refreshAuth = useCallback(async (): Promise<AuthUser> => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      const u = (data?.user ?? null) as AuthUser;
      setAuthUser(u);
      if (u?.userId) {
        try {
          // Device-local calls (onboarding fetch, analyze logging) read localStorage — point them at the account.
          localStorage.setItem(USER_ID_KEY, u.userId);
        } catch { /* storage blocked */ }
        setProfileState((p) => (p.userId === u.userId ? p : { ...p, userId: u.userId }));
      }
      return u;
    } catch {
      setAuthUser(null);
      return null;
    }
  }, []);

  const signOut = useCallback(async () => {
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch { /* network blip — still detach locally */ }
    try {
      localStorage.removeItem(USER_ID_KEY);
      localStorage.removeItem(PROFILE_CACHE);
    } catch { /* storage blocked */ }
    setAuthUser(null);
    setProfileState({ ...emptyProfile, userId: getOrCreateUserId() });
  }, []);

  // Restore profile cache on mount; prefill userId; then reconcile with the account session.
  useEffect(() => {
    const userId = getOrCreateUserId();
    try {
      const cached = localStorage.getItem(PROFILE_CACHE);
      if (cached) {
        const parsed = JSON.parse(cached) as ProfileState;
        setProfileState({ ...emptyProfile, ...parsed, userId: parsed.userId || userId });
      } else {
        setProfileState((p) => ({ ...p, userId }));
      }
    } catch {
      setProfileState((p) => ({ ...p, userId }));
    }
    void refreshAuth().finally(() => setProfileLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setProfile = useCallback((p: ProfileState) => {
    setProfileState(p);
    try {
      if (p.userId) localStorage.setItem(USER_ID_KEY, p.userId);
      localStorage.setItem(PROFILE_CACHE, JSON.stringify(p));
    } catch {
      /* storage full — keep in memory */
    }
  }, []);

  const clearPending = useCallback(() => {
    setPendingProduct((prev) => {
      prev?.imageUrls.forEach((u) => URL.revokeObjectURL(u));
      return null;
    });
    setVerdict(null);
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      profile, setProfile, profileLoaded, authUser, refreshAuth, signOut,
      pendingProduct, setPendingProduct,
      verdict, setVerdict,
      disclaimers, setDisclaimers,
      aiAvailable, setAiAvailable,
      logged, setLogged,
      clearPending,
    }),
    [profile, setProfile, profileLoaded, authUser, refreshAuth, signOut, pendingProduct, verdict, disclaimers, aiAvailable, logged, clearPending]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}
