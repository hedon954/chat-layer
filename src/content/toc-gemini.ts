import { loadSettings } from "../shared/settings";
import { constrainTocPosition, constrainTocSize, type TocPosition, type TocSize } from "./toc-position";

type TocHeading = {
  element: HTMLElement;
  level: number;
  text: string;
};

type TocMessage = {
  message: HTMLElement;
  scrollTarget: HTMLElement;
  headings: TocHeading[];
};

type TocThemeMode = "auto" | "light" | "dark";
type ResizeDirection = "sw" | "se";

const TOC_ATTRIBUTE = "data-show-pic-toc";
const POSITION_KEY = "sp-toc-position-gemini";
const SIZE_KEY = "sp-toc-size-gemini";
const THEME_KEY = "sp-toc-theme-gemini";
const SCAN_DEBOUNCE_MS = 300;
const URL_CHECK_INTERVAL_MS = 1_000;
const INITIAL_SCAN_DELAY_MS = 600;
const RESPONSE_SELECTORS = [
  "model-response .markdown",
  "model-response",
  ".model-response-text",
  "message-content",
  "[class*='model-response'] [class*='markdown']",
  "[class*='response'] .markdown"
];
const RESPONSE_SCROLL_TARGET_SELECTOR = [
  "model-response",
  "message-content",
  "[class*='model-response']",
  "[class*='response']"
].join(",");

let panel: HTMLElement | undefined;
let trigger: HTMLButtonElement | undefined;
let themeButton: HTMLButtonElement | undefined;
let nav: HTMLElement | undefined;
let content: HTMLElement | undefined;
let mutationObserver: MutationObserver | undefined;
let intersectionObserver: IntersectionObserver | undefined;
let headingObserver: IntersectionObserver | undefined;
const headingToButtonMap = new Map<Element, HTMLButtonElement>();
let themeObserver: MutationObserver | undefined;
let scanTimer: number | undefined;
let urlTimer: number | undefined;
let progressiveTimers: number[] = [];
let currentUrl = window.location.href;
let closedByUser = false;
let initialized = false;
let themeMode: TocThemeMode = "auto";
let resizeTimer: number | undefined;

export async function initGeminiToc(): Promise<void> {
  if (initialized) return;
  initialized = true;

  const settings = await loadSettings();
  if (!settings.tocEnabled) return;

  await waitForDocumentBody();
  createTocShell();
  await restoreSize();
  await restorePosition();
  await restoreThemeMode();
  observeThemeChanges();
  scheduleScan(INITIAL_SCAN_DELAY_MS);
  scheduleProgressiveRescan();

  mutationObserver = new MutationObserver((records) => {
    if (records.every((record) => isTocMutation(record))) return;
    scheduleScan(SCAN_DEBOUNCE_MS);
  });
  mutationObserver.observe(document.body, { childList: true, subtree: true, characterData: true });

  window.addEventListener("popstate", handleRouteChange);
  window.addEventListener("resize", handleViewportChange);
  window.visualViewport?.addEventListener("resize", handleViewportChange);
  window.visualViewport?.addEventListener("scroll", handleViewportChange);
  urlTimer = window.setInterval(() => {
    if (window.location.href === currentUrl) return;
    handleRouteChange();
  }, URL_CHECK_INTERVAL_MS);
}

async function waitForDocumentBody(): Promise<void> {
  if (document.body) return;
  await new Promise<void>((resolve) => {
    window.addEventListener("DOMContentLoaded", () => resolve(), { once: true });
  });
}

