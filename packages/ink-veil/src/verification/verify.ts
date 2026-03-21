import { forEach } from "@winglet/common-utils";

import { isDeepStrictEqual } from "node:util";
import type { FidelityTier } from "../types.js";
import { err, ok } from "../errors/result.js";
import type { Result } from "../errors/result.js";
import { VerificationError } from "../errors/types.js";
import { sha256 } from "./hash.js";
import type { VerificationResult } from "./types.js";

export async function verify(
  original: Buffer,
  restored: Buffer,
  tier: FidelityTier,
  format?: string,
): Promise<Result<VerificationResult>> {
  switch (tier) {
    case "1a": {
      const hashOriginal = sha256(original);
      const hashRestored = sha256(restored);
      const passed = hashOriginal === hashRestored;
      return ok({
        passed,
        method: "sha256",
        tier,
        detail: passed ? "Byte-identical" : "Hash mismatch",
        hashOriginal,
        hashRestored,
      });
    }

    case "1b": {
      if (!format) {
        return err(
          new VerificationError(
            "Tier 1b verification requires format parameter",
            { tier },
          ),
        );
      }
      try {
        const { getParser } = await import("../document/parser.js");
        const parserResult = await getParser(format);
        if (!parserResult.ok) {
          return err(
            new VerificationError(`Tier 1b: unsupported format "${format}"`, {
              tier,
              format,
            }),
          );
        }
        const parser = parserResult.value;
        const parsedOriginal = await parser.parse(original);
        const parsedRestored = await parser.parse(restored);

        const contentOriginal = parsedOriginal.metadata["parsed"];
        const contentRestored = parsedRestored.metadata["parsed"];
        const passed = isDeepStrictEqual(contentOriginal, contentRestored);
        return ok({
          passed,
          method: "semantic",
          tier,
          detail: passed
            ? "Parsed content is semantically equal"
            : "Parsed content differs",
        });
      } catch (e) {
        return err(
          new VerificationError(
            `Tier 1b verification failed: ${e instanceof Error ? e.message : String(e)}`,
            { tier, format },
          ),
        );
      }
    }

    case "2": {
      if (!format) {
        return err(
          new VerificationError(
            "Tier 2 verification requires format parameter",
            { tier },
          ),
        );
      }
      try {
        const { getParser } = await import("../document/parser.js");
        const parserResult = await getParser(format);
        if (!parserResult.ok) {
          return err(
            new VerificationError(`Tier 2: unsupported format "${format}"`, {
              tier,
              format,
            }),
          );
        }
        const parser = parserResult.value;
        const parsedOriginal = await parser.parse(original);
        const parsedRestored = await parser.parse(restored);

        // Structural verification: compare text node arrays (skippable excluded)
        const textNodesOriginal: string[] = [];
        forEach(parsedOriginal.segments, (s) => {
          if (!s.skippable) textNodesOriginal.push(s.text);
        });
        const textNodesRestored: string[] = [];
        forEach(parsedRestored.segments, (s) => {
          if (!s.skippable) textNodesRestored.push(s.text);
        });

        const passed = isDeepStrictEqual(textNodesOriginal, textNodesRestored);
        return ok({
          passed,
          method: "structural",
          tier,
          detail: passed
            ? "Text node arrays are equal"
            : "Text node arrays differ",
        });
      } catch (e) {
        return err(
          new VerificationError(
            `Tier 2 verification failed: ${e instanceof Error ? e.message : String(e)}`,
            { tier, format },
          ),
        );
      }
    }

    case "3": {
      if (!format) {
        return err(
          new VerificationError(
            "Tier 3 verification requires format parameter",
            { tier },
          ),
        );
      }
      try {
        const { getParser } = await import("../document/parser.js");
        const parserResult = await getParser(format);
        if (!parserResult.ok) {
          return err(
            new VerificationError(`Tier 3: unsupported format "${format}"`, {
              tier,
              format,
            }),
          );
        }
        const parser = parserResult.value;
        const parsedOriginal = await parser.parse(original);
        const parsedRestored = await parser.parse(restored);

        // Text-layer verification: compare extracted text strings
        const textOriginalParts: string[] = [];
        forEach(parsedOriginal.segments, (s) => {
          if (!s.skippable) textOriginalParts.push(s.text);
        });
        const textOriginal = textOriginalParts.join("");
        const textRestoredParts: string[] = [];
        forEach(parsedRestored.segments, (s) => {
          if (!s.skippable) textRestoredParts.push(s.text);
        });
        const textRestored = textRestoredParts.join("");

        const passed = textOriginal === textRestored;
        return ok({
          passed,
          method: "text-layer",
          tier,
          detail: passed ? "Extracted text is equal" : "Extracted text differs",
        });
      } catch (e) {
        return err(
          new VerificationError(
            `Tier 3 verification failed: ${e instanceof Error ? e.message : String(e)}`,
            { tier, format },
          ),
        );
      }
    }

    case "4":
      return ok({
        passed: null,
        method: "none",
        tier,
        detail: "No verification for Tier 4",
      });
  }
}
