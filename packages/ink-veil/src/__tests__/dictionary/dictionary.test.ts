import { describe, it, expect } from "vitest";
import { Dictionary } from "../../dictionary/dictionary.js";
import { compositeKey } from "../../dictionary/entry.js";

describe("Dictionary", () => {
  describe("addEntity", () => {
    it("forward lookup returns correct entry", () => {
      const dict = Dictionary.create();
      const entry = dict.addEntity("홍길동", "PER", "NER", 0.95);
      const found = dict.lookup("홍길동", "PER");
      expect(found).toBeDefined();
      expect(found?.id).toBe(entry.id);
      expect(found?.original).toBe("홍길동");
    });

    it("reverse lookup returns correct entry", () => {
      const dict = Dictionary.create();
      const entry = dict.addEntity("삼성전자", "ORG", "REGEX", 1.0);
      const found = dict.reverseLookup(entry.tokenPlain);
      expect(found).toBeDefined();
      expect(found?.original).toBe("삼성전자");
    });

    it("composite key separates homographs", () => {
      const dict = Dictionary.create();
      const asOrg = dict.addEntity("삼성", "ORG", "NER", 0.9);
      const asLoc = dict.addEntity("삼성", "LOC", "NER", 0.8);
      expect(asOrg.id).not.toBe(asLoc.id);
      expect(asOrg.tokenPlain).not.toBe(asLoc.tokenPlain);
    });

    it("addEntity is idempotent — same composite key returns same entry", () => {
      const dict = Dictionary.create();
      const first = dict.addEntity("홍길동", "PER", "NER", 0.95);
      const second = dict.addEntity("홍길동", "PER", "NER", 0.9);
      expect(first.id).toBe(second.id);
      expect(dict.size).toBe(1);
    });

    it("idempotent addEntity increments occurrenceCount", () => {
      const dict = Dictionary.create();
      dict.addEntity("홍길동", "PER", "NER", 0.95);
      const entry = dict.addEntity("홍길동", "PER", "NER", 0.9);
      expect(entry.occurrenceCount).toBe(2);
    });
  });

  describe("stats", () => {
    it("returns correct total and byCategory counts", () => {
      const dict = Dictionary.create();
      dict.addEntity("홍길동", "PER", "NER", 0.9);
      dict.addEntity("김철수", "PER", "NER", 0.9);
      dict.addEntity("삼성전자", "ORG", "REGEX", 1.0);
      const s = dict.stats();
      expect(s.total).toBe(3);
      expect(s.byCategory["PER"]).toBe(2);
      expect(s.byCategory["ORG"]).toBe(1);
    });
  });

  describe("toJSON / fromJSON round-trip", () => {
    it("preserves all entries", () => {
      const dict = Dictionary.create();
      dict.addEntity("홍길동", "PER", "NER", 0.95);
      dict.addEntity("삼성전자", "ORG", "REGEX", 1.0);
      const json = dict.toJSON();
      const restored = Dictionary.fromJSON(json);
      expect(restored.size).toBe(2);
      expect(restored.lookup("홍길동", "PER")).toBeDefined();
      expect(restored.lookup("삼성전자", "ORG")).toBeDefined();
    });

    it("preserves reverse index after fromJSON", () => {
      const dict = Dictionary.create();
      const entry = dict.addEntity("홍길동", "PER", "NER", 0.95);
      const json = dict.toJSON();
      const restored = Dictionary.fromJSON(json);
      expect(restored.reverseLookup(entry.tokenPlain)).toBeDefined();
    });

    it("counter initialized from max ID — no collision after fromJSON", () => {
      const dict = Dictionary.create();
      dict.addEntity("A", "PER", "MANUAL", 1.0);
      dict.addEntity("B", "PER", "MANUAL", 1.0);
      const json = dict.toJSON();
      const restored = Dictionary.fromJSON(json);
      // Adding new entry after restore should not collide
      const newEntry = restored.addEntity("C", "PER", "MANUAL", 1.0);
      expect(newEntry.id).toBe("PER_003");
    });
  });

  describe("snapshot / restore", () => {
    it("restores to exact prior state", () => {
      const dict = Dictionary.create();
      dict.addEntity("홍길동", "PER", "NER", 0.95);
      const snap = dict.snapshot();
      dict.addEntity("김철수", "PER", "NER", 0.85);
      expect(dict.size).toBe(2);
      dict.restore(snap);
      expect(dict.size).toBe(1);
      expect(dict.lookup("김철수", "PER")).toBeUndefined();
    });

    it("counter reset after restore — next ID matches expected", () => {
      const dict = Dictionary.create();
      dict.addEntity("홍길동", "PER", "NER", 0.95);
      const snap = dict.snapshot();
      dict.addEntity("김철수", "PER", "NER", 0.85);
      dict.restore(snap);
      // After restore, counter is 1. Next should be 002
      const next = dict.addEntity("이순신", "PER", "NER", 0.9);
      expect(next.id).toBe("PER_002");
    });
  });

  describe("large scale — 10K entries", () => {
    it("forward and reverse lookup remain O(1)-accurate for 10,000 entries", () => {
      const dict = Dictionary.create();
      for (let i = 0; i < 10000; i++) {
        dict.addEntity(`entity_${i}`, "PER", "MANUAL", 1.0);
      }
      expect(dict.size).toBe(10000);
      expect(dict.lookup("entity_9999", "PER")?.id).toBe("PER_10000");
      expect(dict.reverseLookup("PER_10000")?.original).toBe("entity_9999");
    });
  });

  describe("entries iterator", () => {
    it("iterates all entries", () => {
      const dict = Dictionary.create();
      dict.addEntity("홍길동", "PER", "NER", 0.95);
      dict.addEntity("삼성전자", "ORG", "REGEX", 1.0);
      const all = [...dict.entries()];
      expect(all).toHaveLength(2);
    });
  });

  describe("token format", () => {
    it("tag mode produces XML token", () => {
      const dict = Dictionary.create("tag");
      const entry = dict.addEntity("홍길동", "PER", "NER", 0.95);
      expect(entry.token).toMatch(/^<iv-per id="001">PER_001<\/iv-per>$/);
    });

    it("bracket mode produces {{token}}", () => {
      const dict = Dictionary.create("bracket");
      const entry = dict.addEntity("홍길동", "PER", "NER", 0.95);
      expect(entry.token).toBe("{{PER_001}}");
    });

    it("plain mode produces bare token", () => {
      const dict = Dictionary.create("plain");
      const entry = dict.addEntity("홍길동", "PER", "NER", 0.95);
      expect(entry.token).toBe("PER_001");
    });
  });

  describe("compositeKey", () => {
    it("builds key with :: separator", () => {
      expect(compositeKey("홍길동", "PER")).toBe("홍길동::PER");
    });
  });
});
