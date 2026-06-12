// Shared sort-order state for the courses and course-detail screens, backed
// by the persisted pref so both screens (and relaunches) see one order. The
// pref is re-read on focus, so a pick made on one screen is reflected when
// navigating back to the other; unknown values fall back to 'alpha-asc'.
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { SORT_ORDERS } from '@lectio/core/planner-core';
import { prefs } from './prefs';
import type { SortOrder } from '../../types/lectio-core';

export function useSortOrder(): [SortOrder, (order: SortOrder) => void] {
  const [sortOrder, setSortOrder] = useState<SortOrder>('alpha-asc');
  useFocusEffect(
    useCallback(() => {
      prefs.getSortOrder().then((saved) => {
        if (saved && (SORT_ORDERS as string[]).includes(saved)) setSortOrder(saved as SortOrder);
      });
    }, [])
  );
  const pick = useCallback((order: SortOrder) => {
    setSortOrder(order);
    prefs.setSortOrder(order);
  }, []);
  return [sortOrder, pick];
}
