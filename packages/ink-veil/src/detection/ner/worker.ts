/**
 * NER Worker Thread
 *
 * Runs in a separate Worker Thread to keep model inference non-blocking.
 * Uses onnxruntime-node for direct GLiNER ONNX inference with
 * @xenova/transformers AutoTokenizer and a Unicode-aware word splitter
 * for Korean/CJK support. Sigmoid activation is applied to raw logits.
 *
 * IPC Protocol:
 *   Main → Worker:  { type: 'detect', id: string, text: string, labels: string[], threshold: number }
 *   Main → Worker:  { type: 'shutdown' }
 *   Worker → Main:  { type: 'ready' }
 *   Worker → Main:  { type: 'result', id: string, spans: NERSpan[] }
 *   Worker → Main:  { type: 'error', id: string, message: string }
 */
import { workerData, parentPort } from 'node:worker_threads';
import { join, dirname } from 'node:path';

export interface NERSpan {
  start: number;
  end: number;
  text: string;
  label: string;
  score: number;
}

interface DetectMessage {
  type: 'detect';
  id: string;
  text: string;
  labels: string[];
  threshold: number;
}

interface ShutdownMessage {
  type: 'shutdown';
}

type InboundMessage = DetectMessage | ShutdownMessage;

const { modelDir, modelId } = workerData as { modelDir: string; modelId: string };

// Unicode-aware word splitter for Korean/CJK text.
// The default WhitespaceTokenSplitter uses \w+ which only matches ASCII word chars,
// treating each Korean character as a separate \S token. This breaks word-level NER.
class UnicodeWordSplitter {
  *call(text: string): Generator<[string, number, number]> {
    const pattern = /[\p{L}\p{N}]+(?:[-_][\p{L}\p{N}]+)*|\S/gu;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      yield [match[0], match.index, pattern.lastIndex];
    }
  }
}

interface GlinerModel {
  initialize(): Promise<void>;
  inference(
    texts: string[],
    entities: string[],
    flatNer: boolean,
    threshold: number,
    multiLabel: boolean,
  ): Promise<[string, number, number, string, number][][]>;
}

let model: GlinerModel | null = null;

async function loadModel(): Promise<void> {
  // Set localModelPath so @xenova/transformers resolves tokenizer from local directory
  const { env, AutoTokenizer } = await import('@xenova/transformers');
  env.localModelPath = dirname(modelDir);
  env.allowLocalModels = true;

  const tokenizer = await AutoTokenizer.from_pretrained(modelId);

  const { default: ort } = await import('onnxruntime-node');

  const modelPath = join(modelDir, 'onnx', 'model.onnx');
  const session = await ort.InferenceSession.create(modelPath);

  const wordSplitter = new UnicodeWordSplitter();
  const maxWidth = 12;

  model = buildSpanModel(tokenizer, wordSplitter, session, ort, maxWidth);
}

