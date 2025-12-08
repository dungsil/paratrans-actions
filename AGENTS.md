# AGENTS.md

This file provides guidance to AI when working with code in this repository.

## Project Overview

This is a **Paradox Interactive Game Mod Translation Tool** that automatically translates localization files for **Crusader Kings III (CK3)**, **Victoria 3 (VIC3)**, and **Stellaris** mods from English to Korean using Google's Gemini AI. The tool processes game mod files while preserving game-specific formatting, variables, and syntax.

## Common Commands

```bash
# Update all upstream repositories (optimized sparse checkout)
pnpm upstream

# Update upstream repositories for a specific game
pnpm upstream ck3          # CK3 only
pnpm upstream vic3         # VIC3 only
pnpm upstream stellaris    # Stellaris only

# Update upstream for a specific mod in a specific game
pnpm upstream ck3 RICE     # CK3's RICE mod only
pnpm upstream vic3 "Better Politics Mod"  # VIC3's Better Politics Mod

# Get help for upstream command
pnpm upstream --help

# Run CK3 translation process
pnpm ck3

# Update file hashes without translating (useful for detecting changes)
pnpm ck3:update-hash

# Invalidate translations based on dictionary updates
pnpm ck3:update-dict

# Invalidate translations based on dictionary updates (with filtering options)
# Only invalidate translations for dictionary keys changed in a specific commit
pnpm ck3:update-dict -- --since-commit <commit-id>

# Only invalidate translations for dictionary keys changed in a commit range
pnpm ck3:update-dict -- --commit-range <from-commit>..<to-commit>

# Only invalidate translations for dictionary keys changed since a specific date
pnpm ck3:update-dict -- --since-date "2024-01-01"

# Retranslate incorrectly translated items (based on validation rules)
pnpm ck3:retranslate

# Run VIC3 translation process
pnpm vic3

# Update VIC3 file hashes without translating
pnpm vic3:update-hash

# Invalidate VIC3 translations based on dictionary updates
pnpm vic3:update-dict

# With filtering options (same as CK3)
pnpm vic3:update-dict -- --since-commit <commit-id>
pnpm vic3:update-dict -- --commit-range <from>..<to>
pnpm vic3:update-dict -- --since-date "2024-01-01"

# Retranslate incorrectly translated VIC3 items
pnpm vic3:retranslate

# Run Stellaris translation process
pnpm stellaris

# Update Stellaris file hashes without translating
pnpm stellaris:update-hash

# Invalidate Stellaris translations based on dictionary updates
pnpm stellaris:update-dict

# With filtering options (same as CK3)
pnpm stellaris:update-dict -- --since-commit <commit-id>
pnpm stellaris:update-dict -- --commit-range <from>..<to>
pnpm stellaris:update-dict -- --since-date "2024-01-01"

# Retranslate incorrectly translated Stellaris items
pnpm stellaris:retranslate

# Add dictionary entries from a git commit
pnpm add-dict <commit-id>

# Run tests (run before and after script modifications)
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Install dependencies
pnpm install
```

## Architecture

### Metadata-Driven Processing
Each mod directory contains a `meta.toml` file that defines translation configuration:
```toml
[upstream]
localization = ["RICE/localization/english"]  # Source file paths
language = "english"                          # Source language
```

### Translation Pipeline
1. **Upstream Update**: Optimized repository sync using sparse checkout (`utils/upstream.ts`)
2. **Discovery**: Scan for `meta.toml` files in game directories
3. **Parsing**: Parse YAML localization files (`l_english:` → `l_korean:`)
4. **Mode Detection**: Automatic transliteration mode detection based on filename patterns
5. **Hashing**: Generate content hashes to detect changes (via `utils/hashing.ts`)
6. **Translation/Transliteration**: AI translation or transliteration with game-specific context prompts
7. **Caching**: Store results in database with separate cache keys for translation vs transliteration
8. **Output**: Generate Korean files with `___` prefix for proper load order

### Key Components

**Core Translation Logic** (`scripts/factory/translate.ts`):
- Orchestrates the entire translation workflow
- Automatic transliteration mode detection via `shouldUseTransliteration(filename)`
- Handles file discovery, parsing, and output generation
- Translation refusal tracking and graceful error handling
- Exports untranslated items to `{game}-untranslated-items.json`

