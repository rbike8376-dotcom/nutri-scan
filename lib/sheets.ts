// Google Sheets as a free database — server-side only (googleapis + service account).
// When env is not configured (local dev without Google setup), every function degrades
// gracefully: reads return empty values, writes are skipped with a console warning.
// Nothing here ever crashes the request pipeline.
import { google, type sheets_v4 } from "googleapis";

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";

export const TABS = {
  users: "Users",
  profiles: "Profiles",
  scans: "ScanHistory",
} as const;

// Header row reference (create these as row 1 in your sheet).
// The Users tab is auto-upgraded to the 7-column schema the first time an account is created.
export const HEADERS = {
  Users: ["userId", "email", "createdAt", "consentHistory", "username", "passwordHash", "salt"],
  Profiles: ["userId", "name", "goals", "allergies", "avoidList", "prescriptionText", "updatedAt"],
  ScanHistory: ["id", "userId", "productName", "barcode", "source", "rating", "allergyRisks", "reasons", "prescriptionContextUsed", "createdAt"],
} as const;

type ServiceAccount = { client_email?: string; private_key?: string };

function loadServiceAccount(): ServiceAccount | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    if (!parsed.client_email || !parsed.private_key) return null;
    // Vercel env vars store newlines escaped
    return { ...parsed, private_key: parsed.private_key.replace(/\\n/g, "\n") };
  } catch {
    return null;
  }
}

export function isSheetsConfigured(): boolean {
  return Boolean(loadServiceAccount() && process.env.SHEET_ID?.trim());
}

function getSheet(): sheets_v4.Sheets | null {
  const sa = loadServiceAccount();
  const sheetId = process.env.SHEET_ID?.trim();
  if (!sa || !sheetId) return null;
  const auth = new google.auth.JWT({ email: sa.client_email, key: sa.private_key, scopes: [SCOPE] });
  return google.sheets({ version: "v4", auth });
}

async function getValues(range: string): Promise<string[][]> {
  const sheet = getSheet();
  if (!sheet) return [];
  const res = await sheet.spreadsheets.values.get({ spreadsheetId: process.env.SHEET_ID!.trim(), range });
  return (res.data.values as string[][]) ?? [];
}

async function appendRow(tab: string, row: (string | number | boolean)[]): Promise<boolean> {
  const sheet = getSheet();
  if (!sheet) {
    console.warn(`[sheets] not configured — skipping append to ${tab}`);
    return false;
  }
  await sheet.spreadsheets.values.append({
    spreadsheetId: process.env.SHEET_ID!.trim(),
    range: `${tab}!A1`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row.map((v) => String(v))] },
  });
  return true;
}

