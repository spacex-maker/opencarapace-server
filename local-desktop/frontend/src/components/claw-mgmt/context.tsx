import { createContext, useContext, type ReactNode } from "react";
import type { ClawMgmtCoreValue } from "./useClawMgmtCore";

export const ClawMgmtContext = createContext<ClawMgmtCoreValue | null>(null);

export function useClawMgmt(): ClawMgmtCoreValue {
  const v = useContext(ClawMgmtContext);
  if (!v) {
    throw new Error("useClawMgmt must be used within ClawMgmtPanel");
  }
  return v;
}

export function ClawMgmtProvider({ value, children }: { value: ClawMgmtCoreValue; children: ReactNode }) {
  return <ClawMgmtContext.Provider value={value}>{children}</ClawMgmtContext.Provider>;
}