**AI Integration** (`scripts/utils/ai.ts`):
- Google Gemini API integration
- Context-aware prompts for medieval/historical content
- Separate transliteration prompts for proper nouns (culture, dynasty, character names)
- Retry logic for API failures
- Translation refusal detection and error handling

**Prompt Management** (`scripts/utils/prompts.ts`):
- Dual-mode system: translation prompts vs transliteration prompts
- `getSystemPrompt(gameType, useTransliteration)` - selects appropriate prompt
- `shouldUseTransliteration(filename)` - detects files by keywords: culture, dynasty, names, character_name, name_list
- Game-specific transliteration prompts using proper nouns dictionary instead of general glossary

**Game-Specific Parsing** (`scripts/parser/yaml.ts`):
- Preserves CK3 variables (`$k_france$`, `[GetTitle]`, `#bold#`)
- Converts file naming: `*_l_english.yml` → `___*_l_korean.yml`

**Smart Caching System** (`scripts/utils/cache.ts`):
- Content-based hashing to detect source changes
- Translation memory with manual dictionary overrides
- Separate cache namespaces: `transliteration:text` vs `text` (or `{game}:transliteration:text` for non-CK3)
- Persistent storage to avoid retranslation

**Translation Validation** (`scripts/utils/translation-validator.ts`):
- Detects incorrectly translated items based on validation rules
- Validates preservation of technical identifiers (snake_case like `mod_icon_*`)
- Ensures game variables in brackets remain untranslated (e.g., `[region|E]`, `[GetTitle]`)
- Checks for unwanted LLM responses in translations
- Used by retranslation script to find items that need re-translation

**Dictionary Management** (`scripts/utils/dictionary.ts` and `scripts/add-dict-from-commit.ts`):
- Manual translation dictionary for game-specific terms and proper nouns
- Separate dictionaries for each game type (CK3, Stellaris, VIC3)
- Two dictionary types: general glossary (for translation) and proper nouns (for transliteration)
- `add-dict-from-commit.ts` script extracts dictionary entries from git commits and adds them to the dictionary file
- Supports automatic duplicate detection when adding entries
- Usage: `pnpm add-dict <commit-id>` to import dictionary changes from a specific commit

### Transliteration Mode

The system automatically switches between **translation** (번역) and **transliteration** (음역) based on file naming patterns.

**When to use each mode**:
- **Translation**: Semantic meaning conversion for general game content (events, modifiers, decisions, etc.)
- **Transliteration**: Phonetic conversion for proper nouns (culture names, dynasty names, character names)

**Automatic detection** (`shouldUseTransliteration(filename)`):
Files are automatically processed in transliteration mode when the filename contains:
- `culture` or `cultures` - Culture name files
- `dynasty` or `dynasties` - Dynasty name files
- `names` - Name list files
- `character_name` - Character name files
- `name_list` - Name list files

**Examples**:
```typescript
// Transliteration mode (automatic)
shouldUseTransliteration("culture_name_lists_l_english.yml")  // → true
shouldUseTransliteration("wap_dynasty_names_l_english.yml")   // → true
shouldUseTransliteration("character_names_l_english.yml")     // → true

// Translation mode (automatic)
shouldUseTransliteration("events_l_english.yml")              // → false
shouldUseTransliteration("modifiers_l_english.yml")           // → false
```

**How it works**:
1. File is detected during processing in `factory/translate.ts`
2. `shouldUseTransliteration(filename)` determines the mode
3. Appropriate prompt is selected: `CK3_TRANSLITERATION_PROMPT` vs `CK3_SYSTEM_PROMPT`
4. Proper nouns dictionary is used instead of general glossary
5. Cache key includes `transliteration:` prefix to separate from translations
6. Both modes use the same YAML output format

**Result differences**:
```
File: culture_name_lists_l_english.yml (transliteration mode)
"Afar" → "아파르" (phonetic)
"Anglo-Saxon" → "앵글로색슨" (phonetic)
"Bolghar" → "볼가르" (phonetic)

File: events_l_english.yml (translation mode)
"the culture" → "문화" (semantic)
"dynasty name" → "왕조 이름" (semantic)
```

