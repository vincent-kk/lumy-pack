/**
 * NER Worker Thread
 *
 * Runs in a separate Worker Thread to keep model inference non-blocking.
 * Communicates with the main thread via IPC (parentPort.postMessage).
 *
 * IPC Protocol:
 *   Main → Worker:  { type: 'detect', id: string, text: string, labels: string[], threshold: number }
 *   Main → Worker:  { type: 'shutdown' }
 *   Worker → Main:  { type: 'ready' }
 *   Worker → Main:  { type: 'result', id: string, spans: NERSpan[] }
 *   Worker → Main:  { type: 'error', id: string, message: string }
 */
import { workerData, parentPort } from 'node:worker_threads';

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

// workerData carries { modelDir: string, modelId: string }
const { modelDir, modelId } = workerData as { modelDir: string; modelId: string };

let pipeline: unknown = null;

async function loadModel(): Promise<void> {
  // Dynamic import of @xenova/transformers to avoid loading in main thread.
  const transformers = await import('@xenova/transformers');
  const { pipeline: createPipeline, env } = transformers;

  // Set local model path to models base directory so @xenova/transformers
  // resolves files as {localModelPath}/{modelId}/{filename}
  const { dirname } = await import('node:path');
  env.localModelPath = dirname(modelDir);
  env.allowRemoteModels = false;

  pipeline = await (createPipeline as Function)('token-classification', modelId, {
    quantized: false,
    model_file_name: 'model_int8',
    local_files_only: true,
  });
}

async function runInference(
  text: string,
  labels: string[],
  threshold: number,
): Promise<NERSpan[]> {
  if (!pipeline) throw new Error('Model not loaded');

  // @xenova/transformers token-classification pipeline output format:
  // Array of { entity: string, score: number, index: number, word: string, start: number, end: number }
  const raw = await (pipeline as Function)(text, { labels, threshold });
  const results: NERSpan[] = [];

  if (!Array.isArray(raw)) return results;

  for (const item of raw) {
    if (item.score < threshold) continue;
    results.push({
      start: item.start ?? 0,
      end: item.end ?? 0,
      text: item.word ?? '',
      label: (item.entity ?? '').replace(/^[BI]-/, '').toUpperCase(),
      score: item.score,
    });
  }

  return results;
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
