import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { processFile } from "@/utils/notation/processFile";

const SCORE_PATH = "musicxml/刻在我心底的名字.musicxml";

describe("刻在我心底的名字.musicxml import", () => {
  it("parses 80 measures with beams, ornaments and fermata", async () => {
    const buf = readFileSync(SCORE_PATH);
    const file = new File([buf], "刻在我心底的名字.musicxml", { type: "application/xml" });
    const result = await processFile(file);
    expect(result.parsedScore.measures).toHaveLength(80);
    const xml = buf.toString("utf-8");
    // OSMD 不自动连杠，显式 beam 必须存在（含次级杠）
    expect(xml).toContain('<beam number="2">begin</beam>');
    // m36/m63 的波音（mordent）与 m80 的延长记号（fermata）
    expect(xml).toContain("<mordent/>");
    expect(xml).toContain("<fermata");
    // 三连音 time-modification（m10/m18/m45/m60/m66）
    expect(xml).toContain("<actual-notes>3</actual-notes>");
  });
});