function createTocShell(): void {
  panel = createTocElement("aside", "sp-toc-panel");
  panel.setAttribute("aria-label", "Conversation table of contents");
  panel.hidden = true;

  const header = createTocElement("div", "sp-toc-header");
  const title = createTocElement("div", "sp-toc-title");
  title.textContent = "Contents";

  const actions = createTocElement("div", "sp-toc-actions");

  const refreshButton = createTocElement("button", "sp-toc-refresh");
  refreshButton.type = "button";
  refreshButton.textContent = "↻";
  refreshButton.title = "Refresh contents";
  refreshButton.addEventListener("click", () => {
    refreshButton.classList.add("sp-toc-refresh--spinning");
    refreshToc();
    window.setTimeout(() => refreshButton.classList.remove("sp-toc-refresh--spinning"), 400);
  });

  themeButton = createTocElement("button", "sp-toc-theme");
  themeButton.type = "button";
  themeButton.addEventListener("click", () => {
    void cycleThemeMode();
  });

  const collapseButton = createTocElement("button", "sp-toc-collapse");
  collapseButton.type = "button";
  collapseButton.textContent = "−";
  collapseButton.title = "Collapse contents";
  collapseButton.addEventListener("click", () => toggleCollapsed(collapseButton));

  const closeButton = createTocElement("button", "sp-toc-close");
  closeButton.type = "button";
  closeButton.textContent = "×";
  closeButton.title = "Hide contents";
  closeButton.addEventListener("click", closePanel);
  actions.append(refreshButton, themeButton, collapseButton, closeButton);
  header.append(title, actions);
  header.addEventListener("pointerdown", (event) => startDrag(event, header));

  const body = createTocElement("div", "sp-toc-body");
  nav = createTocElement("div", "sp-toc-nav");
  content = createTocElement("div", "sp-toc-content");
  body.append(nav, content);
  const resizeSouthWest = createResizeHandle("sw");
  const resizeSouthEast = createResizeHandle("se");
  panel.append(header, body, resizeSouthWest, resizeSouthEast);

  trigger = createTocElement("button", "sp-toc-trigger");
  trigger.type = "button";
  trigger.textContent = "☰";
  trigger.title = "Show contents";
  trigger.hidden = true;
  trigger.addEventListener("click", openPanel);

  document.body.append(panel, trigger);
  applyTocTheme();
}

function createResizeHandle(direction: ResizeDirection): HTMLElement {
  const handle = createTocElement("div", `sp-toc-resize sp-toc-resize--${direction}`);
  handle.title = "Resize contents";
  handle.setAttribute("aria-hidden", "true");
  handle.addEventListener("pointerdown", (event) => startResize(event, direction, handle));
  return handle;
}

function createTocElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className: string
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  element.className = className;
  element.setAttribute(TOC_ATTRIBUTE, "1");
  return element;
}

function toggleCollapsed(button: HTMLButtonElement): void {
  if (!panel) return;
  const collapsed = panel.classList.toggle("sp-toc-panel--collapsed");
  button.textContent = collapsed ? "+" : "−";
  button.title = collapsed ? "Expand contents" : "Collapse contents";
}

function closePanel(): void {
  if (!panel || !trigger) return;
  closedByUser = true;
  panel.hidden = true;
  trigger.hidden = false;
}

function openPanel(): void {
  if (!panel || !trigger) return;
  closedByUser = false;
  panel.hidden = false;
  trigger.hidden = true;
  keepPanelInViewport();
  scheduleScan(0);
}

function isTocMutation(record: MutationRecord): boolean {
  if (record.target instanceof Element && record.target.closest(`[${TOC_ATTRIBUTE}]`)) return true;
  const addedNodes = Array.from(record.addedNodes);
  return addedNodes.length > 0 && addedNodes.every(
    (node) => node instanceof Element && node.closest(`[${TOC_ATTRIBUTE}]`)
  );
}

function scheduleScan(delay: number): void {
  if (scanTimer !== undefined) {
    window.clearTimeout(scanTimer);
  }
  scanTimer = window.setTimeout(() => {
    scanTimer = undefined;
    refreshToc();
  }, delay);
}

