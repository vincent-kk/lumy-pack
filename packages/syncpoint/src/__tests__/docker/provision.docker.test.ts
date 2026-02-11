import { describe, it, expect } from "vitest";
import { isDockerAvailable } from "../helpers/docker-runner.js";
import { execSync } from "node:child_process";

const DOCKER_AVAILABLE = isDockerAvailable();

describe.skipIf(!DOCKER_AVAILABLE)("Docker Provision Tests", () => {
  it("should have Docker available", () => {
    expect(DOCKER_AVAILABLE).toBe(true);
  });

  it("should be able to run simple Docker command", () => {
    const output = execSync("docker run --rm alpine:latest echo 'hello'", {
      encoding: "utf-8",
      timeout: 30000,
    });
    expect(output.trim()).toBe("hello");
  });

  it("should warn about missing test Dockerfile", () => {
    // This is a placeholder test - full Docker integration tests require
    // the Dockerfile.test to be present and the image to be built
    console.warn(
      "Full Docker provision tests require docker/Dockerfile.test and built image",
    );
    console.warn("Run: docker build -t syncpoint-test -f docker/Dockerfile.test .");
    expect(true).toBe(true);
  });
});

describe.skipIf(DOCKER_AVAILABLE)("Docker Unavailable Tests", () => {
  it("should skip Docker tests when Docker is not available", () => {
    expect(DOCKER_AVAILABLE).toBe(false);
    console.log("Docker not available - skipping Docker tests");
  });
});
