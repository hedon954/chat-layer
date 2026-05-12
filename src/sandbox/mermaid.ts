import mermaid from "mermaid";

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

window.addEventListener("message", (event: MessageEvent<MermaidRequest>) => {
  const request = event.data;

  if (request?.source !== "show-pic-content" || request.type !== "render-mermaid") {
    return;
  }

  void render(request, event);
});

async function render(request: MermaidRequest, event: MessageEvent<MermaidRequest>): Promise<void> {
  try {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "default",
      deterministicIds: true,
      flowchart: {
        htmlLabels: false
      }
    });

    await document.fonts?.ready;
    const renderId = `show-pic-${request.requestId}`;
    const { svg } = await mermaid.render(renderId, request.code);
    respond(event, {
      source: "show-pic-sandbox",
      type: "render-mermaid-result",
      requestId: request.requestId,
      svg
    });
  } catch (error) {
    respond(event, {
      source: "show-pic-sandbox",
      type: "render-mermaid-result",
      requestId: request.requestId,
      error: error instanceof Error ? error.message : "Unknown Mermaid rendering error."
    });
  }
}

function respond(event: MessageEvent<MermaidRequest>, response: MermaidResponse): void {
  event.source?.postMessage(response, { targetOrigin: "*" });
}
