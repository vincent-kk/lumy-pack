import { execSync } from "node:child_process";

const IMAGE_NAME = "syncpoint-test";

export function isDockerAvailable(): boolean {
  try {
    execSync("docker info", { stdio: "ignore", timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export function buildTestImage(dockerfilePath: string, contextPath: string): void {
  execSync(`docker build -t ${IMAGE_NAME} -f ${dockerfilePath} ${contextPath}`, {
    stdio: "inherit",
    timeout: 300000,
  });
}

export function runInDocker(command: string, timeout = 60000): string {
  const containerName = `syncpoint-test-${Date.now()}`;
  try {
    return execSync(
      `docker run --rm --name ${containerName} ${IMAGE_NAME} sh -c "${command}"`,
      { encoding: "utf-8", timeout },
    );
  } catch (err: unknown) {
    // Try cleanup in case container wasn't removed
    try {
      execSync(`docker rm -f ${containerName}`, { stdio: "ignore" });
    } catch {
      // ignore
    }
    throw err;
  }
}

export class DockerTestRunner {
  private containerName: string;

  constructor(private imageName: string = IMAGE_NAME) {
    this.containerName = `syncpoint-test-${Date.now()}`;
  }

  async start(): Promise<void> {
    execSync(
      `docker run -d --name ${this.containerName} ${this.imageName} sleep infinity`,
      { stdio: "ignore" },
    );
  }

  exec(command: string): string {
    return execSync(
      `docker exec ${this.containerName} sh -c "${command}"`,
      { encoding: "utf-8", timeout: 60000 },
    );
  }

  async cleanup(): Promise<void> {
    try {
      execSync(`docker rm -f ${this.containerName}`, { stdio: "ignore" });
    } catch {
      // ignore
    }
  }
}
