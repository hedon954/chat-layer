import { describe, expect, it } from "vitest";
import { detectDiagram } from "../src/content/detector";

describe("detectDiagram", () => {
  it("detects Mermaid from a language hint", () => {
    expect(detectDiagram("not a known prefix", ["language-mermaid"])).toEqual({
      type: "mermaid",
      source: "not a known prefix"
    });
  });

  it("detects PlantUML from a language hint", () => {
    expect(detectDiagram("Alice -> Bob: hello", ["puml"])).toEqual({
      type: "plantuml",
      source: "Alice -> Bob: hello"
    });
  });

  it("detects Mermaid from common prefixes", () => {
    expect(detectDiagram("flowchart LR\nA --> B")).toEqual({
      type: "mermaid",
      source: "flowchart LR\nA --> B"
    });
  });

  it("detects PlantUML from start directives", () => {
    expect(detectDiagram("@startuml\nAlice -> Bob\n@enduml")).toEqual({
      type: "plantuml",
      source: "@startuml\nAlice -> Bob\n@enduml"
    });
  });

  it("detects PlantUML when a code block wrapper includes the language label in text", () => {
    expect(detectDiagram("plantuml\n@startuml\nAlice -> Bob\n@enduml")).toEqual({
      type: "plantuml",
      source: "@startuml\nAlice -> Bob\n@enduml"
    });
  });

  it("detects Mermaid when a code block wrapper includes the language label in text", () => {
    expect(detectDiagram("mermaid\nflowchart LR\nA --> B")).toEqual({
      type: "mermaid",
      source: "flowchart LR\nA --> B"
    });
  });

  it("skips code block chrome before PlantUML source", () => {
    expect(detectDiagram("Code snippet\nCopy\n@startuml\nAlice -> Bob\n@enduml")).toEqual({
      type: "plantuml",
      source: "@startuml\nAlice -> Bob\n@enduml"
    });
  });

  it("skips code block chrome before Mermaid source", () => {
    expect(detectDiagram("Code snippet\nCopy\nflowchart LR\nA --> B")).toEqual({
      type: "mermaid",
      source: "flowchart LR\nA --> B"
    });
  });

  it("detects fenced PlantUML blocks", () => {
    expect(detectDiagram("```plantuml\n@startuml\nAlice -> Bob\n@enduml\n```")).toEqual({
      type: "plantuml",
      source: "@startuml\nAlice -> Bob\n@enduml"
    });
  });

  it("ignores regular code blocks", () => {
    expect(detectDiagram("console.log('hello');", ["typescript"])).toBeNull();
  });
});