function buildSpanModel(
  tokenizer: { encode: (text: string) => number[]; sep_token_id: number },
  wordSplitter: UnicodeWordSplitter,
  session: import('onnxruntime-node').InferenceSession,
  ort: typeof import('onnxruntime-node'),
  maxWidth: number,
): GlinerModel {
  function tokenizeText(text: string): [string[], number[], number[]] {
    const tokens: string[] = [];
    const startsIdx: number[] = [];
    const endsIdx: number[] = [];
    for (const [token, start, end] of wordSplitter.call(text)) {
      tokens.push(token);
      startsIdx.push(start);
      endsIdx.push(end);
    }
    return [tokens, startsIdx, endsIdx];
  }

  function prepareTextInputs(tokens: string[][], entities: string[]): [string[][], number[], number[]] {
    const inputTexts: string[][] = [];
    const promptLengths: number[] = [];
    const textLengths: number[] = [];

    for (const text of tokens) {
      textLengths.push(text.length);
      let inputText: string[] = [];
      for (const ent of entities) {
        inputText.push('<<ENT>>');
        inputText.push(ent);
      }
      inputText.push('<<SEP>>');
      promptLengths.push(inputText.length);
      inputText = inputText.concat(text);
      inputTexts.push(inputText);
    }
    return [inputTexts, textLengths, promptLengths];
  }

  function encodeInputs(
    texts: string[][],
    promptLengths: number[],
  ): [number[][], number[][], number[][]] {
    const wordsMasks: number[][] = [];
    const inputsIds: number[][] = [];
    const attentionMasks: number[][] = [];

    for (let id = 0; id < texts.length; id++) {
      const promptLength = promptLengths[id]!;
      const tokenizedInputs = texts[id]!;
      const wordsMask: number[] = [0];
      const inputIds: number[] = [1]; // CLS token
      const attentionMask: number[] = [1];

      let c = 1;
      tokenizedInputs.forEach((word, wordId) => {
        const wordTokens = tokenizer.encode(word).slice(1, -1);
        wordTokens.forEach((_token: number, tokenId: number) => {
          attentionMask.push(1);
          if (wordId < promptLength) {
            wordsMask.push(0);
          } else if (tokenId === 0) {
            wordsMask.push(c);
            c++;
          } else {
            wordsMask.push(0);
          }
          inputIds.push(_token);
        });
      });
      wordsMask.push(0);
      inputIds.push(tokenizer.sep_token_id);
      attentionMask.push(1);

      wordsMasks.push(wordsMask);
      inputsIds.push(inputIds);
      attentionMasks.push(attentionMask);
    }
    return [inputsIds, attentionMasks, wordsMasks];
  }

  function padArray(arr: number[][], dims: number = 2): number[][] {
    const maxLen = Math.max(...arr.map((a) => a.length));
    return arr.map((a) => {
      if (dims === 2) return [...a, ...Array(maxLen - a.length).fill(0)];
      return a;
    });
  }

  function padArray3D(arr: number[][][]): number[][][] {
    const maxLen = Math.max(...arr.map((a) => a.length));
    const innerLen = arr[0]![0]!.length;
    return arr.map((a) => [...a, ...Array(maxLen - a.length).fill(null).map(() => Array(innerLen).fill(0) as number[])]);
  }

  function padBoolArray(arr: boolean[][]): boolean[][] {
    const maxLen = Math.max(...arr.map((a) => a.length));
    return arr.map((a) => [...a, ...Array(maxLen - a.length).fill(false)]);
  }

  function prepareSpans(batchTokens: string[][]): { spanIdxs: number[][][]; spanMasks: boolean[][] } {
    const spanIdxs: number[][][] = [];
    const spanMasks: boolean[][] = [];

    for (const tokens of batchTokens) {
      const textLength = tokens.length;
      const spanIdx: number[][] = [];
      const spanMask: boolean[] = [];

      for (let i = 0; i < textLength; i++) {
        for (let j = 0; j < maxWidth; j++) {
          const endIdx = Math.min(i + j, textLength - 1);
          spanIdx.push([i, endIdx]);
          spanMask.push(endIdx < textLength);
        }
      }
      spanIdxs.push(spanIdx);
      spanMasks.push(spanMask);
    }
    return { spanIdxs, spanMasks };
  }

  function decodeSpans(
    batchSize: number,
    inputLength: number,
    numEntities: number,
    texts: string[],
    batchWordsStartIdx: number[][],
    batchWordsEndIdx: number[][],
    idToClass: Record<number, string>,
    modelOutput: Float32Array | BigInt64Array | Int32Array | Uint8Array,
    flatNer: boolean,
    threshold: number,
  ): [string, number, number, string, number][][] {
    const results: [string, number, number, string, number][][] = [];

    for (let b = 0; b < batchSize; b++) {
      const spans: [string, number, number, string, number][] = [];
      const wordsStartIdx = batchWordsStartIdx[b]!;
      const wordsEndIdx = batchWordsEndIdx[b]!;
      const text = texts[b]!;

      for (let i = 0; i < inputLength; i++) {
        for (let j = 0; j < maxWidth; j++) {
          for (let k = 0; k < numEntities; k++) {
            const idx = b * (inputLength * maxWidth * numEntities) +
              i * (maxWidth * numEntities) +
              j * numEntities +
              k;
            const raw = Number(modelOutput[idx]);
            const score = 1 / (1 + Math.exp(-raw));

            if (score > threshold) {
              const endIdx = Math.min(i + j, inputLength - 1);
              if (i < wordsStartIdx.length && endIdx < wordsEndIdx.length) {
                const start = wordsStartIdx[i]!;
                const end = wordsEndIdx[endIdx]!;
                const spanText = text.substring(start, end);
                const label = idToClass[k + 1] ?? 'UNKNOWN';
                spans.push([spanText, start, end, label, score]);
              }
            }
          }
        }
      }

      // Sort by score descending, apply flat NER (no overlapping spans)
      spans.sort((a, b) => b[4] - a[4]);

      if (flatNer) {
        const selected: [string, number, number, string, number][] = [];
        const used = new Set<number>();
        for (const span of spans) {
          const [, start, end] = span;
          let overlap = false;
          for (let pos = start; pos < end; pos++) {
            if (used.has(pos)) { overlap = true; break; }
          }
          if (!overlap) {
            selected.push(span);
            for (let pos = start; pos < end; pos++) used.add(pos);
          }
        }
        results.push(selected);
      } else {
        results.push(spans);
      }
    }
    return results;
  }

  return {
    async initialize() {
      // Session already created
    },
    async inference(texts, entities, flatNer, threshold, _multiLabel) {
      const batchTokens: string[][] = [];
      const batchStartIdx: number[][] = [];
      const batchEndIdx: number[][] = [];
      for (const text of texts) {
        const [tokens, starts, ends] = tokenizeText(text);
        batchTokens.push(tokens);
        batchStartIdx.push(starts);
        batchEndIdx.push(ends);
      }

      const idToClass: Record<number, string> = {};
      entities.forEach((e, i) => { idToClass[i + 1] = e; });

      const [inputTokens, textLengths, promptLengths] = prepareTextInputs(batchTokens, entities);
      let [inputsIds, attentionMasks, wordsMasks] = encodeInputs(inputTokens, promptLengths);
      inputsIds = padArray(inputsIds);
      attentionMasks = padArray(attentionMasks);
      wordsMasks = padArray(wordsMasks);

      let { spanIdxs, spanMasks } = prepareSpans(batchTokens);
      const paddedSpanIdxs = padArray3D(spanIdxs);
      const paddedSpanMasks = padBoolArray(spanMasks);

      const batchSize = inputsIds.length;
      const numTokens = inputsIds[0]!.length;
      const numSpans = paddedSpanIdxs[0]!.length;

      const feeds: Record<string, import('onnxruntime-node').Tensor> = {
        input_ids: new ort.Tensor('int64', BigInt64Array.from(inputsIds.flat().map(BigInt)), [batchSize, numTokens]),
        attention_mask: new ort.Tensor('int64', BigInt64Array.from(attentionMasks.flat().map(BigInt)), [batchSize, numTokens]),
        words_mask: new ort.Tensor('int64', BigInt64Array.from(wordsMasks.flat().map(BigInt)), [batchSize, numTokens]),
        text_lengths: new ort.Tensor('int64', BigInt64Array.from(textLengths.map(BigInt)), [batchSize, 1]),
        span_idx: new ort.Tensor('int64', BigInt64Array.from(paddedSpanIdxs.flat(2).map(BigInt)), [batchSize, numSpans, 2]),
        span_mask: new ort.Tensor('bool', paddedSpanMasks.flat(), [batchSize, numSpans]),
      };

      const results = await session.run(feeds);
      const logits = results['logits']!;
      const output = logits.data as Float32Array;

      const inputLength = Math.max(...textLengths);
      return decodeSpans(
        batchSize, inputLength, entities.length,
        texts, batchStartIdx, batchEndIdx,
        idToClass, output, flatNer, threshold,
      );
    },
  };
}

