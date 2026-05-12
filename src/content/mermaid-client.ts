type MermaidRequest = {
  source: "show-pic-content";
  type: "render-mermaid";
  requestId: string;
  code: string;
  theme: "default" | "dark";
  darkMode: boolean;
};

type MermaidResponse = {
  source: "show-pic-sandbox";
  type: "render-mermaid-result";
  requestId: string;
  svg?: string;
  error?: string;
};

type PendingRender = {
  resolve: (svg: string) => void;
  reject: (error: Error) => void;
};

const REQUEST_TIMEOUT_MS = 15_000;

let sandboxFrame: HTMLIFrameElement | null = null;
let sandboxReady: Promise<void> | null = null;
const pendingRenders = new Map<string, PendingRender>();

export async function renderMermaidDiagram(code: string): Promise<string> {
  await ensureSandboxFrame();

  const requestId = crypto.randomUUID();
  const target = sandboxFrame?.contentWindow;

  if (!target) {
    throw new Error("Mermaid renderer is not available.");
  }

  const request: MermaidRequest = {
    source: "show-pic-content",
    type: "render-mermaid",
    requestId,
    code,
    theme: "default",
    darkMode: false
  };

  return new Promise<string>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      pendingRenders.delete(requestId);
      reject(new Error("Mermaid rendering timed out."));
    }, REQUEST_TIMEOUT_MS);

    pendingRenders.set(requestId, {
      resolve: (svg) => {
        window.clearTimeout(timeoutId);
        resolve(svg);
      },
      reject: (error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      }
    });

    target.postMessage(request, "*");
  });
}

function ensureSandboxFrame(): Promise<void> {
  if (sandboxReady) {
    return sandboxReady;
  }

  window.addEventListener("message", handleSandboxMessage);

  sandboxFrame = document.createElement("iframe");
  sandboxFrame.tabIndex = -1;
  sandboxFrame.title = "Show Pic Mermaid renderer";
  sandboxFrame.src = chrome.runtime.getURL("sandbox/mermaid.html");
  sandboxFrame.setAttribute("aria-hidden", "true");
  sandboxFrame.style.cssText = [
    "position: fixed",
    "left: -10000px",
    "top: 0",
    "width: 1600px",
    "height: 1200px",
    "border: 0",
    "opacity: 0",
    "pointer-events: none",
    "z-index: -1"
  ].join(";");

  sandboxReady = new Promise((resolve, reject) => {
    sandboxFrame?.addEventListener("load", () => resolve(), { once: true });
    sandboxFrame?.addEventListener("error", () => reject(new Error("Failed to load Mermaid renderer.")), {
      once: true
    });
  });

  document.documentElement.append(sandboxFrame);
  return sandboxReady;
}

function handleSandboxMessage(event: MessageEvent<MermaidResponse>): void {
  if (event.source !== sandboxFrame?.contentWindow) {
    return;
  }

  const response = event.data;
  if (response?.source !== "show-pic-sandbox" || response.type !== "render-mermaid-result") {
    return;
  }

  const pending = pendingRenders.get(response.requestId);
  if (!pending) {
    return;
  }

  pendingRenders.delete(response.requestId);

  if (response.svg) {
    pending.resolve(response.svg);
    return;
  }

  pending.reject(new Error(response.error ?? "Mermaid rendering failed."));
}