**Benefits**:
- Maintains consistency in proper noun transliteration
- Prevents semantic translation errors for names (e.g., "Afar" as "멀리" meaning "far away")
- Uses established proper nouns dictionary for historical accuracy
- Completely automatic - no manual configuration needed
- Separate caching ensures no conflicts between modes

**Related files**:
- `scripts/utils/prompts.ts` - Mode detection and prompt selection
- `scripts/factory/translate.ts` - Mode integration in translation pipeline
- `scripts/utils/dictionary.ts` - Separate proper nouns dictionary
- `scripts/utils/dictionary-invalidator.ts` - Handles transliteration files in update-dict
- `scripts/utils/retranslation-invalidator.ts` - Handles transliteration files in retranslate

### Directory Structure

```
ck3/                    # CK3 mods to translate
├── RICE/              # "Rajas of Asia in CK3 Events" mod
├── VIET/              # "VIET Events" mod
└── [MOD_NAME]/        # Pattern for additional mods
    ├── meta.toml      # Configuration
    ├── upstream/      # Original English files
    └── mod/           # Generated Korean translations

scripts/
├── ck3.ts            # Main entry point
├── factory/          # Translation processing
├── parser/           # File parsing (TOML, YAML)
└── utils/            # AI, caching, logging utilities
```

## Development Notes

- Uses TypeScript with jiti for direct execution
- Google Gemini AI integration requires `GOOGLE_GENERATIVE_AI_API_KEY` environment variable
- File hashing system prevents unnecessary retranslation of unchanged content
- Translation dictionary in `scripts/utils/dictionary.ts` provides manual overrides
- Logging system supports different verbosity levels via `scripts/utils/logger.ts`

### Translation Refusal Handling

The system includes comprehensive handling for AI translation refusals (e.g., content policy violations, safety filters):

**Automatic Tracking**:
- Translation refusals are automatically detected during the translation process
- Failed items are collected with context: mod, file, key, and original message
- Intermediate progress is saved when a refusal occurs (graceful degradation)

**Output Format**:
- Untranslated items are exported to `{game}-untranslated-items.json`
- JSON format includes timestamp and structured item list
- Each item contains: `mod`, `file`, `key`, `message`

**GitHub Integration**:
- Workflow automatically creates GitHub Issues for translation refusals
- Issues are grouped by mod with label `translation-refused` and game-specific labels
- Duplicate issues are avoided by checking for existing open issues
- Long messages are collapsed in expandable details sections

**Example output structure**:
```json
{
  "gameType": "ck3",
  "timestamp": "2025-12-08T01:00:00.000Z",
  "items": [
    {
      "mod": "RICE",
      "file": "events_l_english.yml",
      "key": "event.1.desc",
      "message": "Original English text..."
    }
  ]
}
```

**Related files**:
- `scripts/factory/translate.ts` - Refusal detection and collection
- `.github/workflows/translate-{game}.yml` - Issue creation automation

### Dictionary Update Optimization

The `update-dict` command now supports **filtering by Git commit history** to avoid invalidating too many translations unnecessarily.

**Usage patterns**:

1. **Full dictionary invalidation** (default, original behavior):
   ```bash
   pnpm ck3:update-dict
   ```
   Invalidates all translations containing any dictionary word. Use this when you're unsure which keys changed.

2. **Specific commit only**:
   ```bash
   pnpm ck3:update-dict -- --since-commit abc123
   ```
   Only invalidates translations for dictionary keys that were added or modified in the specified commit `abc123`.

3. **Commit range**:
   ```bash
   pnpm ck3:update-dict -- --commit-range abc123..def456
   ```
   Only invalidates translations for dictionary keys changed between two commits.

4. **Since a date**:
   ```bash
   pnpm ck3:update-dict -- --since-date "2024-01-01"
   pnpm ck3:update-dict -- --since-date "1 week ago"
   ```
   Only invalidates translations for dictionary keys changed since a specific date. Accepts ISO 8601 format or Git date expressions.

**How it works**:
- The tool analyzes `git log -p` output for `scripts/utils/dictionary.ts`
- Extracts keys from lines starting with `+` (additions) in relevant dictionary sections
- Only invalidates translations containing those specific keys
- Significantly reduces the number of translations to re-translate