function refreshToc(): void {
  if (!panel || !nav || !content) return;

  const messages = collectMessages();
  intersectionObserver?.disconnect();
  intersectionObserver = undefined;
  headingObserver?.disconnect();
  headingObserver = undefined;
  headingToButtonMap.clear();
  nav.replaceChildren();
  content.replaceChildren();

  if (messages.length === 0) {
    panel.hidden = true;
    if (trigger) trigger.hidden = true;
    return;
  }

  for (const [index, message] of messages.entries()) {
    const messageIndex = index + 1;
    nav.append(createNavItem(message, messageIndex));
    content.append(createMessageGroup(message, messageIndex));
  }

  observeVisibleMessages(messages);
  observeHeadingHighlight(messages);

  if (!closedByUser) {
    panel.hidden = false;
    if (trigger) trigger.hidden = true;
    keepPanelInViewport();
  } else if (trigger) {
    trigger.hidden = false;
  }
}

function collectMessages(): TocMessage[] {
  const messages: TocMessage[] = [];
  const candidates = collectResponseCandidates();

  for (const element of candidates) {
    const headings = collectHeadings(element);
    messages.push({ message: element, scrollTarget: findResponseScrollTarget(element), headings });
  }

  return messages;
}

function collectResponseCandidates(): HTMLElement[] {
  const candidates = new Set<HTMLElement>();
  for (const selector of RESPONSE_SELECTORS) {
    for (const element of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
      if (!element.closest(`[${TOC_ATTRIBUTE}]`)) {
        candidates.add(element);
      }
    }
  }

  return Array.from(candidates).filter(
    (candidate) => !Array.from(candidates).some((other) => other !== candidate && other.contains(candidate))
  );
}

function collectHeadings(message: HTMLElement): TocHeading[] {
  const headings: TocHeading[] = [];
  for (const heading of Array.from(message.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6"))) {
    if (heading.closest(`[${TOC_ATTRIBUTE}]`)) continue;
    const text = normalizeHeadingText(heading.textContent ?? "");
    if (!text) continue;
    if (isGeminiAttributionHeading(text)) continue;
    headings.push({
      element: heading,
      level: Number(heading.tagName.slice(1)),
      text
    });
  }
  return headings;
}

function normalizeHeadingText(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}

function isGeminiAttributionHeading(text: string): boolean {
  return /^(?:Gemini\s*(?:说|says|said))$/iu.test(text);
}

async function restoreThemeMode(): Promise<void> {
  const stored = await chrome.storage.local.get(THEME_KEY);
  themeMode = isTocThemeMode(stored[THEME_KEY]) ? stored[THEME_KEY] : "auto";
  applyTocTheme();
}

function isTocThemeMode(value: unknown): value is TocThemeMode {
  return value === "auto" || value === "light" || value === "dark";
}

async function cycleThemeMode(): Promise<void> {
  themeMode = themeMode === "auto" ? "light" : themeMode === "light" ? "dark" : "auto";
  await chrome.storage.local.set({ [THEME_KEY]: themeMode });
  applyTocTheme();
}

function observeThemeChanges(): void {
  themeObserver?.disconnect();
  themeObserver = new MutationObserver(() => {
    if (themeMode === "auto") applyTocTheme();
  });

  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-theme", "style"]
  });
  themeObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ["class", "data-theme", "style"]
  });
}

function applyTocTheme(): void {
  const effectiveTheme = themeMode === "auto" ? detectHostTheme() : themeMode;
  for (const element of [panel, trigger]) {
    if (!element) continue;
    element.dataset.spTocTheme = effectiveTheme;
    element.dataset.spTocThemeMode = themeMode;
  }

  if (!themeButton) return;
  themeButton.textContent = themeMode === "auto" ? "A" : themeMode === "light" ? "L" : "D";
  themeButton.title =
    themeMode === "auto"
      ? `Theme: Auto (${effectiveTheme})`
      : themeMode === "light"
        ? "Theme: Light"
        : "Theme: Dark";
  themeButton.setAttribute("aria-label", themeButton.title);
}

