import { useContext } from 'react';
import { DataContext, type DataContextValue } from './DataContext';

export function useData(): DataContextValue {
  const value = useContext(DataContext);
  if (!value) throw new Error('useData must be used inside DataProvider');
  return value;
}
