import { loadSettings } from "../shared/settings";
import {
  constrainTocPosition,
  constrainTocSize,
  getDefaultTocLayout,
  type TocPosition,
  type TocSize
} from "./toc-position";

type TocHeading = {
  element: HTMLElement;
  level: number;
  text: string;
};

type TocMessage = {
  message: HTMLElement;
  scrollTarget: HTMLElement;
  headings: TocHeading[];
  userPreview: string;
};

type CachedHeading = {
  level: number;
  text: string;
  element: HTMLElement | null;
};

type CachedEntry = {
  scrollTarget: HTMLElement;
  headings: CachedHeading[];
  userPreview: string;
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
const USER_QUERY_SELECTORS = [
  "user-query",
  "[class*='user-query']",
  "[data-test-id='user-query']",
  ".query-text"
];
const USER_PREVIEW_MAX_CHARS = 160;

let panel: HTMLElement | undefined;
let trigger: HTMLButtonElement | undefined;
let themeButton: HTMLButtonElement | undefined;
let nav: HTMLElement | undefined;
let content: HTMLElement | undefined;
let mutationObserver: MutationObserver | undefined;
let intersectionObserver: IntersectionObserver | undefined;
let headingObserver: IntersectionObserver | undefined;
const headingToButtonMap = new Map<Element, HTMLButtonElement>();
const messageCache = new Map<HTMLElement, CachedEntry>();
let themeObserver: MutationObserver | undefined;
let scanTimer: number | undefined;
let urlTimer: number | undefined;
let currentUrl = window.location.href;
let closedByUser = false;
let initialized = false;
let themeMode: TocThemeMode = "auto";
let lastTocFingerprint = "";
let resizeTimer: number | undefined;
let userAdjustedLayout = false;

export async function initGeminiToc(): Promise<void> {
  if (initialized) return;
  initialized = true;

  const settings = await loadSettings();
  if (!settings.tocEnabled) return;

  await waitForDocumentBody();
  createTocShell();
  await restoreThemeMode();
  observeThemeChanges();
  scheduleScan(INITIAL_SCAN_DELAY_MS);

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
    refreshToc(true);
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
  keepPanelInViewport();
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

function buildTocFingerprint(entries: CachedEntry[]): string {
  return entries
    .map((e) => `${e.userPreview}\n${e.headings.map((h) => `${h.level}:${h.text}`).join("\n")}`)
    .join("\n\n");
}

function mergeFreshIntoCache(freshMessages: TocMessage[]): void {
  for (const msg of freshMessages) {
    const existing = messageCache.get(msg.scrollTarget);
    if (existing) {
      if (msg.userPreview) existing.userPreview = msg.userPreview;
      const freshMap = new Map(msg.headings.map((h) => [`${h.level}\0${h.text}`, h.element]));
      for (const cached of existing.headings) {
        const key = `${cached.level}\0${cached.text}`;
        const freshEl = freshMap.get(key);
        if (freshEl) {
          cached.element = freshEl;
          freshMap.delete(key);
        } else if (cached.element && !cached.element.isConnected) {
          cached.element = null;
        }
      }
      for (const [key, el] of freshMap) {
        const [level, text] = key.split("\0");
        existing.headings.push({ level: Number(level), text, element: el });
      }
    } else {
      messageCache.set(msg.scrollTarget, {
        scrollTarget: msg.scrollTarget,
        headings: msg.headings.map((h) => ({ level: h.level, text: h.text, element: h.element })),
        userPreview: msg.userPreview
      });
    }
  }

  for (const [target] of messageCache) {
    if (!target.isConnected) messageCache.delete(target);
  }
}

function buildOrderedEntries(): CachedEntry[] {
  return Array.from(messageCache.values())
    .sort((a, b) => {
      const pos = a.scrollTarget.compareDocumentPosition(b.scrollTarget);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });
}

function refreshToc(force = false): void {
  if (!panel || !nav || !content) return;

  mergeFreshIntoCache(collectMessages());
  const entries = buildOrderedEntries();
  const fingerprint = buildTocFingerprint(entries);

  if (!force && fingerprint === lastTocFingerprint) {
    reconnectHeadingObserver(entries);
    return;
  }
  lastTocFingerprint = fingerprint;

  intersectionObserver?.disconnect();
  intersectionObserver = undefined;
  headingObserver?.disconnect();
  headingObserver = undefined;
  headingToButtonMap.clear();
  nav.replaceChildren();
  content.replaceChildren();

  if (entries.length === 0) {
    panel.hidden = true;
    if (trigger) trigger.hidden = true;
    return;
  }

  for (const [index, entry] of entries.entries()) {
    const messageIndex = index + 1;
    nav.append(createNavItem(entry, messageIndex));
    content.append(createMessageGroup(entry, messageIndex));
  }

  observeVisibleMessages(entries);
  observeHeadingHighlight(entries);

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
    messages.push({
      message: element,
      scrollTarget: findResponseScrollTarget(element),
      headings,
      userPreview: findPrecedingUserPreview(element)
    });
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

function collectUserQueryCandidates(): HTMLElement[] {
  const candidates = new Set<HTMLElement>();
  for (const selector of USER_QUERY_SELECTORS) {
    for (const element of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
      if (element.closest(`[${TOC_ATTRIBUTE}]`)) continue;
      if (element.closest("model-response, [class*='model-response']")) continue;
      candidates.add(element);
    }
  }

  return Array.from(candidates).filter(
    (candidate) => !Array.from(candidates).some((other) => other !== candidate && other.contains(candidate))
  );
}

function findPrecedingUserPreview(response: HTMLElement): string {
  let best: HTMLElement | undefined;
  for (const userQuery of collectUserQueryCandidates()) {
    const position = userQuery.compareDocumentPosition(response);
    if (!(position & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
    if (!best || (best.compareDocumentPosition(userQuery) & Node.DOCUMENT_POSITION_FOLLOWING)) {
      best = userQuery;
    }
  }
  return best ? extractUserPreview(best) : "";
}

function extractUserPreview(element: HTMLElement): string {
  const preferred = Array.from(
    element.querySelectorAll<HTMLElement>(
      ".query-text, .query-text-line, .query-content, [class*='query-text']"
    )
  ).find((node) => normalizeHeadingText(node.innerText || node.textContent || ""));
  const source = preferred ?? element;
  const raw = normalizeHeadingText(source.innerText || source.textContent || "");
  const text = raw.replace(/^(?:You said|You say|你说|您说)\s*[:：]?\s*/iu, "").trim();
  if (!text) return "";
  return text.length <= USER_PREVIEW_MAX_CHARS ? text : text.slice(0, USER_PREVIEW_MAX_CHARS).trim();
}

function createNavItem(entry: CachedEntry, messageIndex: number): HTMLButtonElement {
  const button = createTocElement("button", "sp-toc-nav-item");
  button.type = "button";
  button.textContent = String(messageIndex);
  button.dataset.msgIndex = String(messageIndex);
  button.title = entry.userPreview
    ? `Reply ${messageIndex}: ${entry.userPreview}`
    : `Reply ${messageIndex}`;
  button.addEventListener("click", () => {
    scrollToMessageStart(entry, messageIndex);
    setActiveNavItem(messageIndex);
  });
  return button;
}

function createMessageGroup(entry: CachedEntry, messageIndex: number): HTMLElement {
  const group = createTocElement("section", "sp-toc-message");
  group.dataset.msgIndex = String(messageIndex);

  const label = createTocElement("button", "sp-toc-msg-label");
  label.type = "button";
  const labelText = createTocElement("span", "sp-toc-msg-label-text");
  const indexLabel = createTocElement("span", "sp-toc-msg-index");
  indexLabel.textContent = `Reply ${messageIndex}`;
  labelText.append(indexLabel);
  if (entry.userPreview) {
    const preview = createTocElement("span", "sp-toc-msg-preview");
    preview.textContent = ` · ${entry.userPreview}`;
    labelText.append(preview);
    label.title = `Go to reply ${messageIndex}: ${entry.userPreview}`;
  } else {
    label.title = `Go to reply ${messageIndex}`;
  }
  label.append(labelText);
  label.addEventListener("click", () => {
    scrollToMessageStart(entry, messageIndex);
    setActiveNavItem(messageIndex);
  });

  const items = createTocElement("div", "sp-toc-items");
  for (const heading of entry.headings) {
    const item = createTocElement("button", "sp-toc-item");
    item.type = "button";
    item.dataset.level = String(heading.level);
    item.textContent = heading.text;
    item.title = heading.text;
    item.addEventListener("click", () => {
      scrollToHeading(entry.scrollTarget, heading);
    });
    if (heading.element) headingToButtonMap.set(heading.element, item);
    items.append(item);
  }

  group.append(label, items);
  return group;
}

function isElementRendered(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function estimateScrollDirection(scroller: Element, target: HTMLElement): number {
  const rect = scroller.getBoundingClientRect();
  const probe = document.elementFromPoint(rect.left + rect.width / 2, rect.top + 20);
  if (probe instanceof HTMLElement) {
    const pos = target.compareDocumentPosition(probe);
    if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
  }
  return 1;
}

function scrollToHeading(scrollTarget: HTMLElement, heading: CachedHeading): void {
  if (heading.element && isElementRendered(heading.element)) {
    heading.element.scrollIntoView({ block: "center" });
    return;
  }
  const scroller = findScrollableAncestor(scrollTarget);
  const dir = estimateScrollDirection(scroller, scrollTarget);
  if (isElementRendered(scrollTarget)) {
    scrollTarget.scrollIntoView({ block: "center" });
  }
  seekHeading(scroller, scrollTarget, heading, dir, 0, -1);
}

function scrollToMessageStart(entry: CachedEntry, messageIndex: number): void {
  if (isElementRendered(entry.scrollTarget)) {
    entry.scrollTarget.scrollIntoView({ block: "start" });
    content
      ?.querySelector<HTMLElement>(`.sp-toc-message[data-msg-index="${messageIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
    return;
  }
  const scroller = findScrollableAncestor(entry.scrollTarget);
  const dir = estimateScrollDirection(scroller, entry.scrollTarget);
  seekElement(scroller, entry.scrollTarget, dir, () => {
    content
      ?.querySelector<HTMLElement>(`.sp-toc-message[data-msg-index="${messageIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, "start");
}

function seekElement(
  scroller: Element,
  target: HTMLElement,
  direction: number,
  onFound: () => void,
  block: ScrollLogicalPosition
): void {
  let dir = direction;
  let attempt = 0;
  let prevTop = -1;
  let boundaryHits = 0;

  const step = (): void => {
    if (isElementRendered(target)) {
      target.scrollIntoView({ block });
      onFound();
      return;
    }
    if (attempt >= 40) return;
    attempt++;

    const currentTop = scroller.scrollTop;
    if (currentTop === prevTop) {
      boundaryHits++;
      if (boundaryHits >= 2) {
        if (dir === direction) { dir = -direction; boundaryHits = 0; }
        else return;
      }
    } else {
      boundaryHits = 0;
    }
    prevTop = currentTop;
    scroller.scrollBy({ top: dir * scroller.clientHeight * 0.7 });
    window.setTimeout(step, 150);
  };
  window.setTimeout(step, 150);
}

function seekHeading(
  scroller: Element,
  scrollTarget: HTMLElement,
  heading: CachedHeading,
  direction: number,
  attempt: number,
  prevTop: number
): void {
  const MAX = 40;
  const STEP_MS = 150;

  window.setTimeout(() => {
    const found = findHeadingByText(document.body, heading.text, heading.level);
    if (found) {
      heading.element = found;
      found.scrollIntoView({ block: "center" });
      return;
    }
    if (attempt >= MAX) return;

    const currentTop = scroller.scrollTop;
    if (currentTop === prevTop && attempt > 0) {
      if (direction > 0) {
        if (isElementRendered(scrollTarget)) scrollTarget.scrollIntoView({ block: "center" });
        seekHeading(scroller, scrollTarget, heading, -1, attempt + 1, -1);
      }
      return;
    }
    scroller.scrollBy({ top: direction * scroller.clientHeight * 0.7 });
    seekHeading(scroller, scrollTarget, heading, direction, attempt + 1, currentTop);
  }, STEP_MS);
}

function findScrollableAncestor(el: HTMLElement): Element {
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return document.documentElement;
}

function findHeadingByText(container: HTMLElement, text: string, level: number): HTMLElement | null {
  for (const el of Array.from(container.querySelectorAll<HTMLElement>(`h${level}`))) {
    if (el.closest(`[${TOC_ATTRIBUTE}]`)) continue;
    if (normalizeHeadingText(el.textContent ?? "") === text) return el;
  }
  return null;
}

function findResponseScrollTarget(message: HTMLElement): HTMLElement {
  return message.closest<HTMLElement>(RESPONSE_SCROLL_TARGET_SELECTOR) ?? message;
}

function reconnectHeadingObserver(entries: CachedEntry[]): void {
  headingObserver?.disconnect();
  headingObserver = undefined;
  headingToButtonMap.clear();

  if (!content) return;
  for (const el of Array.from(content.querySelectorAll(".sp-toc-item-active"))) {
    el.classList.remove("sp-toc-item-active");
  }
  for (const [i, entry] of entries.entries()) {
    const section = content.querySelector<HTMLElement>(`.sp-toc-message[data-msg-index="${i + 1}"]`);
    if (!section) continue;
    const buttons = Array.from(section.querySelectorAll<HTMLButtonElement>(".sp-toc-item"));
    for (let j = 0; j < entry.headings.length && j < buttons.length; j++) {
      if (entry.headings[j].element?.isConnected) {
        headingToButtonMap.set(entry.headings[j].element!, buttons[j]);
      }
    }
  }
  observeHeadingHighlight(entries);
}

function observeHeadingHighlight(entries: CachedEntry[]): void {
  headingObserver = new IntersectionObserver(
    (observed) => {
      for (const oe of observed) {
        if (!oe.isIntersecting) continue;
        const button = headingToButtonMap.get(oe.target);
        if (!button) continue;
        for (const btn of headingToButtonMap.values()) {
          btn.classList.remove("sp-toc-item-active");
        }
        button.classList.add("sp-toc-item-active");
        button.scrollIntoView({ block: "nearest" });
        const msgIndex = button.closest<HTMLElement>("[data-msg-index]")?.dataset.msgIndex;
        if (msgIndex) setActiveNavItem(Number(msgIndex));
      }
    },
    { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
  );

  for (const entry of entries) {
    for (const heading of entry.headings) {
      if (heading.element?.isConnected) headingObserver.observe(heading.element);
    }
  }
}

function observeVisibleMessages(cachedEntries: CachedEntry[]): void {
  intersectionObserver = new IntersectionObserver(
    (observed) => {
      const visible = observed
        .filter((o) => o.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const index = cachedEntries.findIndex((e) => e.scrollTarget === visible.target);
      if (index >= 0) setActiveNavItem(index + 1);
    },
    { threshold: 0.1 }
  );

  for (const entry of cachedEntries) {
    if (entry.scrollTarget.isConnected) intersectionObserver.observe(entry.scrollTarget);
  }
}

function setActiveNavItem(messageIndex: number): void {
  if (!nav) return;
  for (const button of Array.from(nav.querySelectorAll<HTMLElement>(".sp-toc-nav-item"))) {
    button.classList.toggle("sp-toc-nav-active", button.dataset.msgIndex === String(messageIndex));
  }
  if (!content) return;
  for (const section of Array.from(content.querySelectorAll<HTMLElement>("[data-msg-index]"))) {
    const isActive = section.dataset.msgIndex === String(messageIndex);
    section.querySelector(".sp-toc-msg-label")?.classList.toggle("sp-toc-msg-label-active", isActive);
  }
}

function startDrag(event: PointerEvent, handle: HTMLElement): void {
  if (!panel || event.button !== 0 || event.target instanceof HTMLButtonElement) return;

  const rect = panel.getBoundingClientRect();
  const offsetX = event.clientX - rect.left;
  const offsetY = event.clientY - rect.top;
  let moved = false;

  handle.setPointerCapture(event.pointerId);
  panel.classList.add("sp-toc-panel--dragging");

  const move = (moveEvent: PointerEvent): void => {
    if (!panel) return;
    moved = true;
    userAdjustedLayout = true;
    setPanelPosition(constrainPosition(moveEvent.clientX - offsetX, moveEvent.clientY - offsetY));
  };

  const up = (): void => {
    if (!panel) return;
    panel.classList.remove("sp-toc-panel--dragging");
    if (moved) {
      const current = panel.getBoundingClientRect();
      void chrome.storage.local.set({ [POSITION_KEY]: { left: current.left, top: current.top } });
    }
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
  let moved = false;

  handle.setPointerCapture(event.pointerId);
  panel.classList.add("sp-toc-panel--resizing");

  const move = (moveEvent: PointerEvent): void => {
    if (!panel) return;
    moved = true;
    userAdjustedLayout = true;
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
    if (moved) {
      const current = panel.getBoundingClientRect();
      void chrome.storage.local.set({
        [POSITION_KEY]: { left: current.left, top: current.top },
        [SIZE_KEY]: { width: current.width, height: current.height }
      });
    }
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
  const fallbackHeight = rect.height || window.innerHeight * 0.5;
  return {
    left: Number.isFinite(left) ? left : window.innerWidth - 228,
    top: Number.isFinite(top) ? top : (window.innerHeight - fallbackHeight) / 2
  };
}

function keepPanelInViewport(): void {
  if (!panel || panel.hidden) return;
  if (!userAdjustedLayout) {
    applyDefaultLayout();
    return;
  }
  if (hasCustomPanelSize()) {
    const size = constrainSize(getPanelSize().width, getPanelSize().height);
    setPanelSize(size);
  }
  setPanelPosition(constrainPosition(getCurrentPanelPosition().left, getCurrentPanelPosition().top));
}

function applyDefaultLayout(): void {
  if (!panel || userAdjustedLayout || panel.hidden) return;

  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const collapsed = panel.classList.contains("sp-toc-panel--collapsed");
  const layout = getDefaultTocLayout(viewport, 228, measureNaturalPanelHeight(), collapsed);
  setPanelSize(layout.size);
  setPanelPosition(layout.position);
}

function measureNaturalPanelHeight(): number {
  if (!panel) return 0;
  if (panel.classList.contains("sp-toc-panel--collapsed")) {
    const header = panel.querySelector<HTMLElement>(".sp-toc-header");
    if (!header) return 0;
    const borders = Math.max(0, panel.offsetHeight - panel.clientHeight);
    return header.getBoundingClientRect().height + borders;
  }

  const previousHeight = panel.style.height;
  const previousMaxHeight = panel.style.maxHeight;
  panel.style.height = "auto";
  panel.style.maxHeight = "none";
  const height = panel.scrollHeight;
  panel.style.height = previousHeight;
  panel.style.maxHeight = previousMaxHeight;
  return height;
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

function handleRouteChange(): void {
  currentUrl = window.location.href;
  lastTocFingerprint = "";
  messageCache.clear();
  intersectionObserver?.disconnect();
  headingObserver?.disconnect();
  headingObserver = undefined;
  headingToButtonMap.clear();
  nav?.replaceChildren();
  content?.replaceChildren();
  scheduleScan(600);
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
  });
})();
