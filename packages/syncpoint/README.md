# Syncpoint

> Personal Environment Manager — Config backup/restore and machine provisioning CLI

[![npm version](https://img.shields.io/npm/v/@lumy-pack/syncpoint.svg)](https://www.npmjs.com/package/@lumy-pack/syncpoint)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Syncpoint is a powerful CLI tool for managing your development environment configurations. Backup your dotfiles, restore them on new machines, and provision your system with automated templates—all with built-in safety features and security checks.

## ✨ Features

- 🧙 **AI-Powered Wizards** — LLM-assisted config generation and template creation with Claude Code
- 📦 **Config Backup** — Create compressed archives of your dotfiles and configs with metadata tracking
- 🔄 **Smart Restore** — Hash-based file comparison with automatic safety backups before overwrite
- 🚀 **Machine Provisioning** — Template-based system setup with YAML-defined installation steps
- 🛡️ **Security First** — Sensitive file detection, symlink attack prevention, remote script blocking
- 📊 **Interactive Management** — Browse backups and templates with a beautiful terminal UI
- 🎯 **Flexible Patterns** — Glob/regex support, tilde expansion, and customizable filename placeholders

## 📦 Installation

**Recommended: Use with npx (no installation required)**

```bash
npx @lumy-pack/syncpoint <command>
```

Or install globally if you prefer:

```bash
# Using npm
npm install -g @lumy-pack/syncpoint

# Using pnpm
pnpm add -g @lumy-pack/syncpoint
```

## 🚀 Quick Start

1. **Initialize syncpoint**

   ```bash
   npx @lumy-pack/syncpoint init
   ```

   This creates `~/.syncpoint/` with default configuration and directory structure.

2. **Edit your configuration**

   Open `~/.syncpoint/config.yml` and customize your backup targets:

   ```yaml
   backup:
     targets:
       - ~/.zshrc
       - ~/.gitconfig
       - ~/.ssh/config
     exclude:
       - "**/*.swp"
     filename: "{hostname}_{datetime}"
   ```

3. **Create your first backup**

   ```bash
   npx @lumy-pack/syncpoint backup
   ```

4. **Restore on another machine**

   ```bash
   npx @lumy-pack/syncpoint restore
   ```

## 📖 Commands

### `syncpoint init`

Initialize the syncpoint directory structure and create default configuration.

**What it does:**
- Creates `~/.syncpoint/` directory structure
- Sets up subdirectories: `backups/`, `templates/`, `scripts/`, `logs/`
- Generates default `config.yml`
- Creates an example provisioning template

**Usage:**

```bash
npx @lumy-pack/syncpoint init
```

---

### `syncpoint wizard [options]`

Interactive LLM-powered wizard to generate personalized `config.yml` based on your home directory.

**What it does:**
1. Scans your home directory for common configuration files
2. Categorizes files (shell configs, git, SSH, application configs)
3. Invokes Claude Code to generate customized backup configuration
4. Validates generated config with automatic retry on errors (max 3 attempts)
5. Backs up existing config before overwrite (saved as `config.yml.bak`)
6. Writes validated configuration to `~/.syncpoint/config.yml`

**Options:**

| Option | Description |
|--------|-------------|
| `-p, --print` | Print prompt for manual LLM usage instead of invoking Claude Code |

**Usage:**

```bash
# Interactive wizard (requires Claude Code CLI)
npx @lumy-pack/syncpoint wizard

# Print prompt for manual use
npx @lumy-pack/syncpoint wizard --print
```

**Requirements:**
- Claude Code CLI must be installed for default mode
- Use `--print` mode if Claude Code is not available

**Validation:**
- Automatic AJV schema validation
- Retry loop with error feedback to LLM
- Session resume preserves conversation context

---

### `syncpoint create-template [name] [options]`

Interactive LLM-powered wizard to create custom provisioning templates.

**What it does:**
1. Guides you through defining provisioning requirements
2. Invokes Claude Code to generate template YAML
3. Validates template structure with automatic retry (max 3 attempts)
4. Writes template to `~/.syncpoint/templates/`
5. Prevents overwriting existing templates

**Options:**

| Option | Description |
|--------|-------------|
| `-p, --print` | Print prompt for manual LLM usage instead of invoking Claude Code |

**Usage:**

```bash
# Interactive template creation (requires Claude Code CLI)
npx @lumy-pack/syncpoint create-template

# Create with specific name
npx @lumy-pack/syncpoint create-template my-dev-setup

# Print prompt for manual use
npx @lumy-pack/syncpoint create-template --print
```

**Template Fields:**
- `name` (required) — Template name
- `description` (optional) — Template description
- `steps` (required) — Array of provisioning steps
- `backup` (optional) — Backup name to restore after provisioning
- `sudo` (optional) — Whether sudo privilege is required

**Step Fields:**
- `name` (required) — Step name
- `command` (required) — Shell command to execute
- `description` (optional) — Step description
- `skip_if` (optional) — Condition to skip step
- `continue_on_error` (optional) — Continue on failure (default: false)

---

### `syncpoint backup [options]`

Create a compressed backup archive of your configuration files.

**What it does:**
1. Scans configured target files and directories
2. Applies glob patterns and exclusions
3. Warns about large files (>10MB) and sensitive files (SSH keys, certificates)
4. Collects file hashes for comparison
5. Optionally includes scripts from `~/.syncpoint/scripts/`
6. Creates compressed tar.gz archive with metadata

**Options:**

| Option | Description |
|--------|-------------|
| `--dry-run` | Preview files to be backed up without creating archive |
| `--tag <name>` | Add custom tag to backup filename |

**Usage:**

```bash
# Create a backup
npx @lumy-pack/syncpoint backup

# Preview backup contents
npx @lumy-pack/syncpoint backup --dry-run

# Create a tagged backup
npx @lumy-pack/syncpoint backup --tag "before-upgrade"
```

**Output:**

Backups are saved to `~/.syncpoint/backups/` (or custom destination) with filename pattern from config. Example: `macbook-pro_2024-01-15_14-30-00.tar.gz`

---

### `syncpoint restore [filename] [options]`

Restore configuration files from a backup archive.

**What it does:**
1. Lists available backups (if no filename provided)
2. Generates restore plan by comparing file hashes:
   - `create` — File doesn't exist locally
   - `skip` — File is identical (same hash)
   - `overwrite` — File has been modified
3. Creates automatic safety backup of files to be overwritten (tagged `_pre-restore_`)
4. Extracts and restores files to original locations
5. Validates symlinks to prevent security attacks

**Options:**

| Option | Description |
|--------|-------------|
| `--dry-run` | Show restore plan without actually restoring |

**Usage:**

```bash
# Interactive: select from available backups
npx @lumy-pack/syncpoint restore

# Restore specific backup
npx @lumy-pack/syncpoint restore macbook-pro_2024-01-15.tar.gz

# Preview restore actions
npx @lumy-pack/syncpoint restore --dry-run
```

**Safety Features:**
- Automatic safety backup before any file is overwritten
- Hash-based comparison to skip identical files
- Symlink validation to prevent directory traversal attacks

---

### `syncpoint provision <template> [options]`

Run template-based machine provisioning to install software and configure your system.

**What it does:**
1. Loads template YAML from `~/.syncpoint/templates/`
2. Validates template structure and security
3. Checks for sudo requirement (prompts if needed)
4. Executes steps sequentially with real-time progress
5. Evaluates `skip_if` conditions before running steps
6. Captures command output and handles errors
7. Optionally restores config backup after provisioning

**Options:**

| Option | Description |
|--------|-------------|
| `--dry-run` | Show execution plan without running commands |
| `--skip-restore` | Skip automatic config restore after provisioning |

**Usage:**

```bash
# Run provisioning template
npx @lumy-pack/syncpoint provision my-setup

# Preview template execution
npx @lumy-pack/syncpoint provision my-setup --dry-run

# Provision without restoring configs
npx @lumy-pack/syncpoint provision my-setup --skip-restore
```

**Security:**
- Blocks dangerous remote script patterns (`curl | bash`, `wget | sh`)
- Sanitizes error output to mask sensitive paths and credentials
- Validates all templates against schema
- 5-minute timeout per step

---

### `syncpoint list [type]`

Browse and manage backups and templates interactively.

**What it does:**
- Displays interactive menu to browse backups or templates
- Shows detailed metadata (size, date, file count, description)
- Allows safe deletion of backups with confirmation
- Previews template steps and configuration

**Usage:**

```bash
# Interactive menu
npx @lumy-pack/syncpoint list

# Direct navigation
npx @lumy-pack/syncpoint list backups
npx @lumy-pack/syncpoint list templates
```

**Navigation:**
- Use arrow keys to select items
- Press Enter to view details
- Press ESC to go back
- Confirm before deletion

---

### `syncpoint status [options]`

Show status summary and manage cleanup of `~/.syncpoint/` directory.

**What it does:**
- Scans all subdirectories and calculates statistics
- Displays file counts and total sizes
- Shows backup timeline (newest and oldest)
- Optional cleanup mode with multiple strategies

**Options:**

| Option | Description |
|--------|-------------|
| `--cleanup` | Enter interactive cleanup mode |

**Usage:**

```bash
# Show status summary
npx @lumy-pack/syncpoint status

# Cleanup old backups
npx @lumy-pack/syncpoint status --cleanup
```

**Cleanup Strategies:**
- Keep only 5 most recent backups
- Remove backups older than 30 days
- Delete all log files
- Manual selection for precise control

---

## ⚙️ Configuration

Syncpoint uses `~/.syncpoint/config.yml` for configuration.

### Configuration Schema

```yaml
backup:
  # (Required) List of files/directories to backup
  # Supports three pattern types:
  #   - Literal paths: ~/.zshrc, /etc/hosts
  #   - Glob patterns: ~/.config/*.conf, **/*.toml
  #   - Regex patterns: /\.conf$/, /\.toml$/ (scans ~/ with depth limit 5)
  targets:
    - ~/.zshrc
    - ~/.zprofile
    - ~/.gitconfig
    - ~/.ssh/config
    - ~/.config/**/*.conf
    # Example regex: /\.toml$/ finds all .toml files in home directory

  # (Required) Patterns to exclude from backup
  # Supports glob and regex patterns
  exclude:
    - "**/*.swp"
    - "**/.DS_Store"
    - "**/node_modules"
    # Example regex: "/\\.bak$/" excludes all .bak files

  # (Required) Backup filename pattern
  # Available placeholders: {hostname}, {date}, {time}, {datetime}, {tag}
  filename: "{hostname}_{datetime}"

  # (Optional) Custom backup destination
  # Default: ~/.syncpoint/backups/
  destination: ~/Backups

scripts:
  # (Optional) Include ~/.syncpoint/scripts/ in backups
  # Default: true
  includeInBackup: true
```

### Filename Placeholders

| Placeholder | Example | Description |
|-------------|---------|-------------|
| `{hostname}` | `macbook-pro` | System hostname |
| `{date}` | `2024-01-15` | Current date (YYYY-MM-DD) |
| `{time}` | `14-30-00` | Current time (HH-MM-SS) |
| `{datetime}` | `2024-01-15_14-30-00` | Combined date and time |
| `{tag}` | `before-upgrade` | Custom tag from `--tag` option |

### Pattern Types

Syncpoint supports three types of patterns for `targets` and `exclude` fields:

#### Literal Paths

Direct file or directory paths. Tilde (`~`) is automatically expanded to home directory.

**Examples:**
- `~/.zshrc` — Specific file in home directory
- `/etc/hosts` — Absolute path
- `~/.ssh/config` — Nested file

#### Glob Patterns

Wildcard patterns for matching multiple files. Uses standard glob syntax.

**Examples:**
- `*.conf` — All .conf files in current directory
- `~/.config/*.yml` — All .yml files in ~/.config/
- `**/*.toml` — All .toml files recursively
- `~/.config/**/*.conf` — All .conf files under ~/.config/ recursively

**Glob metacharacters:** `*` (any), `?` (single), `{a,b}` (alternatives)

#### Regex Patterns

Regular expressions for advanced pattern matching. Must be enclosed in forward slashes (`/pattern/`).

**Format:** `/pattern/` (e.g., `/\.conf$/`)

**Examples:**
- `/\.conf$/` — Files ending with .conf
- `/\.toml$/` — Files ending with .toml
- `/\.(bak|tmp)$/` — Files ending with .bak or .tmp
- `/^\.config\//` — Files starting with .config/

**Limitations:**
- Regex targets scan home directory (`~/`) only
- Maximum depth: 5 levels for performance
- No unescaped forward slashes in pattern body

**When to use regex:**
- Complex extension matching: `/\.(conf|toml|yaml)$/`
- Pattern-based exclusions: `/\.(bak|tmp|cache)$/`
- Path prefix/suffix matching

### Example Configuration

```yaml
backup:
  targets:
    - ~/.zshrc
    - ~/.zprofile
    - ~/.gitconfig
    - ~/.gitignore_global
    - ~/.ssh/config
    - ~/.config/starship.toml
    - ~/Documents/notes

  exclude:
    - "**/*.swp"
    - "**/*.tmp"
    - "**/.DS_Store"
    - "**/*cache*"

  filename: "{hostname}_{date}_{tag}"
  destination: ~/Dropbox/backups

scripts:
  includeInBackup: true
```

---

## 📝 Provisioning Templates

Templates are YAML files stored in `~/.syncpoint/templates/` that define automated provisioning steps.

### Template Schema

```yaml
# (Required) Template name
name: string

# (Optional) Template description
description: string

# (Optional) Backup to restore after provisioning
backup: string

# (Optional) Require sudo privilege
sudo: boolean

# (Required) List of provisioning steps
steps:
  - name: string              # (Required) Step name
    description: string       # (Optional) Step description
    command: string           # (Required) Shell command to execute
    skip_if: string           # (Optional) Skip if this command succeeds
    continue_on_error: boolean # (Optional) Continue on failure (default: false)
```

### Example Template

Create `~/.syncpoint/templates/dev-setup.yml`:

```yaml
name: Development Setup
description: Install development tools and configure environment
sudo: true

steps:
  - name: Update System
    description: Update package manager
    command: apt-get update && apt-get upgrade -y

  - name: Install Git
    command: apt-get install -y git
    skip_if: which git

  - name: Install Node.js
    command: curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs
    skip_if: which node

  - name: Install pnpm
    command: npm install -g pnpm
    skip_if: which pnpm

  - name: Configure Git
    command: |
      git config --global user.name "Your Name"
      git config --global user.email "your.email@example.com"
    continue_on_error: true

  - name: Clone Repositories
    description: Clone important repositories
    command: |
      mkdir -p ~/projects
      cd ~/projects
      git clone https://github.com/username/repo.git
```

### Running Templates

```bash
# Preview template execution
npx @lumy-pack/syncpoint provision dev-setup --dry-run

# Run template
npx @lumy-pack/syncpoint provision dev-setup

# Run and skip config restore
npx @lumy-pack/syncpoint provision dev-setup --skip-restore
```

---

## 📁 Directory Structure

After initialization, syncpoint creates the following structure:

```
~/.syncpoint/
├── config.yml           # Main configuration file
├── backups/             # Backup archives (tar.gz)
│   ├── host1_2024-01-15.tar.gz
│   └── host1_2024-01-20.tar.gz
├── templates/           # Provisioning templates (YAML)
│   ├── example.yml
│   └── dev-setup.yml
├── scripts/             # Optional shell scripts to include in backups
│   └── custom-script.sh
└── logs/                # Operation logs
```

### Backup Archive Contents

Each backup archive contains:
- Your configuration files in their relative paths
- `_metadata.json` with backup information:
  - File hashes for comparison
  - System information (hostname, platform, architecture)
  - Backup creation timestamp
  - File count and total size

---

## 💡 Examples

### Backup and Restore Workflow

**On your current machine:**

```bash
# Initialize and configure
npx @lumy-pack/syncpoint init
vim ~/.syncpoint/config.yml  # Edit targets

# Create backup
npx @lumy-pack/syncpoint backup --tag "work-setup"
```

**On a new machine:**

```bash
# Initialize (no installation needed with npx!)
npx @lumy-pack/syncpoint init

# Copy backup file to ~/.syncpoint/backups/
# Or set custom destination in config.yml

# Restore
npx @lumy-pack/syncpoint restore
# Select your backup from the list
```

### Machine Provisioning Workflow

**Setup a new development machine:**

```bash
# Initialize syncpoint
npx @lumy-pack/syncpoint init

# Create provisioning template
cat > ~/.syncpoint/templates/new-machine.yml << 'EOF'
name: New Machine Setup
description: Complete development environment setup
sudo: true

steps:
  - name: Install Homebrew
    command: /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    skip_if: which brew

  - name: Install Core Tools
    command: brew install git vim tmux

  - name: Install Node.js
    command: brew install node@20
    skip_if: which node

  - name: Install pnpm
    command: npm install -g pnpm
    skip_if: which pnpm
EOF

# Preview execution
npx @lumy-pack/syncpoint provision new-machine --dry-run

# Run provisioning
npx @lumy-pack/syncpoint provision new-machine
```

### Cleanup Old Backups

```bash
# Check current status
npx @lumy-pack/syncpoint status

# Interactive cleanup
npx @lumy-pack/syncpoint status --cleanup

# Options:
# 1. Keep only 5 most recent backups
# 2. Remove backups older than 30 days
# 3. Delete all logs
# 4. Manual selection
```

---

## 🛡️ Security Features

Syncpoint includes multiple security layers to protect your data and system:

### Backup Security

- **Sensitive File Warnings** — Alerts when backing up SSH keys, certificates, or private keys
  - Patterns: `id_rsa`, `id_ed25519`, `*.pem`, `*.key`
- **Large File Warnings** — Warns about files larger than 10MB
- **File Hashing** — SHA-256 hashes for reliable file comparison

### Restore Security

- **Automatic Safety Backups** — Creates `_pre-restore_` backup before overwriting files
- **Hash Comparison** — Skips identical files to prevent unnecessary changes
- **Symlink Validation** — Prevents symlink attacks and directory traversal
- **Dry-run Mode** — Preview all changes before applying

### Provisioning Security

- **Remote Script Blocking** — Blocks dangerous patterns:
  - `curl ... | bash`
  - `wget ... | sh`
  - `curl ... | python`
  - Any pipe to shell execution from remote sources
- **Error Sanitization** — Masks sensitive information in error output (paths, passwords, tokens)
- **Template Validation** — JSON Schema validation for all templates
- **Sudo Handling** — Prompts for elevation only when required
- **Command Timeout** — 5-minute timeout per step prevents hanging

### General Safety

- **Path Validation** — Prevents operations outside allowed directories
- **Deletion Restrictions** — Only allows deletion within syncpoint directories
- **Permission Checks** — Validates file permissions before operations

---

## 🔧 Troubleshooting

### Wizard Commands

**Claude Code CLI not found**

If you see "Claude Code CLI not found" error:
1. Install Claude Code CLI: Visit [claude.ai/code](https://claude.ai/code) for installation instructions
2. Or use `--print` mode to get the prompt and use it with your preferred LLM
3. Verify installation: `claude --version`

**Validation errors after LLM generation**

The wizard automatically retries up to 3 times when validation fails:
- Each retry includes error feedback to help the LLM correct the issues
- If all retries fail, check the validation error messages
- Common issues:
  - Missing required fields (`backup.targets`, `backup.exclude`, `backup.filename`)
  - Invalid pattern syntax in targets/exclude arrays
  - Empty or malformed YAML structure

**Print mode usage**

Use `--print` mode when Claude Code is not available:
```bash
# Get the prompt
npx @lumy-pack/syncpoint wizard --print > prompt.txt

# Copy prompt.txt to your LLM
# Save the YAML response to ~/.syncpoint/config.yml
```

**Session context lost**

The wizard preserves session context across retries using Claude Code's session management. If context is lost:
- The wizard will start a new session on the next retry
- Manual intervention may be needed after 3 failed attempts

### General Issues

**Permission errors**

If you encounter permission errors:
- Ensure you have write access to `~/.syncpoint/`
- Check file permissions: `ls -la ~/.syncpoint/`
- Run with appropriate permissions (avoid unnecessary sudo)

**Large file warnings**

Files larger than 10MB trigger warnings:
- Consider excluding large files using `exclude` patterns
- Review if these files should be in version control instead
- Compress large files before backing up

**Backup restore conflicts**

If restore shows many "overwrite" actions:
- Use `--dry-run` to preview changes first
- Automatic safety backup is created before overwrite
- Review the safety backup in `~/.syncpoint/backups/` tagged with `_pre-restore_`

---

## 🔧 Development

### Build and Test

```bash
# Install dependencies
pnpm install

# Development mode
pnpm dev

# Build
pnpm build

# Run tests
pnpm test

# Run all tests (unit + integration + e2e + docker)
pnpm test:all

# Lint and format
pnpm lint
pnpm format
```

### Technology Stack

- **CLI Framework:** Commander.js
- **Terminal UI:** Ink + React
- **Configuration:** YAML parsing
- **Validation:** AJV (JSON Schema)
- **File Operations:** fast-glob, tar
- **Build:** tsup, TypeScript
- **Testing:** Vitest

### Project Structure

```
packages/syncpoint/
├── src/
│   ├── cli.ts              # CLI entry point
│   ├── commands/           # Command implementations
│   ├── core/               # Core logic (backup, restore, provision)
│   ├── schemas/            # JSON Schema validation
│   ├── components/         # React/Ink UI components
│   └── utils/              # Utilities
├── assets/
│   ├── config.default.yml  # Default configuration
│   └── template.example.yml # Example template
└── tests/
    ├── unit/
    ├── integration/
    ├── e2e/
    └── docker/
```

---

## 📄 License

MIT © [Vincent K. Kelvin](https://github.com/vincent-kk)

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🐛 Issues

If you encounter any issues or have questions, please [open an issue](https://github.com/vincent-kk/lumy-pack/issues) on GitHub.

---

Made with ❤️ by Vincent K. Kelvin