function detectHostTheme(): "light" | "dark" {
  const elements = [document.documentElement, document.body];
  if (elements.some((element) => hasDarkThemeSignal(element))) return "dark";
  if (elements.some((element) => hasLightThemeSignal(element))) return "light";

  const colorScheme = getComputedStyle(document.documentElement).colorScheme;
  if (/\bdark\b/iu.test(colorScheme) && !/\blight\b/iu.test(colorScheme)) return "dark";

  const background = getComputedStyle(document.body).backgroundColor;
  const luminance = readRgbLuminance(background);
  if (luminance !== null) return luminance < 0.45 ? "dark" : "light";

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function hasDarkThemeSignal(element: HTMLElement): boolean {
  return (
    element.classList.contains("dark") ||
    element.dataset.theme === "dark" ||
    element.getAttribute("data-color-mode") === "dark"
  );
}

function hasLightThemeSignal(element: HTMLElement): boolean {
  return element.dataset.theme === "light" || element.getAttribute("data-color-mode") === "light";
}

function readRgbLuminance(value: string): number | null {
  const match = value.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/iu);
  if (!match) return null;
  const red = Number(match[1]) / 255;
  const green = Number(match[2]) / 255;
  const blue = Number(match[3]) / 255;
  if (![red, green, blue].every(Number.isFinite)) return null;
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function createNavItem(message: TocMessage, messageIndex: number): HTMLButtonElement {
  const button = createTocElement("button", "sp-toc-nav-item");
  button.type = "button";
  button.textContent = String(messageIndex);
  button.dataset.msgIndex = String(messageIndex);
  button.title = `Reply ${messageIndex}`;
  button.addEventListener("click", () => {
    scrollToMessageStart(message, messageIndex);
    setActiveNavItem(messageIndex);
  });
  return button;
}

function createMessageGroup(message: TocMessage, messageIndex: number): HTMLElement {
  const group = createTocElement("section", "sp-toc-message");
  group.dataset.msgIndex = String(messageIndex);

  const label = createTocElement("button", "sp-toc-msg-label");
  label.type = "button";
  label.textContent = `Reply ${messageIndex}`;
  label.title = `Go to reply ${messageIndex}`;
  label.addEventListener("click", () => {
    scrollToMessageStart(message, messageIndex);
    setActiveNavItem(messageIndex);
  });

  const items = createTocElement("div", "sp-toc-items");
  for (const heading of message.headings) {
    const item = createTocElement("button", "sp-toc-item");
    item.type = "button";
    item.dataset.level = String(heading.level);
    item.textContent = heading.text;
    item.title = heading.text;
    item.addEventListener("click", () => {
      heading.element.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    headingToButtonMap.set(heading.element, item);
    items.append(item);
  }

  group.append(label, items);
  return group;
}

function scrollToMessageStart(message: TocMessage, messageIndex: number): void {
  message.scrollTarget.scrollIntoView({ behavior: "smooth", block: "start" });
  content
    ?.querySelector<HTMLElement>(`.sp-toc-message[data-msg-index="${messageIndex}"]`)
    ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function findResponseScrollTarget(message: HTMLElement): HTMLElement {
  return message.closest<HTMLElement>(RESPONSE_SCROLL_TARGET_SELECTOR) ?? message;
}

function observeHeadingHighlight(messages: TocMessage[]): void {
  headingObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const button = headingToButtonMap.get(entry.target);
        if (!button) continue;
        for (const btn of headingToButtonMap.values()) {
          btn.classList.remove("sp-toc-item-active");
        }
        button.classList.add("sp-toc-item-active");
        button.scrollIntoView({ block: "nearest" });
      }
    },
    { rootMargin: "0px 0px -60% 0px" }
  );

  for (const message of messages) {
    for (const heading of message.headings) {
      headingObserver.observe(heading.element);
    }
  }
}

function observeVisibleMessages(messages: TocMessage[]): void {
  intersectionObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const index = messages.findIndex((message) => message.scrollTarget === visible.target);
      if (index >= 0) setActiveNavItem(index + 1);
    },
    { threshold: 0.1 }
  );

  for (const message of messages) {
    intersectionObserver.observe(message.scrollTarget);
  }
}

