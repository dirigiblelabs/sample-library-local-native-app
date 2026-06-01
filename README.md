# sample-library-native-app-nodejs

A small **library-management REST service** written in **TypeScript** on the
de-facto standard Node.js web stack: **Fastify** for HTTP, **Zod** for
schema-first validation and serialization (typed end-to-end via
[`fastify-type-provider-zod`](https://github.com/turkerdev/fastify-type-provider-zod)),
**Pino** (bundled with Fastify) for structured logging, **`@fastify/basic-auth`**
for HTTP Basic, and **`@fastify/swagger` + `@fastify/swagger-ui`** for an
auto-generated OpenAPI surface at `/docs`. Tests run on **Vitest** using
Fastify's `inject()` for fast, in-process HTTP simulation.

The book catalog itself is kept in an in-process `Map` — there is no database,
no persistence, and no external infrastructure. All state is lost on restart.

---

## Highlights

- **TypeScript-first.** Strict `tsconfig` (`strict`, `noUncheckedIndexedAccess`,
  `noImplicitOverride`, `noUnusedLocals/Parameters`, `NodeNext` module
  resolution). Zod schemas are the single source of truth for runtime
  validation **and** TypeScript types via `z.infer<...>`.
- **Fastify 5** with the official Zod type provider — request/response bodies,
  query strings, and path params are validated by Zod **and** typed in
  handlers without manual annotation.
- **OpenAPI 3** generated automatically from the Zod schemas and exposed at
  `GET /docs/json` and `GET /docs` (Swagger UI).
- **HTTP Basic auth** via `@fastify/basic-auth` with constant-time credential
  comparison (`crypto.timingSafeEqual`) and a `WWW-Authenticate` challenge on
  401. Default credentials `admin` / `admin`, overridable via environment.
- **Configurable port** (`PORT`, default `8080`) and host/log-level via env;
  configuration itself is validated by a Zod schema.
- **Pino structured logging** out of the box.
- **Graceful shutdown** on `SIGINT` / `SIGTERM`.
- **19-case Vitest suite** covering auth, full CRUD, validation, error mapping,
  pagination/filtering, and OpenAPI exposure.

---

## Requirements

- Node.js **22.x LTS** or newer (`node --version` ≥ `v22.0.0`).
- `npm`.

---

## Quick start

```bash
npm install

# Production mode (compile then run) — one command
npm run build:start

# Same, with custom library info applied to GET /library, via env vars
LIBRARY_ADDRESS="42 Wallaby Way, Sydney" \
LIBRARY_PHONE="+61-2-9999-0042" \
  npm run build:start

# Same, via CLI flags forwarded to the server (note the `--` separator):
npm run build:start -- \
  --library-address="42 Wallaby Way, Sydney" \
  --library-phone="+61-2-9999-0042"

# Or development mode (tsx watch — no build step)
npm run dev
```

On startup the app logs the URL it bound to and the path of the Swagger UI:

```
API ready at http://0.0.0.0:8080/rest/api/v1 — docs at http://0.0.0.0:8080/docs
```

Try it:

```bash
curl -u admin:admin http://localhost:8080/rest/api/v1/books
# => {"total":0,"offset":0,"limit":50,"items":[]}
```

Open Swagger UI in a browser at <http://localhost:8080/docs> (you will be
prompted for the credentials).

---

## Configuration

All configuration is via environment variables (loaded with `dotenv` from
`.env` if present). Defaults are filled in by a Zod schema; invalid values
will fail fast at startup. See [`.env.example`](./.env.example).

| Variable        | Default        | Description                                                     |
| --------------- | -------------- | --------------------------------------------------------------- |
| `PORT`          | `8080`         | TCP port to listen on. `0` selects an ephemeral port (tests).   |
| `HOST`          | `0.0.0.0`      | Interface to bind to.                                           |
| `AUTH_USER`     | `admin`        | Username accepted by HTTP Basic auth.                           |
| `AUTH_PASSWORD` | `admin`        | Password accepted by HTTP Basic auth.                           |
| `LOG_LEVEL`     | `info`         | Pino level — `trace`/`debug`/`info`/`warn`/`error`/`fatal`/`silent`. |
| `API_BASE_PATH` | `/rest/api/v1` | Prefix mounted under (must start with `/`).                     |
| `LIBRARY_ADDRESS` | `123 Library Lane, Booktown` | Address returned by `GET /library`.                  |
| `LIBRARY_PHONE`   | `+1-555-0100`                | Phone number returned by `GET /library`.             |

Example (env vars):

```bash
PORT=9090 AUTH_USER=alice AUTH_PASSWORD='s3cret!' LOG_LEVEL=debug npm start
```

Every setting can also be supplied as a long CLI flag. The kebab-case flag
matches the env-var name, and CLI flags win over env vars, which win over
defaults. Use `--` after the `npm run` script to forward flags through npm:

```bash
npm run build:start -- \
  --port=9090 --auth-user=alice --auth-password='s3cret!' --log-level=debug

# Direct (no npm) — same flags, no `--` needed
node dist/server.js --port=9090 --library-address="42 Wallaby Way"

# Show usage:
node dist/server.js --help
```

> **Security note.** The default credentials (`admin` / `admin`) are for local
> experimentation only. Override `AUTH_USER` and `AUTH_PASSWORD` for any
> deployment beyond your laptop, and put the service behind TLS — HTTP Basic
> sends credentials in clear text (after base64-encoding).

---

## Scripts

| Command              | What it does                                                              |
| -------------------- | ------------------------------------------------------------------------- |
| `npm run dev`        | Run `src/server.ts` directly with `tsx watch` (auto-restart on edits).    |
| `npm run build`      | Compile to `dist/` with `tsc`.                                            |
| `npm start`          | Run the compiled `dist/server.js`.                                        |
| `npm run build:start`| Compile and then start in one command.                                    |
| `npm test`           | Run the Vitest suite once.                                                |
| `npm run test:watch` | Run Vitest in watch mode.                                                 |
| `npm run typecheck`  | Run `tsc --noEmit` for fast TS checking without producing output.         |

---

## Eclipse Dirigible integration

This repo doubles as the canonical sample for Dirigible's
[**native applications**](https://www.dirigible.io/help/) feature. The
`sample-library-native-app-nodejs.native-app` artefact in the repo root tells
Dirigible to spawn this server as a managed local process and proxy traffic to
it under `/services/native-apps-proxy/v1/library-native-app-nodejs/...`.

The contract:
- Dirigible exports `DIRIGIBLE_NATIVE_APP_PORT` into the child process; the
  `loadConfig` function in `src/config.ts` prefers that variable over `PORT`,
  so the platform's resolved free port wins.
- The lifecycle `start.commands` invoke `sh -c "npm install ... && exec npm run
  build:start -- \"$@\""` (or `cmd /c ...` on Windows) — bootstrapping
  `node_modules` if needed, then handing off to the existing `npm run
  build:start` script. The trailing entries in `arguments[]` are positional
  args to the shell; the script forwards them via `"$@"` to
  `node dist/server.js`. The shipped artefact uses this to set
  `--library-address` and `--library-phone` at startup, demonstrating how
  authors can declare ad-hoc CLI overrides in their `.native-app`.
- **No `lifecycle.stop` is declared.** Dirigible's own `Process.destroy()` sends
  SIGTERM to the held PID, which Node's default signal handling + the server's
  shutdown hook in `src/server.ts` handles cleanly. Authoring a custom stop
  script that kills by port (`lsof | xargs kill` and similar) is dangerous —
  it will also kill the Dirigible JVM if Spring Cloud Gateway's HttpClient
  has an idle keep-alive connection to the upstream port.
- HTTP Basic auth credentials come from Dirigible at proxy time: the artefact
  declares `user`/`password` in the `credentials` block as
  `${SAMPLE_APP_USER}.{admin}` / `${SAMPLE_APP_PASS}.{admin}`, which Dirigible
  expands from its own environment (falling back to `admin`).
  Clients of the proxy don't see these credentials; they hit the proxy and
  Dirigible attaches `Authorization: Basic ...` outbound.
- Only `/rest/api/v1` is whitelisted via `security.exposedPaths`; anything else
  through the proxy answers `404`. The whitelist requires the **`library-admin`**
  role (defined in `roles.roles` and registered by Dirigible's role
  synchronizer), so callers must be assigned that role — `403` otherwise.

---

## REST API

Base path: **`/rest/api/v1`** • All endpoints require HTTP Basic auth.

The Swagger UI at `/docs` (also behind auth) is the authoritative, interactive
reference. The summary below mirrors what's in the OpenAPI document.

### Book resource

| Field           | Type             | Notes                                                              |
| --------------- | ---------------- | ------------------------------------------------------------------ |
| `id`            | `string` (UUID)  | Server-assigned, immutable.                                        |
| `title`         | `string`         | Required, 1–500 chars, trimmed.                                    |
| `author`        | `string`         | Required, 1–500 chars, trimmed.                                    |
| `isbn`          | `string` *opt.*  | ISBN-10 or ISBN-13. Hyphens/spaces stripped before validation.     |
| `publishedYear` | `integer` *opt.* | `-3000 ≤ year ≤ currentYear + 5`.                                  |
| `genre`         | `string` *opt.*  | Free-form, 1–500 chars.                                            |
| `available`     | `boolean`        | Defaults to `true` on create.                                      |
| `createdAt`     | `string` (ISO-8601) | Server-assigned, immutable.                                     |
| `updatedAt`     | `string` (ISO-8601) | Updated on every write.                                         |

ISBN uniqueness is enforced across the collection — a duplicate ISBN returns
`409 Conflict`.

### Endpoints

| Method   | Path                  | Status (success) | Description                                |
| -------- | --------------------- | ---------------- | ------------------------------------------ |
| `GET`    | `/books`              | `200 OK`         | List books (paginated, filterable).        |
| `POST`   | `/books`              | `201 Created`    | Create a book. `Location` header points to the new resource. |
| `GET`    | `/books/{id}`         | `200 OK`         | Fetch a single book.                       |
| `PUT`    | `/books/{id}`         | `200 OK`         | Replace a book (full representation).      |
| `PATCH`  | `/books/{id}`         | `200 OK`         | Partial update — send only the fields you want to change. |
| `DELETE` | `/books/{id}`         | `204 No Content` | Delete a book.                             |
| `GET`    | `/library`            | `200 OK`         | Read-only library info (address, phone). Defaults from env. |

### Library resource

A read-only singleton describing the library itself. Both fields are optional
from the environment's perspective — defaults are applied by the Zod schema if
the matching env var is unset.

| Field         | Type     | Default                        | Source env var      |
| ------------- | -------- | ------------------------------ | ------------------- |
| `address`     | `string` | `123 Library Lane, Booktown`   | `LIBRARY_ADDRESS`   |
| `phoneNumber` | `string` | `+1-555-0100`                  | `LIBRARY_PHONE`     |

```bash
curl -u admin:admin http://localhost:8080/rest/api/v1/library
# => {"address":"123 Library Lane, Booktown","phoneNumber":"+1-555-0100"}
```

### Listing — query parameters

| Param       | Default | Description                                                  |
| ----------- | ------- | ------------------------------------------------------------ |
| `offset`    | `0`     | Records to skip. Non-negative integer.                       |
| `limit`     | `50`    | Page size, `1 ≤ limit ≤ 200`.                                |
| `author`    | —       | Case-insensitive substring match on `author`.                |
| `genre`     | —       | Case-insensitive exact match on `genre`.                     |
| `available` | —       | `true` or `false`.                                           |

Response envelope:

```jsonc
{
  "total": 42,
  "offset": 0,
  "limit": 50,
  "items": [ /* book objects */ ]
}
```

### Error responses

All errors share one envelope:

```json
{ "error": { "status": 400, "message": "Request validation failed", "details": [] } }
```

| Status                  | When                                                              |
| ----------------------- | ----------------------------------------------------------------- |
| `400 Bad Request`       | Malformed JSON, schema validation failure, unknown fields, bad query. |
| `401 Unauthorized`      | Missing or invalid HTTP Basic credentials. Response includes `WWW-Authenticate: Basic`. |
| `404 Not Found`         | No route matches, or the book id does not exist.                  |
| `409 Conflict`          | Uniqueness violation (currently: duplicate `isbn`).               |
| `500 Internal Server Error` | Unexpected failure (logged with stack trace).                 |

---

## Worked example

```bash
# Create
curl -i -u admin:admin -H 'Content-Type: application/json' \
  -X POST http://localhost:8080/rest/api/v1/books \
  -d '{
        "title": "Domain-Driven Design",
        "author": "Eric Evans",
        "isbn": "978-0321125217",
        "publishedYear": 2003,
        "genre": "Software"
      }'
# HTTP/1.1 201 Created
# Location: /rest/api/v1/books/c00f4b14-f4d7-41f0-a871-dcfe8d40eb64

# List
curl -u admin:admin http://localhost:8080/rest/api/v1/books

# Fetch one
curl -u admin:admin http://localhost:8080/rest/api/v1/books/c00f4b14-f4d7-41f0-a871-dcfe8d40eb64

# Partial update — mark as checked-out
curl -u admin:admin -H 'Content-Type: application/json' \
  -X PATCH http://localhost:8080/rest/api/v1/books/c00f4b14-f4d7-41f0-a871-dcfe8d40eb64 \
  -d '{"available": false}'

# Replace
curl -u admin:admin -H 'Content-Type: application/json' \
  -X PUT http://localhost:8080/rest/api/v1/books/c00f4b14-f4d7-41f0-a871-dcfe8d40eb64 \
  -d '{"title":"Domain-Driven Design, Reference","author":"Eric Evans"}'

# Delete
curl -i -u admin:admin -X DELETE \
  http://localhost:8080/rest/api/v1/books/c00f4b14-f4d7-41f0-a871-dcfe8d40eb64
# HTTP/1.1 204 No Content
```

---

## Project layout

```
.
├── src/
│   ├── server.ts                # Entry point: loads config, builds app, listens, handles shutdown.
│   ├── app.ts                   # Fastify factory — wires Zod type provider, swagger, auth, routes, error handler.
│   ├── config.ts                # Zod-validated environment configuration.
│   ├── errors.ts                # HttpError class + helpers.
│   ├── plugins/
│   │   └── auth.ts              # @fastify/basic-auth registration + global onRequest hook.
│   ├── routes/
│   │   └── books.ts             # Books routes with Zod schemas on every request/response.
│   ├── schemas/
│   │   └── book.ts              # Zod schemas (create/replace/patch/list/response) + inferred TS types.
│   └── services/
│       └── bookStore.ts         # In-memory Map-backed store + ISBN uniqueness index.
├── test/
│   ├── helpers.ts               # Boots an isolated Fastify app on an ephemeral port.
│   └── books.test.ts            # Vitest suite (19 cases) using fastify.inject().
├── dist/                        # Compiled JS output (created by `npm run build`).
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .env.example
├── LICENSE                      # Eclipse Public License 2.0
└── README.md
```

---

## Dependencies — and why

Runtime:

| Package                       | Purpose                                                            |
| ----------------------------- | ------------------------------------------------------------------ |
| `fastify`                     | The HTTP server. Mature, schema-first, faster than alternatives, first-class TypeScript support. |
| `@fastify/basic-auth`         | Official Fastify plugin for HTTP Basic — used for the password check. |
| `@fastify/swagger`            | Generates an OpenAPI 3 document from the route schemas.            |
| `@fastify/swagger-ui`         | Serves the Swagger UI under `/docs`.                               |
| `fastify-type-provider-zod`   | Wires Zod schemas into Fastify so requests/responses get validated and TypeScript types are inferred in handlers. |
| `zod`                         | Runtime + type-level schema validation. Single source of truth for the Book shape. |
| `dotenv`                      | Loads `.env` files into `process.env` during development.          |

Dev:

| Package          | Purpose                                                                |
| ---------------- | ---------------------------------------------------------------------- |
| `typescript`     | The compiler.                                                          |
| `tsx`            | Runs `.ts` directly during development (`npm run dev`).                |
| `vitest`         | Test runner. Native ESM/TS, fast, modern API.                          |
| `@types/node`    | Node.js type declarations.                                             |

---

## Design notes

- **Schemas are the contract.** Each route declares Zod schemas for its
  body / query / params / response. The Zod type provider:
  1. **validates** incoming requests at the edge (returning a structured 400
     with field-level details on failure), and
  2. **types** `req.body` / `req.query` / `req.params` inside the handler so
     they're fully typed, no manual casts.
  3. feeds **`@fastify/swagger`** to produce the OpenAPI document.

- **Auth is global.** `@fastify/basic-auth` is registered as a Fastify plugin
  and applied as an `onRequest` hook at the root, so every route — including
  `/docs` and `/docs/json` — requires credentials. Comparisons use
  `crypto.timingSafeEqual` against equal-length buffers.

- **Error handling is centralised.** `setErrorHandler` runs *before* routes
  register (Fastify v5 binds the handler at route-registration time) and maps:
  - Zod validation errors → `400` with field-level `details`.
  - `HttpError` (thrown by the store) → its status code with structured body.
  - Other errors with a 4xx `statusCode` (e.g. `@fastify/basic-auth`) → that
    status, preserving the `WWW-Authenticate` header on 401.
  - Anything else → `500` plus a logged stack trace.

- **In-memory store** lives in `src/services/bookStore.ts`. Books are stored
  in a `Map<id, Book>` with an auxiliary `Map<isbn, id>` for the uniqueness
  check. Everything is lost on restart — intentional.

- **Tests use `app.inject()`** (Fastify's built-in in-process HTTP simulator)
  rather than a real listening socket. This avoids port management, is faster,
  and matches the recommended Fastify testing pattern.

---

## License

Licensed under the **Eclipse Public License 2.0**. See [`LICENSE`](./LICENSE).
