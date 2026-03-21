import { describe, it, expect, vi } from "vitest";
import { Dictionary } from "../../dictionary/dictionary.js";
import { mergeDictionaries } from "../../dictionary/merge.js";

function makeDict(
  entries: Array<{
    text: string;
    category: string;
    method?: "NER" | "REGEX" | "MANUAL";
  }>,
) {
  const dict = Dictionary.create();
  for (const e of entries) {
    dict.addEntity(e.text, e.category, e.method ?? "MANUAL", 1.0);
  }
  return dict;
}

describe("mergeDictionaries — no conflict", () => {
  it("adds all entries from theirs when no composite key conflict", async () => {
    const mine = makeDict([{ text: "홍길동", category: "PER" }]);
    const theirs = makeDict([{ text: "삼성전자", category: "ORG" }]);

    const result = await mergeDictionaries(mine, theirs, {
      strategy: "keep-mine",
    });

    expect(result.dictionary.size).toBe(2);
    expect(result.added).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.conflicts).toHaveLength(0);
  });

  it("does not mutate mine dictionary", async () => {
    const mine = makeDict([{ text: "홍길동", category: "PER" }]);
    const theirs = makeDict([{ text: "삼성전자", category: "ORG" }]);

    await mergeDictionaries(mine, theirs, { strategy: "keep-mine" });

    expect(mine.size).toBe(1);
  });
});

describe("mergeDictionaries — keep-mine strategy", () => {
  it("keeps mine on composite key conflict", async () => {
    const mine = makeDict([
      { text: "홍길동", category: "PER", method: "MANUAL" },
    ]);
    const theirs = makeDict([
      { text: "홍길동", category: "PER", method: "NER" },
    ]);

    const result = await mergeDictionaries(mine, theirs, {
      strategy: "keep-mine",
    });

    expect(result.dictionary.size).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.added).toBe(0);
    expect(result.conflicts).toHaveLength(1);

    const entry = result.dictionary.lookup("홍길동", "PER");
    expect(entry?.method).toBe("MANUAL"); // mine wins
  });
});

describe("mergeDictionaries — keep-theirs strategy", () => {
  it("replaces mine with theirs on conflict", async () => {
    const mine = makeDict([
      { text: "홍길동", category: "PER", method: "MANUAL" },
    ]);
    const theirs = makeDict([
      { text: "홍길동", category: "PER", method: "NER" },
    ]);

    const result = await mergeDictionaries(mine, theirs, {
      strategy: "keep-theirs",
    });

    expect(result.dictionary.size).toBe(1);
    expect(result.added).toBe(1);
    expect(result.conflicts).toHaveLength(1);

    const entry = result.dictionary.lookup("홍길동", "PER");
    expect(entry?.method).toBe("NER"); // theirs wins
  });
});

describe("mergeDictionaries — prompt strategy", () => {
  it("calls resolver for each conflict", async () => {
    const mine = makeDict([
      { text: "홍길동", category: "PER", method: "MANUAL" },
    ]);
    const theirs = makeDict([
      { text: "홍길동", category: "PER", method: "NER" },
    ]);

    const resolver = vi.fn().mockReturnValue("mine");
    const result = await mergeDictionaries(mine, theirs, {
      strategy: "prompt",
      resolver,
    });

    expect(resolver).toHaveBeenCalledTimes(1);
    expect(result.skipped).toBe(1);
  });

  it("resolver returning theirs replaces entry", async () => {
    const mine = makeDict([
      { text: "홍길동", category: "PER", method: "MANUAL" },
    ]);
    const theirs = makeDict([
      { text: "홍길동", category: "PER", method: "NER" },
    ]);

    const resolver = vi.fn().mockResolvedValue("theirs");
    const result = await mergeDictionaries(mine, theirs, {
      strategy: "prompt",
      resolver,
    });

    expect(result.added).toBe(1);
    const entry = result.dictionary.lookup("홍길동", "PER");
    expect(entry?.method).toBe("NER");
  });

  it("throws when resolver is not provided", async () => {
    const mine = makeDict([{ text: "홍길동", category: "PER" }]);
    const theirs = makeDict([{ text: "홍길동", category: "PER" }]);

    await expect(
      mergeDictionaries(mine, theirs, { strategy: "prompt" }),
    ).rejects.toThrow("MergeStrategy 'prompt' requires a resolver callback.");
  });
});

describe("mergeDictionaries — rename strategy", () => {
  it("adds all entries, renaming on token ID collision", async () => {
    const mine = makeDict([{ text: "홍길동", category: "PER" }]); // PER_001
    const theirs = makeDict([{ text: "김철수", category: "PER" }]); // also PER_001 in their dict

    const result = await mergeDictionaries(mine, theirs, {
      strategy: "rename",
    });

    // Both entries exist — no ID collision on different text
    expect(result.dictionary.size).toBe(2);
    expect(result.conflicts).toHaveLength(0);

    // IDs must not overlap
    const ids = [...result.dictionary.entries()].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length); // all unique
  });

  it("skips duplicate same composite key", async () => {
    const mine = makeDict([{ text: "홍길동", category: "PER" }]);
    const theirs = makeDict([{ text: "홍길동", category: "PER" }]); // same key

    const result = await mergeDictionaries(mine, theirs, {
      strategy: "rename",
    });

    expect(result.dictionary.size).toBe(1);
    expect(result.skipped).toBe(1);
  });
});