async function updateRow(tab: string, rowNumber: number, row: (string | number | boolean)[]): Promise<boolean> {
  const sheet = getSheet();
  if (!sheet) return false;
  await sheet.spreadsheets.values.update({
    spreadsheetId: process.env.SHEET_ID!.trim(),
    range: `${tab}!A${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row.map((v) => String(v))] },
  });
  return true;
}

/** Find 1-based row number (including header offset) for a userId in column A. 0 = not found. */
async function findRowByUserId(tab: string, userId: string): Promise<number> {
  const rows = await getValues(`${tab}!A:A`);
  for (let i = 1; i < rows.length; i += 1) {
    if ((rows[i]?.[0] ?? "").trim() === userId) return i + 1;
  }
  return 0;
}

function csv(list: string[] | undefined): string {
  return (list ?? []).join(", ").replace(/[\n\r]/g, " ").slice(0, 500);
}
function fromCsv(raw: string | undefined): string[] {
  return (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

// ---------- Public API ----------

export type StoredProfile = {
  userId: string;
  name: string;
  goals: string[];
  allergies: string[];
  avoidList: string[];
  prescriptionText: string;
  updatedAt: string;
};

/** Creates a Users row if missing. Returns userId. No-op (returns input) when unconfigured. */
export async function ensureUser(userId: string, email = ""): Promise<string> {
  if (!isSheetsConfigured()) return userId;
  try {
    const row = await findRowByUserId(TABS.users, userId);
    if (!row) {
      await appendRow(TABS.users, [userId, email, new Date().toISOString(), true]);
    }
  } catch (err) {
    console.error("[sheets] ensureUser failed:", err);
  }
  return userId;
}

export async function getProfile(userId: string): Promise<StoredProfile | null> {
  if (!isSheetsConfigured()) return null;
  try {
    const rows = await getValues(`${TABS.profiles}!A2:G`);
    const row = rows.find((r) => (r?.[0] ?? "").trim() === userId);
    if (!row) return null;
    return {
      userId,
      name: row[1] ?? "",
      goals: fromCsv(row[2]),
      allergies: fromCsv(row[3]),
      avoidList: fromCsv(row[4]),
      prescriptionText: row[5] ?? "",
      updatedAt: row[6] ?? "",
    };
  } catch (err) {
    console.error("[sheets] getProfile failed:", err);
    return null;
  }
}

export async function upsertProfile(input: Omit<StoredProfile, "updatedAt">): Promise<{ stored: boolean }> {
  if (!isSheetsConfigured()) return { stored: false };
  try {
    const row = [
      input.userId,
      input.name,
      csv(input.goals),
      csv(input.allergies),
      csv(input.avoidList),
      (input.prescriptionText ?? "").replace(/[\n\r]/g, " ").slice(0, 2000),
      new Date().toISOString(),
    ];
    const existing = await findRowByUserId(TABS.profiles, input.userId);
    const ok = existing ? await updateRow(TABS.profiles, existing, row) : await appendRow(TABS.profiles, row);
    return { stored: ok };
  } catch (err) {
    console.error("[sheets] upsertProfile failed:", err);
    return { stored: false };
  }
}

export type ScanLogEntry = {
  userId: string;
  productName: string;
  barcode?: string;
  source: "barcode" | "ocr";
  rating: "good" | "caution" | "avoid";
  allergyRisks: string[]; // e.g. ["peanut(high)"]
  reasons: string[];
  prescriptionContextUsed?: boolean;
};

/** Appends one scan row. Never throws — caller does not need to await for UX. */
export async function logScan(entry: ScanLogEntry): Promise<boolean> {
  if (!isSheetsConfigured()) {
    console.warn("[sheets] not configured — scan not logged");
    return false;
  }
  try {
    return await appendRow(TABS.scans, [
      crypto.randomUUID(),
      entry.userId,
      entry.productName.replace(/[\n\r]/g, " ").slice(0, 200),
      entry.barcode ?? "",
      entry.source,
      entry.rating,
      entry.allergyRisks.join("; ").slice(0, 500),
      JSON.stringify(entry.reasons).slice(0, 1500),
      Boolean(entry.prescriptionContextUsed),
      new Date().toISOString(),
    ]);
  } catch (err) {
    console.error("[sheets] logScan failed:", err);
    return false;
  }
}

// ---------- User consent (Users tab, col D) ----------

export async function getUserConsent(userId: string): Promise<boolean> {
  if (!isSheetsConfigured()) return false;
  try {
    const rows = await getValues(`${TABS.users}!A2:D`);
    const row = rows.find((r) => (r?.[0] ?? "").trim() === userId);
    if (!row) return false;
    return String(row[3] ?? "").trim().toLowerCase() === "true";
  } catch (err) {
    console.error("[sheets] getUserConsent failed:", err);
    return false;
  }
}

export async function setUserConsent(userId: string, consent: boolean, email = ""): Promise<boolean> {
  if (!isSheetsConfigured()) return false;
  try {
    const rows = await getValues(`${TABS.users}!A2:D`);
    const idx = rows.findIndex((r) => (r?.[0] ?? "").trim() === userId);
    if (idx >= 0) {
      const sheet = getSheet();
      if (!sheet) return false;
      await sheet.spreadsheets.values.update({
        spreadsheetId: process.env.SHEET_ID!.trim(),
        range: `${TABS.users}!D${idx + 2}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [[String(consent)]] },
      });
      return true;
    }
    return appendRow(TABS.users, [userId, email, new Date().toISOString(), consent]);
  } catch (err) {
    console.error("[sheets] setUserConsent failed:", err);
    return false;
  }
}

// ---------- Scan delete / clear ----------

async function getSheetIdByTitle(title: string): Promise<number | null> {
  const sheet = getSheet();
  if (!sheet) return null;
  const meta = await sheet.spreadsheets.get({ spreadsheetId: process.env.SHEET_ID!.trim(), fields: "sheets.properties" });
  const match = meta.data.sheets?.find((s) => s.properties?.title === title);
  return match?.properties?.sheetId ?? null;
}

