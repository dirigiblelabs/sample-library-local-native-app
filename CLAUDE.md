# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install            # required once; the project has runtime dependencies
npm run dev            # tsx watch — runs src/server.ts directly, restarts on edits
npm run build          # tsc -> dist/
npm start              # node dist/server.js (run `build` first)
npm run build:start    # build + start in one command
npm stop               # kill process bound to $PORT (default 8080)

# build:start with library info overridden via env:
LIBRARY_ADDRESS="42 Wallaby Way, Sydney" LIBRARY_PHONE="+61-2-9999-0042" npm run build:start
npm test               # vitest run (single pass)
npm run test:watch     # vitest in watch mode
npm run typecheck      # tsc --noEmit
```

Run a single test or a single file with vitest:

```bash
npx vitest run test/books.test.ts
npx vitest run -t "rejects duplicate ISBN"
```

To see request/error logs while debugging tests, set `TEST_LOG=debug` (defaults to `silent`):

```bash
TEST_LOG=debug npm test
```

Configuration is via env (see `.env.example`): `PORT` (default `8080`), `HOST`, `AUTH_USER` / `AUTH_PASSWORD` (default `admin`/`admin`), `LOG_LEVEL`, `API_BASE_PATH` (default `/rest/api/v1`), `LIBRARY_ADDRESS` / `LIBRARY_PHONE` (defaults wired into `loadConfig`, surfaced read-only at `GET ${API_BASE_PATH}/library`). Bad values throw on startup — `loadConfig` validates with Zod.

## Architecture

Single-process Fastify HTTP service over an in-memory `Map`. Stateless across restarts.

### The Zod ↔ Fastify ↔ OpenAPI spine

The single most important pattern: **Zod schemas in `src/schemas/book.ts` are the source of truth for validation, response serialization, TypeScript types (via `z.infer<>`), and the OpenAPI document.** A route declares Zod schemas in its `schema:` block, and `fastify-type-provider-zod` wires them into all three pipelines. Adding a field means changing the Zod schema, not the handler — `req.body`/`req.query`/`req.params` are typed from the schema, and `@fastify/swagger` regenerates the docs.

### The request lifecycle

1. `src/server.ts` loads config and calls `buildApp(config)`.
2. `src/app.ts` is the factory. **Order matters:**
   - `setValidatorCompiler` + `setSerializerCompiler` from `fastify-type-provider-zod` *first*.
   - `setErrorHandler` and `setNotFoundHandler` *before* any plugin/route registration. **Fastify 5 binds the error handler to routes at registration time** — set it after `register(routes)` and your custom handler is silently bypassed in favor of Fastify's default. This bit us during the v2 rewrite; do not move these calls.
   - Then `@fastify/swagger`, `@fastify/swagger-ui`, then `authPlugin`, then `booksRoutes`.
3. `src/plugins/auth.ts` registers `@fastify/basic-auth` and adds it as a **global `onRequest` hook**. This is intentional: it protects both the API routes AND the Swagger UI/JSON at `/docs`. Credential compare goes through `crypto.timingSafeEqual` against equal-length buffers.
4. The central error handler in `src/app.ts` maps three error families:
   - Zod validation errors (detected via `hasZodFastifySchemaValidationErrors`) → `400` with field-level `details`
   - `HttpError` thrown by the store (`src/errors.ts`) → its status code with structured body
   - Errors with a 4xx `statusCode` from Fastify plugins (notably `@fastify/basic-auth`'s 401) → that status, preserving `WWW-Authenticate` on 401
   - Anything else → `500` with logged stack trace

### Why error response schemas are *not* declared per route

`src/routes/books.ts` only declares response schemas for the success status codes (`200`/`201`/`204`). If you declare `401`/`404`/`409` Zod schemas on a route, the serializer will try to validate the error body against them, which clashes with the central error envelope produced by `setErrorHandler`. Keep error handling centralized; don't add per-route error schemas.

### DELETE returns 204 — schema must be `z.null()`

The Zod serializer compiler rejects raw JSON schemas (e.g. `{ type: 'null' }`). DELETE uses `response: { 204: z.null() }` and the handler returns `null`. Same constraint applies anywhere a non-Zod schema would otherwise be tempting.

### Store semantics

`src/services/bookStore.ts` is a `Map<id, Book>` with an auxiliary `Map<isbn, id>` for uniqueness. ISBN uniqueness is enforced on create/replace/patch and surfaces as `409 Conflict` via the `conflict()` helper in `src/errors.ts`. The store throws `HttpError`s directly; routes never check existence themselves.

### Testing

Tests use **`fastify.inject()`** (Fastify's in-process HTTP simulator), not a real listening socket. `test/helpers.ts` builds the full app — same `buildApp` path as production, with `PORT=0` and `LOG_LEVEL=silent`. When adding tests, use `app.inject(...)` rather than spinning up a real server.

## Conventions specific to this repo

- **ESM throughout** (`"type": "module"`). All imports use `.js` extensions for relative imports because of `moduleResolution: NodeNext`, even though the source is `.ts`.
- **strict tsconfig** including `noUncheckedIndexedAccess`, `noImplicitOverride`, `noUnusedLocals`/`Parameters`. Avoid `any` in app code.
- **Single API contract.** The REST surface (paths, status codes, headers, error envelope `{ error: { status, message, details? } }`, pagination envelope `{ total, offset, limit, items }`) is stable and was preserved from the v1 (zero-dep) implementation. Don't break it without intent.
- **License: EPL-2.0.** Both `package.json` and the `LICENSE` file agree; don't introduce conflicting headers.
