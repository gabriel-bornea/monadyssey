# NonEmptyList

`NonEmptyList<A>` is a list that is guaranteed to contain at least one element. This guarantee is enforced at construction time — there is no way to create an empty `NonEmptyList`.

This makes it useful anywhere you need to ensure a collection is non-empty by construction, rather than checking at runtime. IO uses it for collecting errors in parallel combinators (`parMapN`, `parTraverse`, `race`).

```typescript
import { NonEmptyList } from "monadyssey";
```

---

## Table of Contents

- [Creating a NonEmptyList](#creating-a-nonemptylist)
- [Accessing Elements](#accessing-elements)
- [Transforming](#transforming)
- [Folding](#folding)
- [Querying](#querying)
- [Filtering](#filtering)
- [Building](#building)
- [Searching](#searching)
- [Sorting](#sorting)

---

## Creating a NonEmptyList

### Constructor

Creates a NonEmptyList from a head element and a tail array.

```typescript
constructor(public readonly head: A, public readonly tail: A[])
```

```typescript
const list = new NonEmptyList(1, [2, 3]);
// [1, 2, 3]
```

---

### `NonEmptyList.pure`

Creates a NonEmptyList containing a single element.

```typescript
static pure<A>(value: A): NonEmptyList<A>
```

```typescript
const list = NonEmptyList.pure(42);
list.head;      // 42
list.toArray(); // [42]
```

---

### `NonEmptyList.fromArray`

Creates a NonEmptyList from an array. Throws if the array is null, undefined, or empty.

```typescript
static fromArray<A>(value: A[]): NonEmptyList<A>
```

```typescript
const list = NonEmptyList.fromArray([1, 2, 3]);

NonEmptyList.fromArray([]); // throws Error
```

---

## Accessing Elements

### `head`

The first element. Always exists.

```typescript
const list = NonEmptyList.fromArray([10, 20, 30]);
list.head; // 10
```

---

### `last`

The last element.

```typescript
get last(): A
```

```typescript
NonEmptyList.fromArray([10, 20, 30]).last; // 30
NonEmptyList.pure(42).last;               // 42
```

---

### `get`

Retrieves an element by zero-based index. Throws if the index is out of bounds. Accesses head and tail directly without intermediate array allocation.

```typescript
get(index: number): A
```

```typescript
const list = NonEmptyList.fromArray([10, 20, 30]);
list.get(0); // 10
list.get(1); // 20
list.get(5); // throws Error
```

---

### `size`

The total number of elements.

```typescript
get size(): number
```

```typescript
NonEmptyList.fromArray([10, 20, 30]).size; // 3
```

---

### `toArray`

Returns all elements as a plain array.

```typescript
toArray(): A[]
```

```typescript
NonEmptyList.fromArray([10, 20, 30]).toArray(); // [10, 20, 30]
```

---

### `init`

Returns all elements except the last, as a plain array. Dual of `tail`.

```typescript
get init(): A[]
```

```typescript
NonEmptyList.fromArray([1, 2, 3]).init; // [1, 2]
NonEmptyList.pure(42).init;             // []
```

---

## Transforming

### `map`

Applies a function to each element, producing a new NonEmptyList. Operates on head and tail directly without intermediate array allocation.

```typescript
map<B>(f: (value: A) => B): NonEmptyList<B>
```

```typescript
NonEmptyList.fromArray([1, 2, 3]).map(n => n * 2);
// NonEmptyList [2, 4, 6]
```

---

### `flatMap`

Applies a function that returns a NonEmptyList to each element, then flattens the results into a single NonEmptyList.

```typescript
flatMap<B>(f: (value: A) => NonEmptyList<B>): NonEmptyList<B>
```

```typescript
NonEmptyList.fromArray([1, 2]).flatMap(n =>
  new NonEmptyList(n, [n * 10])
);
// NonEmptyList [1, 10, 2, 20]
```

---

### `traverse`

Applies an async function to each element, collecting results into a NonEmptyList.

```typescript
async traverse<B>(f: (value: A) => Promise<B>): Promise<NonEmptyList<B>>
```

```typescript
const result = await NonEmptyList.fromArray([1, 2, 3])
  .traverse(async n => n * 2);
// NonEmptyList [2, 4, 6]
```

---

### `reverse`

Returns a new NonEmptyList with elements in reverse order.

```typescript
reverse(): NonEmptyList<A>
```

```typescript
NonEmptyList.fromArray([1, 2, 3]).reverse();
// NonEmptyList [3, 2, 1]
```

---

## Folding

### `foldLeft`

Reduces elements from left to right using an accumulator.

```typescript
foldLeft<B>(start: B, f: (accumulator: B, value: A) => B): B
```

```typescript
NonEmptyList.fromArray([1, 2, 3]).foldLeft(0, (acc, n) => acc + n);
// 6
```

---

### `foldRight`

Reduces elements from right to left using an accumulator.

```typescript
foldRight<B>(start: B, f: (value: A, accumulator: B) => B): B
```

```typescript
NonEmptyList.fromArray(["a", "b", "c"]).foldRight("", (s, acc) => acc + s);
// "cba"
```

---

### `reduce`

Reduces elements using a combining function, without requiring an initial value. This is safe because the list is guaranteed to be non-empty.

```typescript
reduce(f: (a: A, b: A) => A): A
```

```typescript
NonEmptyList.fromArray([1, 2, 3]).reduce((a, b) => a + b);
// 6

NonEmptyList.pure(42).reduce((a, b) => a + b);
// 42
```

This is the primary advantage of `NonEmptyList` over a plain array — `reduce` without an initial value is always safe.

---

## Querying

### `exists`

Returns `true` if at least one element satisfies the predicate.

```typescript
exists(predicate: (value: A) => boolean): boolean
```

```typescript
NonEmptyList.fromArray([1, 2, 3]).exists(n => n > 2); // true
NonEmptyList.fromArray([1, 2, 3]).exists(n => n > 5); // false
```

---

### `forall`

Returns `true` if all elements satisfy the predicate.

```typescript
forall(predicate: (value: A) => boolean): boolean
```

```typescript
NonEmptyList.fromArray([2, 4, 6]).forall(n => n % 2 === 0); // true
NonEmptyList.fromArray([2, 3, 6]).forall(n => n % 2 === 0); // false
```

---

## Filtering

### `filter`

Filters elements by a predicate. Returns a plain `A[]` because filtering may remove all elements, which would violate the non-empty guarantee.

```typescript
filter(f: (value: A) => boolean): A[]
```

```typescript
NonEmptyList.fromArray([1, 2, 3, 4]).filter(n => n > 2);
// [3, 4]

NonEmptyList.fromArray([1, 2]).filter(n => n > 10);
// []
```

---

## Building

### `append`

Adds an element to the end.

```typescript
append(element: A): NonEmptyList<A>
```

```typescript
NonEmptyList.fromArray([1, 2]).append(3);
// NonEmptyList [1, 2, 3]
```

---

### `prepend`

Adds an element to the beginning.

```typescript
prepend(element: A): NonEmptyList<A>
```

```typescript
NonEmptyList.fromArray([2, 3]).prepend(1);
// NonEmptyList [1, 2, 3]
```

---

### `concat`

Concatenates two NonEmptyLists.

```typescript
concat(other: NonEmptyList<A>): NonEmptyList<A>
```

```typescript
const a = NonEmptyList.fromArray([1, 2]);
const b = NonEmptyList.fromArray([3, 4]);
a.concat(b);
// NonEmptyList [1, 2, 3, 4]
```

---

## Searching

### `find`

Returns the first element matching a predicate, wrapped in an `Option`. Handles falsy values (`0`, `""`, `false`) correctly.

```typescript
find(predicate: (value: A) => boolean): Option<A>
```

```typescript
NonEmptyList.fromArray([1, 2, 3]).find(n => n > 1);
// Some(2)

NonEmptyList.fromArray([1, 2, 3]).find(n => n > 10);
// None

NonEmptyList.fromArray([0, 1, 2]).find(n => n === 0);
// Some(0)
```

---

## Sorting

### `sort`

Sorts elements using a comparator that returns an `Ordering`. Returns a new NonEmptyList.

```typescript
sort(comparator: (a: A, b: A) => Ordering): NonEmptyList<A>
```

```typescript
import { Ordering } from "monadyssey";

NonEmptyList.fromArray([3, 1, 2]).sort((a, b) =>
  a < b ? Ordering.LT : a > b ? Ordering.GT : Ordering.EQ
);
// NonEmptyList [1, 2, 3]
```

---

## `toString`

Returns a string representation of the list.

```typescript
toString(): string
```

```typescript
NonEmptyList.fromArray([1, 2, 3]).toString();
// "[1, 2, 3]"
```
