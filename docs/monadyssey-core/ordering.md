# Ordering

`Ordering` represents the result of comparing two values. It has exactly three possible values: `LessThan`, `Equal`, and `GreaterThan`.

Inspired by Haskell's `Ordering` data type and its `Semigroup` instance. The `concat` method implements lexicographic composition (equivalent to Haskell's `<>` on `Ordering`), and `compareBy` generalizes the `comparing f1 <> comparing f2` pattern.

```typescript
import { Ordering, LT, EQ, GT } from "monadyssey";
```

---

## Table of Contents

- [Instances](#instances)
- [Properties](#properties)
- [Creating an Ordering](#creating-an-ordering)
- [Pattern Matching](#pattern-matching)
- [Composition](#composition)
- [Reversing](#reversing)
- [Side Effects](#side-effects)
- [Building Comparators](#building-comparators)

---

## Instances

Three singleton values, available as both static properties and top-level aliases:

| Static property | Alias | Value | Meaning |
|---|---|---|---|
| `Ordering.LessThan` | `LT` | `-1` | First value is less than second |
| `Ordering.Equal` | `EQ` | `0` | Values are equal |
| `Ordering.GreaterThan` | `GT` | `1` | First value is greater than second |

```typescript
Ordering.LessThan === LT; // true
Ordering.Equal === EQ;     // true
Ordering.GreaterThan === GT; // true
```

The constructor is private — these three singletons are the only possible values.

---

## Properties

### `value`

The numeric value: `-1`, `0`, or `1`. Suitable for passing directly to `Array.sort`.

```typescript
readonly value: -1 | 0 | 1
```

```typescript
LT.value; // -1
EQ.value; // 0
GT.value; // 1
```

---

### `type`

A string tag: `"LessThan"`, `"Equal"`, or `"GreaterThan"`.

```typescript
readonly type: "LessThan" | "Equal" | "GreaterThan"
```

```typescript
LT.type; // "LessThan"
```

---

## Creating an Ordering

### `Ordering.from`

Converts a numeric comparison result to an `Ordering`. Throws if the input is `NaN`.

```typescript
static from(num: number): Ordering
```

```typescript
Ordering.from(5 - 10);  // LT
Ordering.from(10 - 10); // EQ
Ordering.from(10 - 5);  // GT

Ordering.from(NaN); // throws Error
```

---

## Pattern Matching

### `match`

Executes one of three functions depending on the `Ordering` value. Compensates for TypeScript not having algebraic data type pattern matching.

```typescript
match<B>(onLessThan: () => B, onEqual: () => B, onGreaterThan: () => B): B
```

```typescript
const result = Ordering.from(a - b).match(
  () => "a < b",
  () => "a = b",
  () => "a > b"
);
```

---

## Composition

### `concat`

Returns `this` if it is not `Equal`, otherwise returns `other`. This is the Semigroup operation on `Ordering` — equivalent to Haskell's `<>` on `Ordering`.

```typescript
concat(other: Ordering): Ordering
```

```typescript
LT.concat(GT); // LT  (first non-Equal wins)
EQ.concat(GT); // GT  (fall through to second)
EQ.concat(EQ); // EQ  (both equal)
```

Use `concat` to compose multiple comparisons lexicographically:

```typescript
const compareByLength = (a: string, b: string) =>
  Ordering.from(a.length - b.length);

const compareAlpha = (a: string, b: string) =>
  Ordering.from(a.localeCompare(b));

// Sort by length first, then alphabetically for ties
const compare = (a: string, b: string) =>
  compareByLength(a, b).concat(compareAlpha(a, b));
```

---

### `flatMap`

If `this` is `Equal`, evaluates `f()` and returns its result. Otherwise returns `this` unchanged. Useful for lazily chaining comparisons — `f` is not called unless needed.

```typescript
flatMap(f: () => Ordering): Ordering
```

```typescript
Ordering.from(user1.name.localeCompare(user2.name))
  .flatMap(() => Ordering.from(user1.age - user2.age));
```

The difference from `concat`: `flatMap` takes a function (lazy), `concat` takes a value (eager). Use `flatMap` when the second comparison is expensive and should be skipped if the first is already decisive.

---

## Reversing

### `reverse`

Swaps `LessThan` and `GreaterThan`. `Equal` remains `Equal`. Equivalent to Haskell's `Down` newtype.

```typescript
reverse(): Ordering
```

```typescript
LT.reverse(); // GT
EQ.reverse(); // EQ
GT.reverse(); // LT
```

Use for descending sort:

```typescript
[3, 1, 4, 1, 5].sort((a, b) => Ordering.from(a - b).reverse().value);
// [5, 4, 3, 1, 1]
```

---

## Side Effects

### `tap`

Executes a side effect and returns `this` unchanged. Useful for debugging in a method chain.

```typescript
tap(f: (ordering: Ordering) => void): Ordering
```

```typescript
Ordering.from(a - b)
  .tap(o => console.log(`comparison: ${o.type}`))
  .reverse();
```

---

## Building Comparators

### `Ordering.comparing`

Creates a comparator function that extracts a key from each item and compares the keys numerically. Equivalent to Haskell's `comparing` from `Data.Ord`.

```typescript
static comparing<A, B>(
  selector: (item: A) => B,
  comparator: (a: B, b: B) => number
): (a: A, b: A) => Ordering
```

```typescript
interface User { name: string; age: number }

const compareByAge = Ordering.comparing<User, number>(
  u => u.age,
  (a, b) => a - b
);

const compareByName = Ordering.comparing<User, string>(
  u => u.name,
  (a, b) => a.localeCompare(b)
);
```

The returned function can be passed to `NonEmptyList.sort` or used with `Array.sort` via `.value`:

```typescript
users.sort((a, b) => compareByAge(a, b).value);
```

Throws if the comparator returns `NaN`.

---

### `Ordering.compareBy`

Composes multiple comparator functions into one. Applies each in order, returning the first non-`Equal` result. If all return `Equal`, returns `Equal`. This is the variadic form of Haskell's `comparing f1 <> comparing f2 <> ...` pattern, and equivalent to Cats' `Order.whenEqual`.

```typescript
static compareBy<A>(
  ...comparators: Array<(a: A, b: A) => Ordering>
): (a: A, b: A) => Ordering
```

```typescript
const userComparator = Ordering.compareBy<User>(
  compareByAge,
  compareByName
);

// Sort by age, then by name for same-aged users
users.sort((a, b) => userComparator(a, b).value);
```

Works with `NonEmptyList.sort`:

```typescript
const sorted = nel.sort(
  Ordering.compareBy(
    Ordering.comparing(u => u.age, (a, b) => a - b),
    Ordering.comparing(u => u.name, (a, b) => a.localeCompare(b))
  )
);
```
