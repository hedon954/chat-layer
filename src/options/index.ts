import { DEFAULT_SETTINGS, loadSettings, normalizePlantUmlServerBaseUrl, saveSettings } from "../shared/settings";

const form = document.querySelector<HTMLFormElement>("#settings-form");
const input = document.querySelector<HTMLInputElement>("#plantuml-server");
const tocEnabledInput = document.querySelector<HTMLInputElement>("#toc-enabled");
const status = document.querySelector<HTMLElement>("#status");

void initializeOptions();

async function initializeOptions(): Promise<void> {
  if (!form || !input || !tocEnabledInput || !status) {
    return;
  }

  const settings = await loadSettings();
  input.value = settings.plantumlServerBaseUrl || DEFAULT_SETTINGS.plantumlServerBaseUrl;
  tocEnabledInput.checked = settings.tocEnabled;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void save();
  });
}

async function save(): Promise<void> {
  if (!input || !tocEnabledInput || !status) {
    return;
  }

  const plantumlServerBaseUrl = normalizePlantUmlServerBaseUrl(input.value);
  await saveSettings({ plantumlServerBaseUrl, tocEnabled: tocEnabledInput.checked });
  input.value = plantumlServerBaseUrl;
  status.textContent = "Settings saved.";

  window.setTimeout(() => {
    if (status) {
      status.textContent = "";
    }
  }, 2_000);
}
