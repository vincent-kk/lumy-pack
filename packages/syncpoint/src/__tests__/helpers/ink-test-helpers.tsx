import { render } from "ink-testing-library";

export async function waitForText(
  instance: ReturnType<typeof render>,
  text: string,
  timeout = 3000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (instance.lastFrame()?.includes(text)) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`Timed out waiting for "${text}" in:\n${instance.lastFrame()}`);
}

export async function waitForFrame(
  instance: ReturnType<typeof render>,
  predicate: (frame: string) => boolean,
  timeout = 3000,
): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const frame = instance.lastFrame();
    if (frame && predicate(frame)) return frame;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`Timed out waiting for predicate in:\n${instance.lastFrame()}`);
}
