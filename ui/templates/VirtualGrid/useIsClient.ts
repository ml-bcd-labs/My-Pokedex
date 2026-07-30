import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

// false during SSR and the first client (hydration) render, true thereafter.
// This is the "you might not need an Effect" idiom for client detection.
const useIsClient = (): boolean =>
  useSyncExternalStore(emptySubscribe, () => true, () => false);

export default useIsClient;
