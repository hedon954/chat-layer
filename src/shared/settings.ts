export const DEFAULT_PLANTUML_SERVER_BASE_URL = "https://www.plantuml.com/plantuml";

export type ExtensionSettings = {
  plantumlServerBaseUrl: string;
  tocEnabled: boolean;
};

export const DEFAULT_SETTINGS: ExtensionSettings = {
  plantumlServerBaseUrl: DEFAULT_PLANTUML_SERVER_BASE_URL,
  tocEnabled: true
};

export async function loadSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);

  return {
    plantumlServerBaseUrl: normalizePlantUmlServerBaseUrl(
      String(stored.plantumlServerBaseUrl ?? DEFAULT_SETTINGS.plantumlServerBaseUrl)
    ),
    tocEnabled: stored.tocEnabled !== false
  };
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.sync.set({
    plantumlServerBaseUrl: normalizePlantUmlServerBaseUrl(settings.plantumlServerBaseUrl),
    tocEnabled: settings.tocEnabled
  });
}

export function normalizePlantUmlServerBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  return trimmed.length > 0 ? trimmed : DEFAULT_PLANTUML_SERVER_BASE_URL;
}