function setActiveNavItem(messageIndex: number): void {
  if (!nav) return;
  for (const button of Array.from(nav.querySelectorAll<HTMLElement>(".sp-toc-nav-item"))) {
    button.classList.toggle("sp-toc-nav-active", button.dataset.msgIndex === String(messageIndex));
  }
}

async function restorePosition(): Promise<void> {
  if (!panel) return;
  const stored = await chrome.storage.local.get(POSITION_KEY);
  const value = stored[POSITION_KEY];
  if (!isTocPosition(value)) return;
  setPanelPosition(constrainPosition(value.left, value.top));
}

async function restoreSize(): Promise<void> {
  if (!panel) return;
  const stored = await chrome.storage.local.get(SIZE_KEY);
  const value = stored[SIZE_KEY];
  if (!isTocSize(value)) return;
  setPanelSize(constrainSize(value.width, value.height));
}

function isTocPosition(value: unknown): value is TocPosition {
  if (typeof value !== "object" || value === null) return false;
  const position = value as Partial<TocPosition>;
  return typeof position.left === "number" && typeof position.top === "number";
}

function isTocSize(value: unknown): value is TocSize {
  if (typeof value !== "object" || value === null) return false;
  const size = value as Partial<TocSize>;
  return typeof size.width === "number" && typeof size.height === "number";
}

function startDrag(event: PointerEvent, handle: HTMLElement): void {
  if (!panel || event.button !== 0 || event.target instanceof HTMLButtonElement) return;

  const rect = panel.getBoundingClientRect();
  const offsetX = event.clientX - rect.left;
  const offsetY = event.clientY - rect.top;

  handle.setPointerCapture(event.pointerId);
  panel.classList.add("sp-toc-panel--dragging");

  const move = (moveEvent: PointerEvent): void => {
    if (!panel) return;
    setPanelPosition(constrainPosition(moveEvent.clientX - offsetX, moveEvent.clientY - offsetY));
  };

  const up = (): void => {
    if (!panel) return;
    panel.classList.remove("sp-toc-panel--dragging");
    const current = panel.getBoundingClientRect();
    void chrome.storage.local.set({ [POSITION_KEY]: { left: current.left, top: current.top } });
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up, { once: true });
}

function startResize(event: PointerEvent, direction: ResizeDirection, handle: HTMLElement): void {
  if (!panel || event.button !== 0) return;

  event.preventDefault();
  event.stopPropagation();

  const startRect = panel.getBoundingClientRect();
  const startRight = startRect.right;
  const startWidth = startRect.width;
  const startHeight = startRect.height;
  const startX = event.clientX;
  const startY = event.clientY;

  handle.setPointerCapture(event.pointerId);
  panel.classList.add("sp-toc-panel--resizing");

  const move = (moveEvent: PointerEvent): void => {
    if (!panel) return;
    const rawWidth =
      direction === "sw" ? startWidth + (startX - moveEvent.clientX) : startWidth + (moveEvent.clientX - startX);
    const rawHeight = startHeight + (moveEvent.clientY - startY);
    const size = constrainSize(rawWidth, rawHeight);
    const left = direction === "sw" ? startRight - size.width : startRect.left;

    setPanelSize(size);
    setPanelPosition(constrainPosition(left, startRect.top));
  };

  const up = (): void => {
    if (!panel) return;
    panel.classList.remove("sp-toc-panel--resizing");
    const current = panel.getBoundingClientRect();
    void chrome.storage.local.set({
      [POSITION_KEY]: { left: current.left, top: current.top },
      [SIZE_KEY]: { width: current.width, height: current.height }
    });
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up, { once: true });
}

