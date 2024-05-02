export function TODO(): never {
  throw new Error("Not implemented yet");
}

export function identity<A>(a: A) {
  return a;
}
