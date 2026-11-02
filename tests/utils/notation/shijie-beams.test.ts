import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { processFile } from "@/utils/notation/processFile";

describe("世界赠予我的 (beam pass)", () => {
  it("imports with beams: 58 measures, note count matches corrected ledger", async () => {
    const buf = readFileSync("musicxml/世界赠予我的.musicxml");
    const file = new File([buf], "世界赠予我的.musicxml", { type: "application/xml" });
    const result = await processFile(file);
    const parsed = result.parsedScore;
    expect(parsed.measures).toHaveLength(58);
    const xml = buf.toString("utf-8");
    expect(xml).toContain("<beam");
    // m13 sixteenth group carries a secondary beam run
    expect(xml).toContain('<beam number="2">begin</beam>');
    // m20 dotted-8th+16th backward hook survives
    expect(xml).toContain("backward hook");
    // m32 forward hook survives
    expect(xml).toContain("forward hook");
  });
});
