import { describe, expect, it } from "vitest";
import {
  createPlantUmlSvgUrl,
  encodePlantUmlHexSource,
  encodePlantUmlSource,
  normalizePlantUmlSource
} from "../src/render/plantuml";

describe("PlantUML rendering helpers", () => {
  it("wraps bare diagram bodies with @startuml/@enduml", () => {
    expect(normalizePlantUmlSource("  Alice -> Bob: hello\n")).toBe(
      "@startuml\nAlice -> Bob: hello\n@enduml"
    );
  });

  it("keeps complete diagrams unchanged apart from trimming", () => {
    expect(normalizePlantUmlSource("  @startuml\nBob -> Alice : hello\n@enduml\n")).toBe(
      "@startuml\nBob -> Alice : hello\n@enduml"
    );
  });

  it("strips toolbar chrome before @startuml", () => {
    expect(
      normalizePlantUmlSource("plantumlCopyDownload@startuml\nBob -> Alice : hello\n@enduml")
    ).toBe("@startuml\nBob -> Alice : hello\n@enduml");
  });

  it("recovers line breaks for sources flattened into a single line", () => {
    const flat =
      '@startumlactor 用户 as Userparticipant "前端页面" as Frontenddatabase "数据库" as DBUser -> Frontend : 输入账号Frontend -> DB : 查询@enduml';
    const normalized = normalizePlantUmlSource(flat);
    const lines = normalized.split("\n");
    expect(lines[0]).toBe("@startuml");
    expect(lines).toContain("actor 用户 as User");
    expect(lines).toContain('participant "前端页面" as Frontend');
    expect(lines).toContain('database "数据库" as DB');
    expect(lines).toContain("User -> Frontend : 输入账号");
    expect(lines).toContain("Frontend -> DB : 查询");
    expect(lines[lines.length - 1]).toBe("@enduml");
  });

  it("does not break English words that contain keyword substrings", () => {
    expect(normalizePlantUmlSource("@startuml\nactor Frontend\n@enduml")).toBe(
      "@startuml\nactor Frontend\n@enduml"
    );
  });

  it("appends @enduml when the diagram has @startuml but no @enduml", () => {
    expect(normalizePlantUmlSource("@startuml\nBob -> Alice : hello")).toBe(
      "@startuml\nBob -> Alice : hello\n@enduml"
    );
  });

  it("encodes a known PlantUML example", async () => {
    await expect(
      encodePlantUmlSource("@startuml\nBob -> Alice : hello\n@enduml")
    ).resolves.toMatch(/^[0-9A-Za-z_-]+$/u);
  });

  it("creates SVG URLs against the configured server", async () => {
    const url = await createPlantUmlSvgUrl(
      "@startuml\nBob -> Alice : hello\n@enduml",
      "https://example.com/plantuml/"
    );
    expect(url).toMatch(/^https:\/\/example\.com\/plantuml\/svg\/[0-9A-Za-z_-]+$/u);
  });

  it("supports PlantUML hex fallback encoding", () => {
    expect(encodePlantUmlHexSource("@startuml\nBob\n@enduml")).toMatch(/^~h[0-9a-f]+$/u);
  });
});
