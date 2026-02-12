import { describe, it, expect } from "vitest";
import { validateConfig } from "../../schemas/config.schema.js";

describe("validateConfig", () => {
  it("validates a complete valid config", () => {
    const config = {
      backup: {
        targets: ["/home/user/documents"],
        exclude: ["node_modules", ".git"],
        filename: "backup-{hostname}-{date}.tar.gz",
      },
    };
    const result = validateConfig(config);
    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it("validates config with optional destination", () => {
    const config = {
      backup: {
        targets: ["/home/user/documents"],
        exclude: ["node_modules"],
        filename: "backup.tar.gz",
        destination: "/backups",
      },
    };
    const result = validateConfig(config);
    expect(result.valid).toBe(true);
  });

  it("validates config with scripts.includeInBackup", () => {
    const config = {
      backup: {
        targets: ["/home/user"],
        exclude: [],
        filename: "backup.tar.gz",
      },
      scripts: {
        includeInBackup: true,
      },
    };
    const result = validateConfig(config);
    expect(result.valid).toBe(true);
  });

  it("fails when backup is missing", () => {
    const config = {};
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.some((e) => e.includes("backup"))).toBe(true);
  });

  it("fails when targets is missing", () => {
    const config = {
      backup: {
        exclude: ["node_modules"],
        filename: "backup.tar.gz",
      },
    };
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => e.includes("targets"))).toBe(true);
  });

  it("fails when exclude is missing", () => {
    const config = {
      backup: {
        targets: ["/home/user"],
        filename: "backup.tar.gz",
      },
    };
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => e.includes("exclude"))).toBe(true);
  });

  it("fails when filename is missing", () => {
    const config = {
      backup: {
        targets: ["/home/user"],
        exclude: [],
      },
    };
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => e.includes("filename"))).toBe(true);
  });

  it("fails when filename is empty string", () => {
    const config = {
      backup: {
        targets: ["/home/user"],
        exclude: [],
        filename: "",
      },
    };
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => e.includes("filename"))).toBe(true);
  });

  it("fails when targets is not an array", () => {
    const config = {
      backup: {
        targets: "/home/user",
        exclude: [],
        filename: "backup.tar.gz",
      },
    };
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
  });

  it("fails when exclude is not an array", () => {
    const config = {
      backup: {
        targets: ["/home/user"],
        exclude: "node_modules",
        filename: "backup.tar.gz",
      },
    };
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
  });

  it("fails when filename is not a string", () => {
    const config = {
      backup: {
        targets: ["/home/user"],
        exclude: [],
        filename: 123,
      },
    };
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
  });

  it("fails with additional properties in backup", () => {
    const config = {
      backup: {
        targets: ["/home/user"],
        exclude: [],
        filename: "backup.tar.gz",
        invalidProp: "value",
      },
    };
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    // Check that errors exist and contain appropriate message
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  it("fails with additional properties in root", () => {
    const config = {
      backup: {
        targets: ["/home/user"],
        exclude: [],
        filename: "backup.tar.gz",
      },
      invalidProp: "value",
    };
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
  });

  it("fails with additional properties in scripts", () => {
    const config = {
      backup: {
        targets: ["/home/user"],
        exclude: [],
        filename: "backup.tar.gz",
      },
      scripts: {
        includeInBackup: true,
        invalidProp: "value",
      },
    };
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
  });

  it("accepts empty arrays for targets and exclude", () => {
    const config = {
      backup: {
        targets: [],
        exclude: [],
        filename: "backup.tar.gz",
      },
    };
    const result = validateConfig(config);
    expect(result.valid).toBe(true);
  });

  describe("pattern validation", () => {
    describe("valid patterns", () => {
      it("accepts valid regex patterns in targets", () => {
        const config = {
          backup: {
            targets: ["/\\.zshrc$/", "/\\.conf$/"],
            exclude: [],
            filename: "backup.tar.gz",
          },
        };
        const result = validateConfig(config);
        expect(result.valid).toBe(true);
      });

      it("accepts valid regex patterns in exclude", () => {
        const config = {
          backup: {
            targets: ["~/.config"],
            exclude: ["/\\.bak$/", "/\\.tmp$/"],
            filename: "backup.tar.gz",
          },
        };
        const result = validateConfig(config);
        expect(result.valid).toBe(true);
      });

      it("accepts valid glob patterns in targets", () => {
        const config = {
          backup: {
            targets: ["*.conf", "~/.config/*.yml", "**/*.toml"],
            exclude: [],
            filename: "backup.tar.gz",
          },
        };
        const result = validateConfig(config);
        expect(result.valid).toBe(true);
      });

      it("accepts valid glob patterns in exclude", () => {
        const config = {
          backup: {
            targets: ["~/.config"],
            exclude: ["**/*.swp", "**/.DS_Store", "**/node_modules/**"],
            filename: "backup.tar.gz",
          },
        };
        const result = validateConfig(config);
        expect(result.valid).toBe(true);
      });

      it("accepts literal paths in targets", () => {
        const config = {
          backup: {
            targets: ["~/.zshrc", "/usr/local/bin", "~/.config/starship.toml"],
            exclude: [],
            filename: "backup.tar.gz",
          },
        };
        const result = validateConfig(config);
        expect(result.valid).toBe(true);
      });

      it("accepts mixed pattern types", () => {
        const config = {
          backup: {
            targets: [
              "~/.zshrc",        // literal
              "~/.config/*.yml", // glob
              "/\\.conf$/",      // regex
            ],
            exclude: [
              "**/*.swp",        // glob
              "/\\.bak$/",       // regex
            ],
            filename: "backup.tar.gz",
          },
        };
        const result = validateConfig(config);
        expect(result.valid).toBe(true);
      });
    });

    describe("invalid patterns", () => {
      it("rejects invalid regex patterns in targets", () => {
        const config = {
          backup: {
            targets: ["/[invalid/"],
            exclude: [],
            filename: "backup.tar.gz",
          },
        };
        const result = validateConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toBeDefined();
      });

      it("rejects invalid regex patterns in exclude", () => {
        const config = {
          backup: {
            targets: ["~/.config"],
            exclude: ["/(unclosed/"],
            filename: "backup.tar.gz",
          },
        };
        const result = validateConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toBeDefined();
      });

      it("rejects malformed regex patterns", () => {
        const config = {
          backup: {
            targets: ["/[a-z/"],
            exclude: [],
            filename: "backup.tar.gz",
          },
        };
        const result = validateConfig(config);
        expect(result.valid).toBe(false);
      });

      it("rejects multiple invalid patterns", () => {
        const config = {
          backup: {
            targets: ["/[invalid1/", "~/.zshrc", "/[invalid2/"],
            exclude: [],
            filename: "backup.tar.gz",
          },
        };
        const result = validateConfig(config);
        expect(result.valid).toBe(false);
      });
    });
  });
});
