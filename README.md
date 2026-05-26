# sample-library-native-app-nodejs

A small **library-management REST service** built entirely on the **Node.js
standard library** — no Express, no Fastify, no runtime dependencies at all.
The single source-of-truth is an in-process `Map`, the HTTP layer is
`node:http`, the tests use `node:test`, and authentication is plain
RFC 7617 HTTP Basic.

It is intended as a reference for how a small, well-shaped REST service looks
when written with only what ships in the Node.js LTS runtime.

---

## Highlights

- **Zero runtime dependencies** — `package.json` has no `dependencies`.
- **Latest Node.js LTS** — requires Node `>= 22.0.0` (engines field is enforced
  by `npm`); ESM modules throughout.
- **REST best-practice surface** for a `Book` resource — proper status codes,
  `Location` header on create, `ETag`-friendly JSON, conditional validation,
  pagination envelope, content-type negotiation.
- **HTTP Basic authentication** with constant-time credential comparison and a
  `WWW-Authenticate` challenge on `401`.
- **Configurable port** (`PORT`, default `8080`) and credentials
  (`AUTH_USER` / `AUTH_PASSWORD`, default `admin` / `admin`).
- **Graceful shutdown** on `SIGINT` / `SIGTERM`.
- **19-case integration test suite** using `node:test`.

---

## Requirements

- Node.js **22.x LTS** or newer (`node --version` ≥ `v22.0.0`).
- `npm` (only used to invoke the npm scripts; no packages to install).

---

## Quick start

```bash
# Clone, then from the project root:
npm start
```

That's it — there is nothing to install because there are no dependencies.

The server prints the URL it bound to:

```
sample-library-native-app-nodejs listening on http://0.0.0.0:8080/rest/api/v1
```

Try it:

```bash
curl -u admin:admin http://localhost:8080/rest/api/v1/books
# => {"total":0,"offset":0,"limit":50,"items":[]}
```

---

## Configuration

All configuration is via environment variables. All values are optional.

| Variable        | Default   | Description                                     |
| --------------- | --------- | ----------------------------------------------- |
| `PORT`          | `8080`    | TCP port to listen on. `0` selects an ephemeral port (used by tests). |
| `HOST`          | `0.0.0.0` | Interface to bind to.                           |
| `AUTH_USER`     | `admin`   | Username accepted by HTTP Basic auth.           |
| `AUTH_PASSWORD` | `admin`   | Password accepted by HTTP Basic auth.           |

Example:

```bash
PORT=9090 AUTH_USER=alice AUTH_PASSWORD='s3cret!' npm start
```

> **Security note.** The default credentials (`admin` / `admin`) are for local
> experimentation only. Override `AUTH_USER` and `AUTH_PASSWORD` for any
> deployment beyond your laptop, and put the service behind TLS — HTTP Basic
> sends credentials in clear text after base64-encoding.

---

## Scripts

| Command          | What it does                                                       |
| ---------------- | ------------------------------------------------------------------ |
| `npm start`      | Boot the server with `node src/server.js`.                         |
| `npm run dev`    | Same as `start`, but with `--watch` for auto-restart on edits.     |
| `npm test`       | Run the `node:test` integration suite with the spec reporter.      |

---

## REST API

Base path: **`/rest/api/v1`**

The only resource exposed is `books`. All endpoints require HTTP Basic
authentication.

### Book resource

| Field           | Type             | Notes                                                              |
| --------------- | ---------------- | ------------------------------------------------------------------ |
| `id`            | `string` (UUID)  | Server-assigned. Stable for the lifetime of the resource.          |
| `title`         | `string`         | Required, 1–500 chars, trimmed.                                    |
| `author`        | `string`         | Required, 1–500 chars, trimmed.                                    |
| `isbn`          | `string` *opt.*  | ISBN-10 or ISBN-13. Hyphens/spaces are stripped before validation. |
| `publishedYear` | `integer` *opt.* | `-3000 ≤ year ≤ currentYear + 5`.                                  |
| `genre`         | `string` *opt.*  | Free-form, 1–500 chars.                                            |
| `available`     | `boolean`        | Defaults to `true` on create.                                      |
| `createdAt`     | `string` (ISO-8601) | Server-assigned, immutable.                                     |
| `updatedAt`     | `string` (ISO-8601) | Updated on every write.                                         |

ISBN uniqueness is enforced across the collection — attempting to create or
update a book with an ISBN that is already in use returns `409 Conflict`.

### Endpoints

| Method   | Path                  | Status (success) | Description                                |
| -------- | --------------------- | ---------------- | ------------------------------------------ |
| `GET`    | `/books`              | `200 OK`         | List books (paginated, filterable).        |
| `POST`   | `/books`              | `201 Created`    | Create a book. `Location` header points to the new resource. |
| `GET`    | `/books/{id}`         | `200 OK`         | Fetch a single book.                       |
| `PUT`    | `/books/{id}`         | `200 OK`         | Replace a book (full representation).      |
| `PATCH`  | `/books/{id}`         | `200 OK`         | Partial update — send only the fields you want to change. |
| `DELETE` | `/books/{id}`         | `204 No Content` | Delete a book.                             |

### Listing — query parameters

