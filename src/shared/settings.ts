export const DEFAULT_PLANTUML_SERVER_BASE_URL = "https://www.plantuml.com/plantuml";

export type ExtensionSettings = {
  plantumlServerBaseUrl: string;
};

export const DEFAULT_SETTINGS: ExtensionSettings = {
  plantumlServerBaseUrl: DEFAULT_PLANTUML_SERVER_BASE_URL
};

export async function loadSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);

  return {
    plantumlServerBaseUrl: normalizePlantUmlServerBaseUrl(
      String(stored.plantumlServerBaseUrl ?? DEFAULT_SETTINGS.plantumlServerBaseUrl)
    )
  };
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.sync.set({
    plantumlServerBaseUrl: normalizePlantUmlServerBaseUrl(settings.plantumlServerBaseUrl)
  });
}

export function normalizePlantUmlServerBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  return trimmed.length > 0 ? trimmed : DEFAULT_PLANTUML_SERVER_BASE_URL;
}
