# Option

`Option<A>` represents a value that may or may not exist: `Some<A>` contains a value, `None` represents absence. It is a type-safe alternative to `null` and `undefined`.

`Some` enforces `NonNullable<A>` — you cannot create a `Some(null)` or `Some(undefined)`.

```typescript
import { Option, Some, None } from "monadyssey";
```

---

## Table of Contents

- [Creating an Option](#creating-an-option)
- [Transforming Values](#transforming-values)
- [Filtering](#filtering)
- [Extracting Values](#extracting-values)
- [Side Effects](#side-effects)

---

## Creating an Option

### `Some.pure`

Wraps a non-null, non-undefined value.

```typescript
static pure<A>(value: NonNullable<A>): Some<NonNullable<A>>
```

```typescript
const option = Some.pure(42);
```

---

### `None.Instance`

The singleton empty Option.

```typescript
static get Instance(): None
```

```typescript
const option = None.Instance;
```

---

### `Option.ofNullable`

Creates an Option from a value that may be `null` or `undefined`. Returns `Some` if the value exists, `None` otherwise.

```typescript
static ofNullable<A>(value: A | null | undefined): Option<NonNullable<A>>
```

```typescript
Option.ofNullable("hello"); // Some("hello")
Option.ofNullable(null);    // None
Option.ofNullable(undefined); // None
```

---

## Transforming Values

### `map`

Transforms the value inside `Some`. If this is `None`, the function is not called.

```typescript
map<B>(f: (value: A) => B): Option<B>
```

```typescript
Some.pure(21).map(n => n * 2); // Some(42)
None.Instance.map(n => n * 2); // None
```

---

### `flatMap`

Chains a computation that returns an Option. Use this when the transformation itself may produce an empty result.

```typescript
flatMap<B>(f: (value: A) => Option<B>): Option<B>
```

```typescript
const result = Some.pure("42").flatMap(s => {
  const n = parseInt(s);
  return isNaN(n) ? None.Instance : Some.pure(n);
});
```

---

## Filtering

### `filter`

Returns this Option if it is `Some` and the predicate returns `true`. Otherwise returns `None`.

```typescript
filter(predicate: (value: A) => boolean): Option<A>
```

```typescript
Some.pure(42).filter(n => n > 0);  // Some(42)
Some.pure(-1).filter(n => n > 0);  // None
```

---

## Extracting Values

### `fold`

Applies one of two functions depending on whether this is `None` or `Some`.

```typescript
fold<B>(ifNone: () => B, ifSome: (value: A) => B): B
```

```typescript
const message = option.fold(
  () => "nothing here",
  val => `Got: ${val}`
);
```

---

### `getOrElse`

Returns the value if `Some`, or evaluates a default if `None`.

```typescript
getOrElse(defaultValue: () => A): A
```

```typescript
Some.pure(42).getOrElse(() => 0); // 42
None.Instance.getOrElse(() => 0); // 0
```

---

### `getOrNull`

Returns the value if `Some`, or `null` if `None`.

```typescript
getOrNull(): A | null
```

---

## Side Effects

### `tap`

Runs a side effect on the value if `Some`. Does nothing for `None`. Returns the original Option unchanged.

```typescript
tap(f: (value: A) => void): Option<A>
```

```typescript
Some.pure(42).tap(v => console.log("Got:", v));
// logs "Got: 42", returns Some(42)
```

---

### `tapNone`

Runs a side effect if `None`. Does nothing for `Some`. Returns the original Option unchanged.

```typescript
tapNone(f: () => void): Option<A>
```

```typescript
None.Instance.tapNone(() => console.log("empty"));
// logs "empty", returns None
```