**Example workflow**:
```bash
# After adding new dictionary entries
git add scripts/utils/dictionary.ts
git commit -m "Add new dictionary entries"

# Only invalidate translations for the newly added keys in the current commit
pnpm ck3:update-dict -- --since-commit HEAD

# Then run translation to update only affected items
pnpm ck3
```

### Code Style Guidelines

**Important**: All code comments and test names should be written in Korean.

**Comments**:
- Write all comments in Korean (한국어로 주석 작성)
- This includes inline comments, block comments, and documentation comments
- Example: `// 파일이 존재하지 않으면 원본에서 복사` instead of `// File doesn't exist, copy from source`

**Test Names**:
- All test descriptions in `describe()` and `it()` should be in Korean
- Example: `describe('캐시', () => { it('캐시 값을 저장하고 조회할 수 있어야 함', () => { ... })` 
- Instead of: `describe('cache', () => { it('should store and retrieve cache value', () => { ... })`

**Rationale**:
- The project is maintained by Korean developers and contributors
- Korean comments and test names improve readability and maintainability for the team
- Test output in Korean makes it easier to understand test failures and debugging

### Testing

**Important**: When modifying scripts in the `scripts/` directory, **ALWAYS run tests** to validate your changes.

**Test commands**:
```bash
# Run all tests
pnpm test

# Run tests in watch mode during development
pnpm test:watch

# Run tests with UI
pnpm test:ui

# Run tests with coverage report
pnpm test:coverage
```

**Testing guidelines**:
- Run `pnpm test` **before** making changes to understand the current test state
- Run `pnpm test` **after** making changes to ensure no regressions
- When adding new utility functions or modifying existing ones, verify that related tests pass
- Test files are located alongside the source code with `.test.ts` extension
- The test framework is Vitest, configured in `vitest.config.ts`
- All tests in `scripts/**/*.test.ts` are automatically discovered and run

### Working with Upstream Source Files

**Important**: The `upstream/` directories are **NOT committed to the repository**. They contain the original English localization files from the game mods and are automatically downloaded during the translation process.

#### Upstream Update Process

All translation scripts (`pnpm ck3`, `pnpm vic3`, `pnpm stellaris`) **automatically update upstream repositories** at the beginning of their execution. This ensures you always work with the latest source files.

**Manual upstream update**:
```bash
# Update all upstream repositories for all games
pnpm upstream
```

The upstream update process:
1. Uses **sparse checkout** to download only the localization files (efficient, no full repository clone)
2. Configured in `meta.toml` files in each mod directory
3. Pulls latest changes from the game mod repositories
4. Only downloads files specified in `meta.toml` → `upstream.localization` paths

**If you need to test validation**:
```bash
# Step 1: Ensure upstream files are present
pnpm upstream

# Step 2: Run retranslate to validate existing translations
pnpm ck3:retranslate
```

**Directory structure after upstream update**:
```
ck3/RICE/
├── meta.toml
├── upstream/              # Downloaded automatically (NOT in git)
│   └── RICE/localization/english/
│       └── *.yml         # Source English files
└── mod/                  # Generated translations (committed)
    └── localization/korean/
        └── ___*.yml      # Korean translation files
```

### Documentation Guidelines

**Important**: Do NOT create analysis, verification, summary, or temporary markdown files in the repository root.

**Prohibited file types** (automatically excluded by `.gitignore`):
- Analysis files: `*_ANALYSIS.md`, `CRASH_ANALYSIS.md`
- Verification/result files: `*_RESULTS.md`, `VERIFICATION_*.md`
- Summary files: `*_SUMMARY.md`, `IMPLEMENTATION_*.md`, `ISSUE_RESOLUTION_*.md`
- Fix documentation: `*_FIX*.md`
- Korean analysis files: `*_결과_*.md`, `*_요약*.md`, `*_해결_*.md`, `크래시_*.md`, `실행_*.md`

**Acceptable markdown files:**
- `README.md` - Main project documentation
- `AGENTS.md` - This file, for AI agent guidance
- Tool-specific READMEs in subdirectories (e.g., `scripts/*/README.md`)

**Guidelines for AI agents:**
- Do NOT create markdown files for planning, notes, or tracking—work in memory instead
- Only create markdown files when the user explicitly asks for a specific file by name or path
- Analysis results, verification reports, and summaries should be communicated directly to the user in the chat, not saved as files
- If temporary documentation is needed during development, create it in `/tmp` directory
