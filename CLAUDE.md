# Architecture Overview

This is a Next.js 16 application for managing and tagging image collections with the following architecture:

## State Management

- Redux Toolkit with typed hooks
- Store slices: assets, autoTagger, filters, preferences, project, selection, toasts, training
- Custom middleware: filter-manager for coordinating filter state changes
- Async operations handled via AppThunk type

## Routing

- `/` — Project list (always shown, no single-project mode)
- `/tagging/[project]/[page]` — Image tagging view with pagination
- `/training/[project]` — Training configuration and monitoring (in development)

Project context is derived from the URL slug, not sessionStorage. The `[project]` segment is the folder name within the configured `projectsFolder`.

## Core Features

- Image gallery with pagination
- Tag management (add/edit/reorder tags via drag-and-drop using @dnd-kit)
- Advanced filtering (tags, dimensions, filetype)
- Project-based organisation (multi-project only, no single-project/default mode)
- Tag persistence to associated text files
- LoRA training system (in development) — Python sidecar with ai-toolkit and Kohya backends

## Key Directories

- `src/app/store/` - Redux store configuration and slices
- `src/app/components/` - React components organised by feature area
- `src/app/services/` - Service layers (auto-tagger, training)
- `src/app/utils/` - Utility functions and helpers
- `src/app/api/` - Next.js API routes for serving images and project data
- `public/tagging-projects/` - Tagging project metadata and thumbnails

## Component Architecture

- Feature-based component organization (asset, tagging, top-shelf, bottom-shelf)
- Shared components in `src/app/components/shared/`
- Hook-based logic extraction for complex components
- Context providers for component-specific state (tagging, filters, popups)

## API Structure

- `/api/images/[...path]` - Dynamic image serving
- `/api/auto-tagger/*` - Auto-tagger model management, batch tagging, downloads
- `/api/config` - Configuration data (projectsFolder, pythonPath, trainingBackends)

## Data Flow

- Images and tags loaded via API routes
- Project context derived from URL params (`[project]` slug), stored in Redux
- Components use typed selectors and actions
- Filter changes trigger middleware that coordinates related state updates

# Development Guidelines

## File Structure and Naming

- Lower kebab-case filenames for all TypeScript/TSX files (`file-name.ts`)
- Preference for named exports over default exports
- Only export values consumed elsewhere
- Path alias `@/app/...` for clean imports, maximum two `../../` levels
- Feature-based component organization

## Component Folder Pattern (preferred)

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

## Code Style

- Australian English for UI text, US English for code (e.g., `colour` vs `color`)
- Prefer `requestAnimationFrame` over `setTimeout` for UI timing
- Performance optimisation with `React.memo`, `useSelector`, `useMemo`, `useCallback`
- For Lucide icons, use the `[Name]Icon` import, with the Icon suffix

## Data Structure

- Images have associated `.txt` files with comma-separated tags
- Supports .jpg, .jpeg, .png, .webp formats
- File pattern: `image.jpg` + `image.txt` in same directory
- UI state in memory only, not persisted between sessions
- Local app only; No over-the-network

## Documentation

- README.md files for complex components with sub-folders
- Minimal inline comments unless code is complex/unclear
- No need to document every prop
