import { SparkHome } from "../SparkHome";

/** Mobile chrome, same Home feature and backend projection as desktop. */
export function MobileHome({ onNavigate = () => {} }: { onNavigate?: (path: string) => void } = {}) {
  return <SparkHome compactChrome onNavigate={onNavigate} />;
}