async function deleteRows(tab: string, rowNumbers: number[]): Promise<number> {
  const sheet = getSheet();
  const sheetId = await getSheetIdByTitle(tab);
  if (!sheet || sheetId === null || rowNumbers.length === 0) return 0;
  // Delete from the bottom up so indices stay valid
  const requests = [...new Set(rowNumbers)]
    .sort((a, b) => b - a)
    .map((rowNumber) => ({
      deleteDimension: {
        range: { sheetId, dimension: "ROWS", startIndex: rowNumber - 1, endIndex: rowNumber },
      },
    }));
  await sheet.spreadsheets.batchUpdate({ spreadsheetId: process.env.SHEET_ID!.trim(), requestBody: { requests } });
  return requests.length;
}

export async function deleteAllUserData(userId: string): Promise<{ profiles: number; users: number; scans: number }> {
  if (!isSheetsConfigured()) return { profiles: 0, users: 0, scans: 0 };
  try {
    const collect = (rows: string[][], matchCol = 0) => {
      const out: number[] = [];
      for (let i = 1; i < rows.length; i += 1) {
        if ((rows[i]?.[matchCol] ?? "").trim() === userId) out.push(i + 1);
      }
      return out;
    };
    const profiles = await deleteRows(TABS.profiles, collect(await getValues(`${TABS.profiles}!A:A`)));
    const users = await deleteRows(TABS.users, collect(await getValues(`${TABS.users}!A:A`)));
    const scans = await clearScans(userId);
    return { profiles, users, scans };
  } catch (err) {
    console.error("[sheets] deleteAllUserData failed:", err);
    return { profiles: 0, users: 0, scans: 0 };
  }
}

export async function deleteScan(userId: string, scanId: string): Promise<boolean> {
  if (!isSheetsConfigured()) return false;
  try {
    const rows = await getValues(`${TABS.scans}!A:B`);
    const targets: number[] = [];
    for (let i = 1; i < rows.length; i += 1) {
      if ((rows[i]?.[0] ?? "").trim() === scanId && (rows[i]?.[1] ?? "").trim() === userId) targets.push(i + 1);
    }
    return (await deleteRows(TABS.scans, targets)) > 0;
  } catch (err) {
    console.error("[sheets] deleteScan failed:", err);
    return false;
  }
}

export async function clearScans(userId: string): Promise<number> {
  if (!isSheetsConfigured()) return 0;
  try {
    const rows = await getValues(`${TABS.scans}!A:B`);
    const targets: number[] = [];
    for (let i = 1; i < rows.length; i += 1) {
      if ((rows[i]?.[1] ?? "").trim() === userId) targets.push(i + 1);
    }
    return deleteRows(TABS.scans, targets);
  } catch (err) {
    console.error("[sheets] clearScans failed:", err);
    return 0;
  }
}

// ---------- Admin read + audit ----------

export async function ensureTab(title: string, headers: string[]): Promise<void> {
  const sheet = getSheet();
  if (!sheet) return;
  const spreadsheetId = process.env.SHEET_ID!.trim();
  const meta = await sheet.spreadsheets.get({ spreadsheetId, fields: "sheets.properties.title" });
  const titles = new Set((meta.data.sheets ?? []).map((s) => s.properties?.title));
  if (!titles.has(title)) {
    await sheet.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] },
    });
  }
  const first = await sheet.spreadsheets.values.get({ spreadsheetId, range: `${title}!A1:Z1` });
  if ((first.data.values?.[0] ?? []).length === 0) {
    await sheet.spreadsheets.values.update({ spreadsheetId, range: `${title}!A1`, valueInputOption: "RAW", requestBody: { values: [headers] } });
  }
}

export async function readAdminConfig(): Promise<string | null> {
  if (!isSheetsConfigured()) return null;
  try {
    await ensureTab("AdminSettings", ["key", "json"]);
    const rows = await getValues("AdminSettings!A2:B");
    const cfg = rows.find((r) => (r?.[0] ?? "").trim() === "config");
    return cfg?.[1] ?? null;
  } catch (err) {
    console.error("[sheets] readAdminConfig failed:", err);
    return null;
  }
}

export async function writeAdminConfig(json: string): Promise<boolean> {
  if (!isSheetsConfigured()) return false;
  try {
    await ensureTab("AdminSettings", ["key", "json"]);
    const rows = await getValues("AdminSettings!A:A");
    let target = -1;
    for (let i = 1; i < rows.length; i += 1) {
      if ((rows[i]?.[0] ?? "").trim() === "config") { target = i + 1; break; }
    }
    const sheet = getSheet();
    if (!sheet) return false;
    if (target > 0) {
      await sheet.spreadsheets.values.update({
        spreadsheetId: process.env.SHEET_ID!.trim(),
        range: `AdminSettings!A${target}:B${target}`,
        valueInputOption: "RAW",
        requestBody: { values: [["config", json]] },
      });
      return true;
    }
    return await appendRow("AdminSettings", ["config", json]);
  } catch (err) {
    console.error("[sheets] writeAdminConfig failed:", err);
    return false;
  }
}