async function runInference(
  text: string,
  labels: string[],
  threshold: number,
): Promise<NERSpan[]> {
  if (!model) throw new Error('Model not loaded');

  const results = await model.inference([text], labels, true, threshold, false);
  const entities = results[0] ?? [];

  return entities.map(([spanText, start, end, label, score]) => ({
    start,
    end,
    text: spanText,
    label: label.toUpperCase(),
    score,
  }));
}

async function main(): Promise<void> {
  if (!parentPort) throw new Error('Must run as Worker Thread');

  try {
    await loadModel();
    parentPort.postMessage({ type: 'ready' });
  } catch (err) {
    parentPort.postMessage({ type: 'error', id: 'init', message: String(err) });
    process.exit(1);
  }

  parentPort.on('message', async (msg: InboundMessage) => {
    if (msg.type === 'shutdown') {
      process.exit(0);
    }

    if (msg.type === 'detect') {
      try {
        const spans = await runInference(msg.text, msg.labels, msg.threshold);
        parentPort!.postMessage({ type: 'result', id: msg.id, spans });
      } catch (err) {
        parentPort!.postMessage({ type: 'error', id: msg.id, message: String(err) });
      }
    }
  });
}

main().catch((err) => {
  process.stderr.write(`[NER Worker] Fatal: ${err}\n`);
  process.exit(1);
});
