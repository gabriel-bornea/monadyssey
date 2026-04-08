# Eval

`Eval<A>` represents a deferred computation that produces a value of type `A`. It controls **when** and **how often** a computation runs:

- `Eval.now(value)` — already computed, returns immediately
- `Eval.defer(f)` — re-evaluates every time
- `Eval.lazy(f)` — evaluates once, caches the result

All three support `map` and `flatMap` for composition. The `evaluate()` method uses a trampoline interpreter with an explicit stack, so arbitrarily deep chains are stack-safe.

```typescript
import { Eval } from "monadyssey";
```

---

## Table of Contents

- [Creating an Eval](#creating-an-eval)
- [Transforming Values](#transforming-values)
- [Running](#running)

---

## Creating an Eval

### `Eval.now`

Wraps an already-computed value. No deferred computation takes place.

```typescript
static now<A>(value: A): Eval<A>
```

```typescript
const effect = Eval.now(42);
effect.evaluate(); // 42
```

---

### `Eval.defer`

Wraps a function that is called every time `evaluate()` runs. The computation is never cached.

```typescript
static defer<A>(f: () => A): Eval<A>
```

```typescript
let counter = 0;
const effect = Eval.defer(() => ++counter);

effect.evaluate(); // 1
effect.evaluate(); // 2
effect.evaluate(); // 3
```

---

### `Eval.lazy`

Wraps a function that is called at most once. The result is cached after the first `evaluate()`.

```typescript
static lazy<A>(f: () => A): Eval<A>
```

```typescript
let counter = 0;
const effect = Eval.lazy(() => {
  counter++;
  return expensiveComputation();
});

effect.evaluate(); // computes, counter = 1
effect.evaluate(); // cached, counter still = 1
```

---

## Transforming Values

### `map`

Transforms the result of the computation. The transformation is deferred — it only runs when `evaluate()` is called.

```typescript
map<B>(f: (a: A) => B): Eval<B>
```

```typescript
const effect = Eval.now(21).map(n => n * 2);
effect.evaluate(); // 42
```

Consecutive `map` calls are fused into a single pass during evaluation.

---

### `flatMap`

Chains a dependent computation. The function receives the result and returns a new `Eval`.

```typescript
flatMap<B>(f: (a: A) => Eval<B>): Eval<B>
```

```typescript
const effect = Eval.now(2).flatMap(a =>
  Eval.now(3).map(b => a + b)
);
effect.evaluate(); // 5
```

---

## Running

### `evaluate`

Runs the computation and returns the result. This is the only way to get a value out of an `Eval`.

```typescript
evaluate(): A
```

The interpreter uses an explicit stack (trampoline), so deep chains do not overflow:

```typescript
let effect: Eval<number> = Eval.now(0);
for (let i = 0; i < 1_000_000; i++) {
  effect = effect.flatMap(n => Eval.now(n + 1));
}
effect.evaluate(); // 1000000 — no stack overflow
```

### Error behavior

If a function passed to `defer`, `lazy`, `map`, or `flatMap` throws, the exception propagates out of `evaluate()`:

```typescript
const effect = Eval.defer(() => { throw new Error("boom"); });
effect.evaluate(); // throws Error("boom")
```

For `lazy`, a thrown exception does **not** cache — the next `evaluate()` call will retry the computation.