export type AdminUser = { userId: string; email: string; createdAt: string; consentHistory: boolean };
export type AdminProfile = { userId: string; name: string; goals: string[]; allergies: string[]; avoidList: string[]; prescriptionText: string; updatedAt: string };

export async function listUsers(limit = 300): Promise<AdminUser[]> {
  if (!isSheetsConfigured()) return [];
  try {
    const rows = await getValues(`${TABS.users}!A2:D`);
    return rows.slice(-limit).map((r) => ({
      userId: r?.[0] ?? "",
      email: r?.[1] ?? "",
      createdAt: r?.[2] ?? "",
      consentHistory: String(r?.[3] ?? "").trim().toLowerCase() === "true",
    }));
  } catch (err) {
    console.error("[sheets] listUsers failed:", err);
    return [];
  }
}

export async function listProfiles(limit = 300): Promise<AdminProfile[]> {
  if (!isSheetsConfigured()) return [];
  try {
    const rows = await getValues(`${TABS.profiles}!A2:G`);
    return rows.slice(-limit).map((r) => ({
      userId: r?.[0] ?? "",
      name: r?.[1] ?? "",
      goals: fromCsv(r?.[2]),
      allergies: fromCsv(r?.[3]),
      avoidList: fromCsv(r?.[4]),
      prescriptionText: r?.[5] ?? "",
      updatedAt: r?.[6] ?? "",
    }));
  } catch (err) {
    console.error("[sheets] listProfiles failed:", err);
    return [];
  }
}

export type AdminScan = StoredScan & { userId: string };

export async function listScansAll(limit = 200): Promise<AdminScan[]> {
  if (!isSheetsConfigured()) return [];
  try {
    const rows = await getValues(`${TABS.scans}!A2:J`);
    return rows.slice(-limit).reverse().map((r) => ({
      id: r?.[0] ?? "",
      userId: r?.[1] ?? "",
      productName: r?.[2] ?? "",
      barcode: r?.[3] ?? "",
      source: r?.[4] ?? "",
      rating: r?.[5] ?? "",
      allergyRisks: fromCsv((r?.[6] ?? "").replace(/;\s*/g, ", ")),
      reasons: (() => { try { return JSON.parse(r?.[7] ?? "[]") as string[]; } catch { return []; } })(),
      createdAt: r?.[9] ?? "",
    }));
  } catch (err) {
    console.error("[sheets] listScansAll failed:", err);
    return [];
  }
}

export async function logAdminAction(action: string, detail: string): Promise<boolean> {
  try {
    await ensureTab("AdminAudit", ["ts", "action", "detail"]);
    return await appendRow("AdminAudit", [new Date().toISOString(), action, detail.slice(0, 800)]);
  } catch (err) {
    console.error("[sheets] logAdminAction failed:", err);
    return false;
  }
}

export type AdminAuditEntry = { ts: string; action: string; detail: string };

export async function listAudit(limit = 100): Promise<AdminAuditEntry[]> {
  if (!isSheetsConfigured()) return [];
  try {
    const rows = await getValues("AdminAudit!A2:C");
    return rows.slice(-limit).reverse().map((r) => ({ ts: r?.[0] ?? "", action: r?.[1] ?? "", detail: r?.[2] ?? "" }));
  } catch {
    return []; // AdminAudit tab not created yet — no actions logged
  }
}

export type StoredScan = {
  id: string;
  productName: string;
  barcode: string;
  source: string;
  rating: string;
  allergyRisks: string[];
  reasons: string[];
  createdAt: string;
};

export async function getScanHistory(userId: string, limit = 50): Promise<StoredScan[]> {
  if (!isSheetsConfigured()) return [];
  try {
    const rows = await getValues(`${TABS.scans}!A2:J`);
    return rows
      .filter((r) => (r?.[1] ?? "").trim() === userId)
      .slice(-limit)
      .reverse()
      .map((r) => ({
        id: r[0] ?? "",
        productName: r[2] ?? "",
        barcode: r[3] ?? "",
        source: r[4] ?? "",
        rating: r[5] ?? "",
        allergyRisks: fromCsv((r[6] ?? "").replace(/;\s*/g, ", ")),
        reasons: (() => { try { return JSON.parse(r[7] ?? "[]") as string[]; } catch { return []; } })(),
        createdAt: r[9] ?? "",
      }));
  } catch (err) {
    console.error("[sheets] getScanHistory failed:", err);
    return [];
  }
}