function constrainPosition(left: number, top: number): TocPosition {
  return constrainTocPosition(
    { left, top },
    { width: window.innerWidth, height: window.innerHeight },
    getPanelSize()
  );
}

function constrainSize(width: number, height: number): TocSize {
  return constrainTocSize({ width, height }, { width: window.innerWidth, height: window.innerHeight });
}

function setPanelSize(size: TocSize): void {
  if (!panel) return;
  panel.style.width = `${size.width}px`;
  panel.style.height = `${size.height}px`;
  panel.style.maxHeight = "none";
}

function setPanelPosition(position: TocPosition): void {
  if (!panel) return;
  panel.style.left = `${position.left}px`;
  panel.style.top = `${position.top}px`;
  panel.style.right = "auto";
}

function getPanelSize(): TocSize {
  if (!panel) return { width: 0, height: 0 };
  const rect = panel.getBoundingClientRect();
  return {
    width: rect.width || panel.offsetWidth,
    height: rect.height || panel.offsetHeight
  };
}

function getCurrentPanelPosition(): TocPosition {
  if (!panel) return { left: 0, top: 0 };
  const rect = panel.getBoundingClientRect();
  const left = rect.width > 0 ? rect.left : Number.parseFloat(panel.style.left);
  const top = rect.height > 0 ? rect.top : Number.parseFloat(panel.style.top);
  return {
    left: Number.isFinite(left) ? left : window.innerWidth - 228 - 12,
    top: Number.isFinite(top) ? top : 80
  };
}

function keepPanelInViewport(): void {
  if (!panel || panel.hidden) return;
  if (hasCustomPanelSize()) {
    const size = constrainSize(getPanelSize().width, getPanelSize().height);
    setPanelSize(size);
  }
  setPanelPosition(constrainPosition(getCurrentPanelPosition().left, getCurrentPanelPosition().top));
}

function hasCustomPanelSize(): boolean {
  return Boolean(panel?.style.width && panel.style.height);
}

function handleViewportChange(): void {
  if (resizeTimer !== undefined) window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    resizeTimer = undefined;
    keepPanelInViewport();
  }, 50);
}

function countTocItems(): number {
  return content?.querySelectorAll(".sp-toc-item").length ?? 0;
}

function scheduleProgressiveRescan(): void {
  for (const timer of progressiveTimers) window.clearTimeout(timer);
  progressiveTimers = [];

  for (const delay of [2_000, 5_000]) {
    const before = countTocItems();
    const timer = window.setTimeout(() => {
      const after = countTocItems();
      if (after !== before) refreshToc();
    }, delay);
    progressiveTimers.push(timer);
  }
}

function handleRouteChange(): void {
  currentUrl = window.location.href;
  intersectionObserver?.disconnect();
  headingObserver?.disconnect();
  headingObserver = undefined;
  headingToButtonMap.clear();
  nav?.replaceChildren();
  content?.replaceChildren();
  scheduleScan(600);
  scheduleProgressiveRescan();
}

void (() => {
  window.addEventListener("pagehide", () => {
    mutationObserver?.disconnect();
    intersectionObserver?.disconnect();
    headingObserver?.disconnect();
    headingObserver = undefined;
    headingToButtonMap.clear();
    themeObserver?.disconnect();
    window.removeEventListener("resize", handleViewportChange);
    window.visualViewport?.removeEventListener("resize", handleViewportChange);
    window.visualViewport?.removeEventListener("scroll", handleViewportChange);
    if (resizeTimer !== undefined) window.clearTimeout(resizeTimer);
    if (urlTimer !== undefined) window.clearInterval(urlTimer);
    for (const timer of progressiveTimers) window.clearTimeout(timer);
    progressiveTimers = [];
  });
})();