| Param       | Default | Description                                                  |
| ----------- | ------- | ------------------------------------------------------------ |
| `offset`    | `0`     | Number of records to skip. Non-negative integer.             |
| `limit`     | `50`    | Page size, `1 ≤ limit ≤ 200`.                                |
| `author`    | —       | Case-insensitive substring match on `author`.                |
| `genre`     | —       | Case-insensitive exact match on `genre`.                     |
| `available` | —       | Filter by availability, `true` or `false`.                   |

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

All errors are returned as JSON:

```json
{ "error": { "status": 400, "message": "Field \"author\" is required" } }
```

| Status                  | When                                                              |
| ----------------------- | ----------------------------------------------------------------- |
| `400 Bad Request`       | Malformed JSON, missing/invalid fields, unknown fields, bad query. |
| `401 Unauthorized`      | Missing or invalid HTTP Basic credentials. Response includes `WWW-Authenticate: Basic`. |
| `404 Not Found`         | No route matches, or the book id does not exist.                  |
| `405 Method Not Allowed`| Method is not supported on the matched path.                      |
| `409 Conflict`          | Uniqueness violation (currently: duplicate `isbn`).               |
| `415 Unsupported Media Type` | Request has a body with a non-`application/json` content-type. |
| `500 Internal Server Error` | Unexpected server failure (logged with stack trace).          |

---

## Worked example

```bash
# Create a book
curl -i -u admin:admin -H 'Content-Type: application/json' \
  -X POST http://localhost:8080/rest/api/v1/books \
  -d '{
        "title": "The Pragmatic Programmer",
        "author": "David Thomas, Andy Hunt",
        "isbn": "978-0135957059",
        "publishedYear": 2019,
        "genre": "Software"
      }'
# HTTP/1.1 201 Created
# Location: /rest/api/v1/books/dcb51372-c3d4-4fbf-b8af-137fe7f37fa6
# { "id": "dcb51372-...", "title": "The Pragmatic Programmer", ... }

# List
curl -u admin:admin http://localhost:8080/rest/api/v1/books

# Fetch one
curl -u admin:admin http://localhost:8080/rest/api/v1/books/dcb51372-c3d4-4fbf-b8af-137fe7f37fa6

# Partial update — mark as checked-out
curl -u admin:admin -H 'Content-Type: application/json' \
  -X PATCH http://localhost:8080/rest/api/v1/books/dcb51372-c3d4-4fbf-b8af-137fe7f37fa6 \
  -d '{"available": false}'

# Replace
curl -u admin:admin -H 'Content-Type: application/json' \
  -X PUT http://localhost:8080/rest/api/v1/books/dcb51372-c3d4-4fbf-b8af-137fe7f37fa6 \
  -d '{"title":"The Pragmatic Programmer, 20th Anniv. Ed.","author":"David Thomas"}'

# Delete
curl -i -u admin:admin -X DELETE \
  http://localhost:8080/rest/api/v1/books/dcb51372-c3d4-4fbf-b8af-137fe7f37fa6
# HTTP/1.1 204 No Content
```

---

## Project layout

```
.
├── src/
│   ├── server.js         # Entry point: loads config, starts server, handles shutdown.
│   ├── app.js            # Wires store + router + auth into an http.Server.
│   ├── config.js         # Env-driven configuration with validation.
│   ├── auth.js           # HTTP Basic auth, constant-time compare.
│   ├── router.js         # Path/method dispatch for /rest/api/v1/books.
│   ├── http.js           # JSON body parsing, response helpers, error helpers.
│   ├── errors.js         # HttpError class and constructors for common codes.
│   ├── validation.js     # Field-by-field validation for the Book resource.
│   ├── store.js          # In-memory Map + ISBN uniqueness index.
│   └── handlers/
│       └── books.js      # Per-endpoint handler functions.
├── test/
│   ├── helpers.js        # Boots an isolated server on an ephemeral port.
│   └── books.test.js     # node:test integration suite (19 cases).
├── package.json
├── LICENSE               # Eclipse Public License 2.0
└── README.md
```

---

## Design notes

- **Native `node:http` only.** Routing is a small `switch` over
  `(method, pathname)` in `src/router.js`. There is no middleware stack —
  authentication, error mapping, and logging happen directly in
  `src/app.js`. The whole thing is ~300 lines.
- **In-memory store** lives in `src/store.js`. Books are stored in a
  `Map<id, Book>` with an auxiliary `Map<isbn, id>` for the uniqueness
  check. Everything is lost on restart — this is intentional.
- **Validation is explicit** in `src/validation.js`: required fields,
  type checks, length bounds, ISBN normalization, year range. Unknown
  fields are rejected so typos surface as `400` instead of silent no-ops.
- **`HttpError`** carries a status code and optional structured details;
  the central catch in `src/app.js` translates it into a JSON error
  response. Unknown errors become `500` and are logged with the full
  stack.
- **Auth comparisons** use `crypto.timingSafeEqual` against equal-length
  buffers to avoid leaking credential length or content via timing.
- **Tests** spin up the full HTTP server on an ephemeral port (`PORT=0`)
  and exercise the API via `fetch` — they cover the happy path, every
  error class, and the auth challenge headers.

---

## License

Licensed under the **Eclipse Public License 2.0**. See [`LICENSE`](./LICENSE).