// ---------- User accounts (credentials, server-side only) ----------

const AUTH_COLS = { userId: 0, email: 1, createdAt: 2, consent: 3, username: 4, passwordHash: 5, salt: 6 } as const;
export const AUTH_HEADERS = ["userId", "email", "createdAt", "consentHistory", "username", "passwordHash", "salt"] as const;

export type AuthUser = {
  userId: string;
  email: string;
  createdAt: string;
  consentHistory: boolean;
  username: string;
  salt: string;
  passwordHash: string;
};

/** Upgrade an existing 4-column Users tab to the 7-column schema in place (idempotent). */
async function ensureUsersSchema(): Promise<void> {
  const sheet = getSheet();
  if (!sheet) return;
  const first = await sheet.spreadsheets.values.get({ spreadsheetId: process.env.SHEET_ID!.trim(), range: `${TABS.users}!A1:G1` });
  const headers = (first.data.values?.[0] ?? []).map((h) => String(h));
  if (headers.length >= 7 && headers[AUTH_COLS.username] === "username") return;
  await sheet.spreadsheets.values.update({
    spreadsheetId: process.env.SHEET_ID!.trim(),
    range: `${TABS.users}!A1:G1`,
    valueInputOption: "RAW",
    requestBody: { values: [[...AUTH_HEADERS]] },
  });
}

function rowToAuthUser(r: (string | number | boolean)[]): AuthUser | null {
  const username = String(r?.[AUTH_COLS.username] ?? "").trim().toLowerCase();
  const passwordHash = String(r?.[AUTH_COLS.passwordHash] ?? "").trim();
  const salt = String(r?.[AUTH_COLS.salt] ?? "").trim();
  if (!username || !passwordHash || !salt) return null;
  return {
    userId: String(r?.[AUTH_COLS.userId] ?? ""),
    email: String(r?.[AUTH_COLS.email] ?? ""),
    createdAt: String(r?.[AUTH_COLS.createdAt] ?? ""),
    consentHistory: String(r?.[AUTH_COLS.consent] ?? "").trim().toLowerCase() === "true",
    username,
    salt,
    passwordHash,
  };
}

/** Look up a user account by normalized username. Returns null when Sheets is offline or not found. */
export async function findUserByUsername(username: string): Promise<AuthUser | null> {
  if (!isSheetsConfigured()) return null;
  try {
    const norm = username.trim().toLowerCase();
    if (!norm) return null;
    const rows = await getValues(`${TABS.users}!A2:G`);
    for (const r of rows) {
      if (String(r?.[AUTH_COLS.username] ?? "").trim().toLowerCase() === norm) return rowToAuthUser(r);
    }
    return null;
  } catch (err) {
    console.error("[sheets] findUserByUsername failed:", err);
    return null;
  }
}

/** Look up by account userId (used for session hydration). */
export async function getUserById(userId: string): Promise<AuthUser | null> {
  if (!isSheetsConfigured()) return null;
  try {
    const rows = await getValues(`${TABS.users}!A2:G`);
    for (const r of rows) {
      if (String(r?.[AUTH_COLS.userId] ?? "").trim() === userId) return rowToAuthUser(r);
    }
    return null;
  } catch (err) {
    console.error("[sheets] getUserById failed:", err);
    return null;
  }
}

export type CreateUserResult = { ok: true; userId: string } | { ok: false; error: string };

/** Create a user account. Caller hashes the password beforehand. */
export async function createUserAccount(input: { username: string; email?: string; passwordHash: string; salt: string }): Promise<CreateUserResult> {
  if (!isSheetsConfigured()) return { ok: false, error: "Accounts are unavailable — Google Sheets is not reachable." };
  const username = input.username.trim().toLowerCase();
  try {
    await ensureUsersSchema();
    const existing = await findUserByUsername(username);
    if (existing) return { ok: false, error: "That username is taken — pick another." };
    const userId = crypto.randomUUID();
    const ok = await appendRow(TABS.users, [
      userId,
      input.email ?? "",
      new Date().toISOString(),
      "false",
      username,
      input.passwordHash,
      input.salt,
    ]);
    if (!ok) return { ok: false, error: "Couldn't create the account — please try again." };
    return { ok: true, userId };
  } catch (err) {
    console.error("[sheets] createUserAccount failed:", err);
    return { ok: false, error: "Couldn't create the account — please try again." };
  }
}
