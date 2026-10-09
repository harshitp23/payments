import { createContext, useContext } from 'react'
import type { AllData } from './api'
import type { IsoDate, LedgerEntry, Semester } from './types'

export interface Store {
  data: AllData
  ledger: Map<string, LedgerEntry[]>
  today: IsoDate
  semester: Semester | null
  setSemesterId: (id: string) => void
  /** Runs a mutation then reloads everything; returns false (and shows the error) on failure. */
  run: (fn: () => Promise<unknown>) => Promise<boolean>
}

export const StoreContext = createContext<Store | null>(null)

export function useStore(): Store {
  const s = useContext(StoreContext)
  if (!s) throw new Error('useStore outside StoreContext')
  return s
}
