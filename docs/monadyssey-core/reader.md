# Reader

`Reader<R, A>` represents a computation that depends on an environment of type `R` and produces a value of type `A`. It is a functional pattern for dependency injection — instead of passing dependencies through every function call, you describe the computation and provide the environment at the end.

```typescript
import { Reader } from "monadyssey";
```

---

## Table of Contents

- [Creating a Reader](#creating-a-reader)
- [Transforming Values](#transforming-values)
- [Combining Readers](#combining-readers)
- [Modifying the Environment](#modifying-the-environment)
- [Running](#running)

---

## Creating a Reader

### Constructor

Wraps a function that takes an environment and produces a value.

```typescript
new Reader<R, A>(f: (env: R) => A)
```

```typescript
type Config = { apiUrl: string; timeout: number };

const fetchUrl = new Reader<Config, string>(env => env.apiUrl);
```

---

### `Reader.pure`

Creates a Reader that ignores the environment and always returns the given value.

```typescript
static pure<R, A>(value: A): Reader<R, A>
```

```typescript
const constant = Reader.pure<Config, number>(42);
constant.run({ apiUrl: "...", timeout: 1000 }); // 42
```

---

### `Reader.ask`

Creates a Reader that returns the environment itself. Use this to access the environment inside a `flatMap` chain.

```typescript
static ask<R>(): Reader<R, R>
```

```typescript
const operation = Reader.ask<Config>().map(env => env.apiUrl);
operation.run({ apiUrl: "https://api.example.com", timeout: 1000 });
// "https://api.example.com"
```

---

## Transforming Values

### `map`

Transforms the result of the computation.

```typescript
map<B>(f: (a: A) => B): Reader<R, B>
```

```typescript
const operation = new Reader<Config, string>(env => env.apiUrl)
  .map(url => `${url}/users`);

operation.run({ apiUrl: "https://api.example.com", timeout: 1000 });
// "https://api.example.com/users"
```

---

### `flatMap`

Chains a dependent Reader computation. The function receives the result and returns a new Reader that will receive the same environment.

```typescript
flatMap<B>(f: (a: A) => Reader<R, B>): Reader<R, B>
```

```typescript
type Env = { baseUrl: string; token: string };

const operation = new Reader<Env, string>(env => env.baseUrl)
  .flatMap(url =>
    new Reader<Env, string>(env => `${url}/api?token=${env.token}`)
  );

operation.run({ baseUrl: "https://example.com", token: "abc" });
// "https://example.com/api?token=abc"
```

---

### `Reader.lift`

Lifts a plain function into the Reader context. Returns a function that takes a `Reader<R, A>` and produces a `Reader<R, B>`.

```typescript
static lift<R, A, B>(f: (a: A) => B): (ra: Reader<R, A>) => Reader<R, B>
```

```typescript
const double = Reader.lift<Config, number, number>(n => n * 2);
const base = new Reader<Config, number>(env => env.timeout);

double(base).run({ apiUrl: "...", timeout: 500 }); // 1000
```

---

## Combining Readers

### `Reader.parZip`

Combines multiple Readers into a single Reader that produces a tuple of their results. All Readers receive the same environment.

```typescript
static parZip<R, A extends any[]>(
  ...readers: { [K in keyof A]: Reader<R, A[K]> }
): Reader<R, A>
```

```typescript
type Env = { host: string; port: number; debug: boolean };

const operation = Reader.parZip(
  new Reader<Env, string>(env => env.host),
  new Reader<Env, number>(env => env.port),
  new Reader<Env, boolean>(env => env.debug)
);

operation.run({ host: "localhost", port: 8080, debug: true });
// ["localhost", 8080, true]
```

---

## Modifying the Environment

### `Reader.local`

Creates a new Reader that transforms the environment before passing it to the inner Reader. Use this to adapt a Reader that expects one environment shape to work with a different one.

```typescript
static local<R, A>(f: (env: R) => R, reader: Reader<R, A>): Reader<R, A>
```

```typescript
type Config = { apiUrl: string };

const fetchUrl = new Reader<Config, string>(env => env.apiUrl);

const withOverride = Reader.local<Config, string>(
  env => ({ ...env, apiUrl: "https://staging.example.com" }),
  fetchUrl
);

withOverride.run({ apiUrl: "https://prod.example.com" });
// "https://staging.example.com"
```

---

## Running

### `run`

Executes the Reader computation with the given environment and returns the result.

```typescript
run(env: R): A
```

```typescript
type Config = { dbUrl: string };

const operation = new Reader<Config, string>(env => env.dbUrl)
  .map(url => `Connecting to ${url}`);

const result = operation.run({ dbUrl: "postgres://localhost:5432/mydb" });
// "Connecting to postgres://localhost:5432/mydb"
```

`run` is the terminal operation for Reader — nothing executes until it is called.
