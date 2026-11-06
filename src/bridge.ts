import { initialVault, stateSchema, type Vault, type Plan, type ExchangeRates } from "./model";
export type UpdateState = {status: "idle"|"unavailable"|"checking"|"available"|"current"|"downloading"|"ready"|"installing"|"error"; currentVersion:string; version:string; percent:number; message:string};
declare global {
  interface Window {
    payday?: {
      exchangeRates: () => Promise<ExchangeRates>;
      updateStatus: () => Promise<UpdateState>;
      checkUpdates: () => Promise<UpdateState>;
      downloadUpdate: () => Promise<UpdateState>;
      installUpdate: () => Promise<UpdateState>;
      onUpdate: (callback: (state:UpdateState)=>void) => () => void;
      reset: () => Promise<Vault>;
      uninstall: () => Promise<boolean>;
      load: () => Promise<{ vault: Vault | null; hasKey: boolean }>;
      save: (v: Vault) => Promise<void>;
      checkKey: () => Promise<{ model: string }>;
      setKey: (key: string) => Promise<void>;
      ai: (prompt: string, plan: Plan) => Promise<Plan | { reply: string }>;
      export: () => Promise<boolean>;
      decodeBackup: (text: string) => Promise<Vault>;
    };
  }
}
let previewVault: Vault | null = null;
export const storage = {
  async reset() {
    if (window.payday) return window.payday.reset();
    previewVault = initialVault();
    return structuredClone(previewVault);
  },
  async uninstall() {
    if (!window.payday)
      throw new Error(
        "Use Windows Installed apps to uninstall the desktop app.",
      );
    return window.payday.uninstall();
  },
  async load() {
    if (window.payday) return window.payday.load();
    return { vault: previewVault, hasKey: false };
  },
  async save(v: Vault) {
    stateSchema.parse(v);
    if (window.payday) return window.payday.save(v);
    previewVault = structuredClone(v);
  },
  async checkKey() {
    if (!window.payday)
      throw new Error("Test the Gemini connection in the Windows desktop app.");
    return window.payday.checkKey();
  },
  async setKey(k: string) {
    if (!window.payday)
      throw new Error("Open the desktop app to securely save a Gemini key.");
    return window.payday.setKey(k);
  },
  async ai(prompt: string, plan: Plan) {
    if (!window.payday)
      throw new Error(
        "Gemini is available in the desktop app. Use the offline planner here.",
      );
    return window.payday.ai(prompt, plan);
  },
  async decodeBackup(text: string) {
    return window.payday
      ? window.payday.decodeBackup(text)
      : stateSchema.parse(JSON.parse(text));
  },
  async export(v: Vault) {
    if (window.payday) return window.payday.export();
    throw new Error(
      "Encrypted backups require the Windows desktop app. The browser preview keeps data in memory only.",
    );
  },
  initial: initialVault,
};
