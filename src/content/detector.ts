export type DiagramType = "mermaid" | "plantuml";

export type DetectedDiagram = {
  type: DiagramType;
  source: string;
};

const MERMAID_PREFIXES = [
  "architecture-beta",
  "block-beta",
  "classDiagram",
  "erDiagram",
  "flowchart",
  "gantt",
  "gitGraph",
  "graph",
  "journey",
  "mindmap",
  "pie",
  "quadrantChart",
  "requirementDiagram",
  "sequenceDiagram",
  "stateDiagram",
  "stateDiagram-v2",
  "timeline",
  "xychart-beta"
];

const PLANTUML_LANGUAGES = new Set(["plantuml", "puml"]);
const DIAGRAM_LANGUAGES = new Set(["mermaid", ...PLANTUML_LANGUAGES]);

export function detectDiagram(source: string, languageHints: readonly string[] = []): DetectedDiagram | null {
  const initialSource = source.trim();
  const normalizedHints = languageHints.map(normalizeLanguageHint).filter(Boolean);
  const prepared = prepareDiagramSource(initialSource);
  const normalizedSource = prepared.source;
  if (normalizedSource.length === 0) {
    return null;
  }

  if (prepared.language) {
    normalizedHints.push(prepared.language);
  }

  if (normalizedHints.includes("mermaid") && hasMinimumLength(normalizedSource)) {
    return { type: "mermaid", source: normalizedSource };
  }

  if (normalizedHints.some((hint) => PLANTUML_LANGUAGES.has(hint)) && isValidPlantUmlSource(normalizedSource)) {
    return { type: "plantuml", source: normalizedSource };
  }

  if (looksLikePlantUml(normalizedSource) && isValidPlantUmlSource(normalizedSource)) {
    return { type: "plantuml", source: normalizedSource };
  }

  if (looksLikeMermaid(normalizedSource)) {
    return { type: "mermaid", source: normalizedSource };
  }

  return null;
}

export function extractLanguageHints(element: Element): string[] {
  const hints = new Set<string>();
  let current: Element | null = element;

  while (current) {
    for (const className of Array.from(current.classList)) {
      const hint = className.replace(/^(language|lang)-/u, "");
      if (hint !== className || PLANTUML_LANGUAGES.has(hint) || hint === "mermaid") {
        hints.add(hint);
      }
    }

    const dataLanguage = current.getAttribute("data-language") ?? current.getAttribute("data-lang");
    if (dataLanguage) {
      hints.add(dataLanguage);
    }

    if (current.tagName.toLowerCase() === "pre") {
      break;
    }

    current = current.parentElement;
  }

  return Array.from(hints);
}

function looksLikePlantUml(source: string): boolean {
  return /^@start[a-z0-9_-]*/iu.test(source);
}

function looksLikeMermaid(source: string): boolean {
  const firstLine = source.split(/\r?\n/u, 1)[0]?.trim() ?? "";
  return isMermaidStartLine(firstLine);
}

const PLANTUML_KEYWORD_PATTERN =
  /(^|\n|\s)(@start[a-z0-9_-]+|actor|participant|usecase|class|interface|abstract|enum|annotation|object|node|component|database|queue|cloud|frame|folder|rectangle|package|state|boundary|entity|control|agent|artifact|hexagon|storage|stack|file|person|left to right direction|top to bottom direction|skinparam|title|legend|note (left|right|top|bottom|over))/iu;

const PLANTUML_ARROW_PATTERN = /(-->?|<--?|->>?|<<-|\.\.>|<\.\.|\|\|--|--\|\||--)/u;

function isValidPlantUmlSource(source: string): boolean {
  const trimmed = source.trim();
  if (!hasMinimumLength(trimmed)) {
    return false;
  }

  if (looksLikePlantUml(trimmed)) {
    return true;
  }

  return PLANTUML_KEYWORD_PATTERN.test(trimmed) || PLANTUML_ARROW_PATTERN.test(trimmed);
}

function hasMinimumLength(source: string): boolean {
  return source.trim().length >= 6;
}

function normalizeLanguageHint(value: string): string {
  return value.trim().toLowerCase().replace(/^(language|lang)-/u, "");
}

function extractFirstLineLanguage(source: string): string | null {
  const firstLine = source.split(/\r?\n/u, 1)[0] ?? "";
  const language = normalizeLanguageHint(firstLine);
  return DIAGRAM_LANGUAGES.has(language) ? language : null;
}

function stripFirstLine(source: string): string {
  return source.replace(/^[^\r\n]*(?:\r?\n|$)/u, "").trim();
}

function prepareDiagramSource(source: string): { source: string; language: string | null } {
  const fenced = extractFencedDiagram(source);
  if (fenced) {
    return fenced;
  }

  const firstLineLanguage = extractFirstLineLanguage(source);
  if (firstLineLanguage) {
    return {
      source: stripFirstLine(source),
      language: firstLineLanguage
    };
  }

  const lines = source.split(/\r?\n/u);
  const diagramStartIndex = lines.findIndex((line, index) => {
    if (index > 8) {
      return false;
    }

    const trimmed = line.trim();
    return looksLikePlantUml(trimmed) || isMermaidStartLine(trimmed);
  });

  if (diagramStartIndex > 0) {
    return {
      source: lines.slice(diagramStartIndex).join("\n").trim(),
      language: null
    };
  }

  return { source, language: null };
}

function isMermaidStartLine(line: string): boolean {
  return MERMAID_PREFIXES.some((prefix) => line === prefix || line.startsWith(`${prefix} `));
}

function extractFencedDiagram(source: string): { source: string; language: string } | null {
  const match = source.match(/^```([a-z0-9_-]+)\s*\n([\s\S]*?)\n?```\s*$/iu);
  if (!match) {
    return null;
  }

  const language = normalizeLanguageHint(match[1] ?? "");
  if (!DIAGRAM_LANGUAGES.has(language)) {
    return null;
  }

  return {
    source: (match[2] ?? "").trim(),
    language
  };
}
