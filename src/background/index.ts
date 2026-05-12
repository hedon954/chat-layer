import type { FetchPlantUmlSvgMessage, FetchPlantUmlSvgResponse } from "../shared/plantuml-render";
import type { OpenViewerMessage } from "../shared/viewer";

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (isFetchPlantUmlSvgMessage(message)) {
    void fetchPlantUmlSvg(message.url).then(sendResponse);
    return true;
  }

  if (isOpenViewerMessage(message)) {
    const url = chrome.runtime.getURL(`viewer/index.html?id=${encodeURIComponent(message.viewerId)}`);
    void chrome.windows.create({
      url,
      type: "popup",
      width: 1200,
      height: 820,
      focused: true
    });
  }

  return false;
});

async function fetchPlantUmlSvg(url: string): Promise<FetchPlantUmlSvgResponse> {
  try {
    const response = await fetch(url, {
      credentials: "omit",
      cache: "force-cache"
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `PlantUML server responded with status ${response.status}.`
      };
    }

    return {
      ok: true,
      svg: await response.text()
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to fetch PlantUML SVG."
    };
  }
}

function isFetchPlantUmlSvgMessage(message: unknown): message is FetchPlantUmlSvgMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === "show-pic-fetch-plantuml-svg" &&
    "url" in message &&
    typeof message.url === "string"
  );
}

function isOpenViewerMessage(message: unknown): message is OpenViewerMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === "show-pic-open-viewer" &&
    "viewerId" in message &&
    typeof message.viewerId === "string"
  );
}
