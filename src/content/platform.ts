export type Platform = "chatgpt" | "gemini" | "other";

export function detectPlatform(): Platform {
  const host = window.location.hostname.toLowerCase();

  if (host === "chatgpt.com" || host.endsWith(".chatgpt.com") || host === "chat.openai.com") {
    return "chatgpt";
  }

  if (host === "gemini.google.com" || host.endsWith(".gemini.google.com")) {
    return "gemini";
  }

  return "other";
}

export const PLATFORM: Platform = detectPlatform();

export function shouldRenderDiagram(): boolean {
  switch (PLATFORM) {
    case "chatgpt":
      return false;
    case "gemini":
      return true;
    default:
      return true;
  }
}
