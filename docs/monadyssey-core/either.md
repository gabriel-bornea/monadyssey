# Either

`Either<A, B>` represents a value that is one of two types: `Left<A>` (typically an error or alternative) or `Right<B>` (typically the success value). By convention, `Right` is the "correct" path.

Unlike `IO`, `Either` is not lazy — it holds a value immediately. Use it for synchronous computations where you want to model success/failure without side effects.

```typescript
import { Either, Left, Right } from "monadyssey";
```

---

## Table of Contents

- [Creating an Either](#creating-an-either)
- [Transforming Values](#transforming-values)
- [Error Handling](#error-handling)
- [Extracting Values](#extracting-values)
- [Side Effects](#side-effects)

---

## Creating an Either

### `Right.pure`

Wraps a value in the success channel.

```typescript
static pure<B>(value: B): Right<B>
```

```typescript
const result = Right.pure(42);
```

---

### `Left.pure`

Wraps a value in the error/alternative channel.

```typescript
static pure<A>(value: A): Left<A>
```

```typescript
const result = Left.pure("not found");
```

---

### `Either.catch`

Runs a function and wraps the result in `Right`. If it throws, catches the exception and wraps it in `Left`.

```typescript
// With string error
static catch<B>(fn: () => B): Either<string, B>

// With custom error transformation
static catch<A, B>(fn: () => B, liftE: (e: unknown) => A): Either<A, B>
```

```typescript
const result = Either.catch(() => JSON.parse(input));
// Right(parsed) or Left("Unexpected token ...")

const result = Either.catch(
  () => JSON.parse(input),
  (e) => new ParseError(String(e))
);
```

---

## Transforming Values

### `map`

Transforms the `Right` value. If this is a `Left`, the function is not called.

```typescript
map<C>(f: (right: B) => C): Either<A, C>
```

```typescript
const result = Right.pure(21).map(n => n * 2);
// Right(42)
```

---

### `mapLeft`

Transforms the `Left` value. If this is a `Right`, the function is not called.

```typescript
mapLeft<C>(f: (left: A) => C): Either<C, B>
```

```typescript
const result = Left.pure("err").mapLeft(e => `Error: ${e}`);
// Left("Error: err")
```

---

### `flatMap`

Chains a dependent computation on the `Right` value. The function must return an `Either`.

```typescript
flatMap<C>(f: (right: B) => Either<A, C>): Either<A, C>
```

```typescript
const result = Right.pure("42")
  .flatMap(s => {
    const n = parseInt(s);
    return isNaN(n) ? Left.pure("not a number") : Right.pure(n);
  });
```

---

### `swap`

Exchanges the `Left` and `Right` values.

```typescript
swap(): Either<B, A>
```

```typescript
Right.pure(42).swap();  // Left(42)
Left.pure("err").swap(); // Right("err")
```

---

## Error Handling

### `fold`

Applies one of two functions depending on whether this is a `Left` or `Right`.

```typescript
fold<C>(ifLeft: (left: A) => C, ifRight: (right: B) => C): C
```

```typescript
const message = result.fold(
  err => `Failed: ${err}`,
  val => `Got: ${val}`
);
```

---

## Extracting Values

### `getOrElse`

Returns the `Right` value, or applies a function to the `Left` value to produce a default.

```typescript
getOrElse(value: (left: A) => B): B
```

```typescript
const value = Left.pure("err").getOrElse(e => 0); // 0
const value = Right.pure(42).getOrElse(e => 0);   // 42
```

---

### `getOrNull`

Returns the `Right` value, or `null` if this is a `Left`.

```typescript
getOrNull(): B | null
```

---

## Side Effects

### `tap`

Runs a side effect on the `Right` value without changing the result.

```typescript
tap(action: (right: B) => void): Either<A, B>
```

```typescript
const result = Right.pure(42).tap(v => console.log("Got:", v));
// logs "Got: 42", returns Right(42)
```

---

### `tapLeft`

Runs a side effect on the `Left` value without changing the result.

```typescript
tapLeft(action: (left: A) => void): Either<A, B>
```

```typescript
const result = Left.pure("err").tapLeft(e => console.error(e));
// logs "err", returns Left("err")
```
