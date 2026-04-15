# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Code style

Use comments sparingly. Only comment complex or non-obvious code.

## Commands

```bash
# Initial setup (install deps + Prisma generate + migrate)
npm run setup

# Development server (uses Turbopack + node-compat shim)
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Run a single test file
npx vitest run src/lib/__tests__/file-system.test.ts

# Reset the database
npm run db:reset
```

## Architecture

UIGen is a Next.js 15 App Router application where users chat with Claude to generate React components, which are rendered in a live sandbox preview.

### Core data flow

1. **User types a message** → `ChatInterface` (via `ChatContext`) sends it to `POST /api/chat` along with the serialized virtual file system.
2. **API route** (`src/app/api/chat/route.ts`) calls the Vercel AI SDK `streamText` with two tools: `str_replace_editor` and `file_manager`. These tools operate on a server-side `VirtualFileSystem` instance that was reconstructed from the serialized data sent by the client.
3. **Tool calls stream back** to the client. `FileSystemContext.handleToolCall` intercepts them and mutates the client-side `VirtualFileSystem`, incrementing a `refreshTrigger`.
4. **`PreviewFrame`** watches `refreshTrigger` and, on every change, takes all files from the VFS, transpiles them via Babel (`jsx-transformer.ts`), and creates blob URLs assembled into an `<importmap>`. It writes this as `srcdoc` into a sandboxed `<iframe>`.

### Virtual File System (`src/lib/file-system.ts`)

`VirtualFileSystem` is an in-memory tree of `FileNode` objects (not the real disk). It is instantiated on both the **server** (per-request, in the API route) and the **client** (in `FileSystemContext`). Serialization uses `Record<string, FileNode>` (plain objects, since `Map` is not JSON-serializable). The server serializes its final state and persists it to the `Project.data` column as JSON.

### AI tools

- **`str_replace_editor`** (`src/lib/tools/str-replace.ts`): `create`, `str_replace`, `insert`, and `view` commands — the same interface as Claude's native text editor tool.
- **`file_manager`** (`src/lib/tools/file-manager.ts`): `rename` and `delete` commands.

### JSX transformer (`src/lib/transform/jsx-transformer.ts`)

Runs entirely in the browser. Uses `@babel/standalone` to transpile `.jsx`/`.tsx`/`.ts`/`.js` files to plain JS. Third-party imports (non-relative, non-`@/`) are resolved via `https://esm.sh`. Missing local imports get placeholder stub modules so the preview still renders partially. CSS files are inlined as `<style>` tags.

### Auth

JWT-based sessions stored in an `httpOnly` cookie (`auth-token`). `src/lib/auth.ts` is `server-only`. Session verification in `src/middleware.ts` guards `/api/projects` and `/api/filesystem`. Anonymous users can work freely; their work is tracked via `src/lib/anon-work-tracker.ts` (localStorage) and migrated to their account on sign-up.

### Database

SQLite via Prisma. The schema is defined in `prisma/schema.prisma` — reference it for the structure of data stored in the database. `User` (email/password) → `Project` (stores messages as JSON string, file system state as JSON string). Prisma client is generated to `src/generated/prisma/`.

### Provider fallback

`src/lib/provider.ts` exports `getLanguageModel()`. If `ANTHROPIC_API_KEY` is absent, it returns a `MockLanguageModel` that generates static counter/form/card components without hitting the API.

### Contexts

- `FileSystemContext` — owns the client-side `VirtualFileSystem` instance, exposes CRUD helpers, and processes incoming AI tool calls.
- `ChatContext` — wraps Vercel AI SDK's `useChat`, passes serialized VFS and optional `projectId` in every request body.
