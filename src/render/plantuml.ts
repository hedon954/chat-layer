const PLANTUML_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";
const PLANTUML_START_PATTERN = /@start[a-z0-9_-]*/iu;
const PLANTUML_END_PATTERN = /@end[a-z0-9_-]*/iu;

export function normalizePlantUmlSource(source: string): string {
  const trimmed = source.replace(/\u00a0/gu, " ").trim();

  const startMatch = trimmed.match(PLANTUML_START_PATTERN);
  if (!startMatch || startMatch.index === undefined) {
    return wrapAndRecoverLines(trimmed);
  }

  const fromStart = trimmed.slice(startMatch.index);
  const endMatch = fromStart.match(PLANTUML_END_PATTERN);
  const body = endMatch?.index !== undefined ? fromStart.slice(0, endMatch.index + endMatch[0].length) : `${fromStart}\n@enduml`;

  if (body.includes("\n")) {
    return body;
  }

  return recoverLines(body);
}

function wrapAndRecoverLines(body: string): string {
  const recovered = body.includes("\n") ? body : recoverLines(body);
  return `@startuml\n${recovered}\n@enduml`;
}

const PLANTUML_KEYWORD_PART =
  "(?:actor|participant|usecase|database|skinparam|abstract|annotation|interface|component|rectangle|hexagon|storage|boundary|control|entity|artifact|@end[a-z0-9_-]*)\\b";

const PLANTUML_ARROW_PART = "(?:->>?|<<?-|-->>?|<<--|\\.\\.>|<\\.\\.|--\\|\\||\\|\\|--)";

const RECOVER_AFTER_START = new RegExp(
  `(@start[a-z0-9_-]+?)(?=${PLANTUML_KEYWORD_PART})`,
  "giu"
);

const RECOVER_AFTER_AS = new RegExp(
  `(\\b(?:as|alt|else)\\s+[\\w\\u4e00-\\u9fff]+?)(?=${PLANTUML_KEYWORD_PART})`,
  "giu"
);

const RECOVER_AFTER_AS_BEFORE_ARROW = new RegExp(
  `((?:\\bas|\\balt|\\belse|\\bAS|\\bAlt|\\bELSE)\\s+[\\w\\u4e00-\\u9fff]+?)(?=[A-Z][a-z][\\w\\u4e00-\\u9fff]*\\s*${PLANTUML_ARROW_PART})`,
  "gu"
);

const RECOVER_CJK_TO_ASCII = /([\u4e00-\u9fff])(?=[A-Za-z@])/giu;

const RECOVER_BEFORE_END = /(?<=[\w\u4e00-\u9fff)"\]])(?=@end[a-z0-9_-]*\b)/giu;

function recoverLines(body: string): string {
  let recovered = body;
  recovered = recovered.replace(RECOVER_AFTER_START, "$1\n");
  recovered = recovered.replace(RECOVER_AFTER_AS, "$1\n");
  recovered = recovered.replace(RECOVER_AFTER_AS_BEFORE_ARROW, "$1\n");
  recovered = recovered.replace(RECOVER_CJK_TO_ASCII, "$1\n");
  recovered = recovered.replace(RECOVER_BEFORE_END, "\n");
  return recovered.replace(/[ \t]+\n/gu, "\n").replace(/\n{2,}/gu, "\n").trim();
}

export async function encodePlantUmlSource(source: string): Promise<string> {
  const bytes = new TextEncoder().encode(normalizePlantUmlSource(source));
  const compressed = await deflateRaw(bytes);
  return encodePlantUmlBytes(compressed);
}

export function encodePlantUmlHexSource(source: string): string {
  const bytes = new TextEncoder().encode(normalizePlantUmlSource(source));
  return `~h${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export async function createPlantUmlSvgUrl(source: string, serverBaseUrl: string): Promise<string> {
  const encoded = await encodePlantUmlSource(source).catch(() => encodePlantUmlHexSource(source));
  return `${serverBaseUrl.replace(/\/+$/, "")}/svg/${encoded}`;
}

function encodePlantUmlBytes(compressed: Uint8Array): string {
  let encoded = "";
  for (let index = 0; index < compressed.length; index += 3) {
    encoded += appendThreeBytes(
      compressed[index] ?? 0,
      compressed[index + 1] ?? 0,
      compressed[index + 2] ?? 0
    );
  }

  return encoded;
}

async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const input = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(input).set(bytes);
  const stream = new Blob([input]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function appendThreeBytes(byte1: number, byte2: number, byte3: number): string {
  const chunk1 = byte1 >> 2;
  const chunk2 = ((byte1 & 0x3) << 4) | (byte2 >> 4);
  const chunk3 = ((byte2 & 0xf) << 2) | (byte3 >> 6);
  const chunk4 = byte3 & 0x3f;

  return (
    encodeSixBit(chunk1 & 0x3f) +
    encodeSixBit(chunk2 & 0x3f) +
    encodeSixBit(chunk3 & 0x3f) +
    encodeSixBit(chunk4 & 0x3f)
  );
}

function encodeSixBit(value: number): string {
  return PLANTUML_ALPHABET[value] ?? "";
}
