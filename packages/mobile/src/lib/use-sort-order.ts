// Shared sort-order state for the courses and course-detail screens, backed
// by the persisted pref so both screens (and relaunches) see one order. The
// pref is re-read on focus, so a pick made on one screen is reflected when
// navigating back to the other. The default and the fallback for any
// unknown/removed saved value (e.g. a stale 'alpha-desc' from before that
// order was dropped) is 'progress-desc', matching the desktop; a stale value
// is rewritten so it doesn't linger.
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { SORT_ORDERS } from '@lectio/core/planner-core';
import { prefs } from './prefs';
import type { SortOrder } from '../../types/lectio-core';

const DEFAULT_SORT: SortOrder = 'progress-desc';

export function useSortOrder(): [SortOrder, (order: SortOrder) => void] {
  const [sortOrder, setSortOrder] = useState<SortOrder>(DEFAULT_SORT);
  useFocusEffect(
    useCallback(() => {
      prefs.getSortOrder().then((saved) => {
        if (saved && (SORT_ORDERS as string[]).includes(saved)) {
          setSortOrder(saved as SortOrder);
        } else if (saved) {
          // A saved-but-no-longer-valid order: degrade and overwrite it.
          setSortOrder(DEFAULT_SORT);
          prefs.setSortOrder(DEFAULT_SORT);
        }
      });
    }, [])
  );
  const pick = useCallback((order: SortOrder) => {
    setSortOrder(order);
    prefs.setSortOrder(order);
  }, []);
  return [sortOrder, pick];
}
