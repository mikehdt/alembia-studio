# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `pnpm dev` - Run development server with Turbopack
- `pnpm build` - Build for production
- `pnpm lint` - Run Next.js linting
- `pnpm format` - Format code with Prettier + ESLint --fix
- `pnpm knip` - Find unused dependencies and code

Package manager: pnpm (specified in packageManager field)

## First-time setup

1. `pnpm install` — JS/TS dependencies
2. Install [`uv`](https://docs.astral.sh/uv/) — used to manage the Python sidecar environment
3. Install `ffmpeg` (provides both `ffmpeg` and `ffprobe` on PATH) — required for video asset support. Used for reading video dimensions, generating poster frames for ONNX tagging, and sampling frames for VLM video captioning. Windows: `winget install Gyan.FFmpeg` or equivalent. Skip this step if you don't need video support.
4. That's it. The Python sidecar auto-provisions its venv via `uv run` on first invocation, reading dependencies from `training-sidecar/pyproject.toml`.

### Python sidecar

The sidecar handles LoRA training and VLM captioning. It's a FastAPI server
that Node.js spawns on demand via `sidecar-manager.ts`.

- Lives in `training-sidecar/`, managed as a uv project (`pyproject.toml` + `uv.lock`)
- Python 3.12 (pinned via `requires-python`)
- Node spawns it with `uv run python -u main.py --app-root ...` — uv handles venv creation and dependency install automatically
- Falls back to invoking `.venv/Scripts/python.exe` directly if `uv` isn't on PATH

VLM captioning has two optional runtimes. Pick the one(s) you want, or both:

- **CPU (GGUF via llama-cpp-python)**: `uv sync --extra vlm`
- **GPU (safetensors via PyTorch + HuggingFace transformers, Windows CUDA 12.8)**: `uv sync --extra gpu`
- **Both**: `uv sync --extra vlm --extra gpu`

Running `uv sync` with only one extra will uninstall the other, so be deliberate. The sidecar autodetects which is available at runtime and only offers matching model entries via the model manager.

Manual sync (rarely needed): `cd training-sidecar && uv sync`

## Architecture Overview

This is a Next.js 16 application for managing and tagging image collections with the following architecture:

### State Management

- Redux Toolkit with typed hooks
- Store slices: assets, autoTagger, filters, preferences, project, selection, toasts, training
- Custom middleware: filter-manager for coordinating filter state changes
- Async operations handled via AppThunk type

### Routing

- `/` — Project list (always shown, no single-project mode)
- `/tagging/[project]/[page]` — Image tagging view with pagination
- `/training/[project]` — Training configuration and monitoring (in development)

Project context is derived from the URL slug, not sessionStorage. The `[project]` segment is the folder name within the configured `projectsFolder`.

### Core Features

- Image gallery with pagination
- Tag management (add/edit/reorder tags via drag-and-drop using @dnd-kit)
- Advanced filtering (tags, dimensions, filetype)
- Project-based organisation (multi-project only, no single-project/default mode)
- Tag persistence to associated text files
- LoRA training system (in development) — Python sidecar with ai-toolkit and Kohya backends

### Key Directories

- `src/app/store/` - Redux store configuration and slices
- `src/app/components/` - React components organised by feature area
- `src/app/services/` - Service layers (auto-tagger, training)
- `src/app/utils/` - Utility functions and helpers
- `src/app/api/` - Next.js API routes for serving images and project data
- `public/tagging-projects/` - Tagging project metadata and thumbnails

### Component Architecture

- Feature-based component organization (asset, tagging, top-shelf, bottom-shelf)
- Shared components in `src/app/components/shared/`
- Hook-based logic extraction for complex components
- Context providers for component-specific state (tagging, filters, popups)

### API Structure

- `/api/images/[...path]` - Dynamic image serving
- `/api/auto-tagger/*` - Auto-tagger model management, batch tagging, downloads
- `/api/config` - Configuration data (projectsFolder, pythonPath, trainingBackends)

### Data Flow

- Images and tags loaded via API routes
- Project context derived from URL params (`[project]` slug), stored in Redux
- Components use typed selectors and actions
- Filter changes trigger middleware that coordinates related state updates

## Development Guidelines

### File Structure and Naming

- Lower kebab-case filenames for all TypeScript/TSX files (`file-name.ts`)
- Preference for named exports over default exports
- Only export values consumed elsewhere
- Path alias `@/app/...` for clean imports, maximum two `../../` levels
- Feature-based component organization

### Component Folder Pattern (preferred)

When a component has enough logic to warrant splitting, use a colocated folder:

```
component-name/
  component-name.tsx     ← presentational component (JSX)
  use-component-name.ts  ← hook with data, state, and logic
```

- **No per-component `index.ts` barrels** — import directly from the source file (e.g. `./component-name/component-name`). Barrels add indirection that slows navigation when tracing imports
- **Parent-level `index.ts` barrels are fine** for feature boundaries (e.g. a `components/index.ts` that acts as the public API for a feature area)
- **Component-specific hooks** live alongside their component in its folder
- **Shared hooks** (used by multiple siblings) live in a `hooks/` directory at the parent level
- This pattern ensures moving a folder moves all related code with it

### Code Style

- Australian English for UI text, US English for code (e.g., `colour` vs `color`)
- Prefer `requestAnimationFrame` over `setTimeout` for UI timing
- Performance optimisation with `React.memo`, `useSelector`, `useMemo`, `useCallback`
- For Lucide icons, use the `[Name]Icon` import, with the Icon suffix

### Data Structure

- Images have associated `.txt` files with comma-separated tags
- Supports .jpg, .jpeg, .png, .webp formats
- File pattern: `image.jpg` + `image.txt` in same directory
- UI state in memory only, not persisted between sessions
- Local app only; No over-the-network

### Documentation

- README.md files for complex components with sub-folders
- Minimal inline comments unless code is complex/unclear
- No need to document every prop
