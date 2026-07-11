import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const VIEW_SETTINGS_KEY = 'shoppingListViewSettings';

export interface ShoppingListViewSettings {
  hideCheckedItems: boolean;
  hideCheckboxes: boolean;
}

const DEFAULT_VIEW_SETTINGS: ShoppingListViewSettings = {
  hideCheckedItems: false,
  hideCheckboxes: false,
};

export async function loadShoppingListViewSettings(): Promise<ShoppingListViewSettings> {
  try {
    const raw = await AsyncStorage.getItem(VIEW_SETTINGS_KEY);
    if (!raw) {
      return { ...DEFAULT_VIEW_SETTINGS };
    }

    const parsed = JSON.parse(raw) as Partial<ShoppingListViewSettings>;
    return {
      hideCheckedItems: !!parsed.hideCheckedItems,
      hideCheckboxes: !!parsed.hideCheckboxes,
    };
  } catch (error) {
    console.warn('[shoppingListViewSettings] Failed to load', error);
    return { ...DEFAULT_VIEW_SETTINGS };
  }
}

export async function saveShoppingListViewSettings(
  settings: ShoppingListViewSettings
): Promise<void> {
  try {
    await AsyncStorage.setItem(VIEW_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('[shoppingListViewSettings] Failed to save', error);
  }
}

export function useShoppingListViewSettings() {
  const [settings, setSettings] = useState<ShoppingListViewSettings>(DEFAULT_VIEW_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void loadShoppingListViewSettings().then((next) => {
      if (!cancelled) {
        setSettings(next);
        setLoaded(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<ShoppingListViewSettings>) => {
      setSettings((current) => {
        const next = { ...current, ...patch };
        if (loaded) {
          void saveShoppingListViewSettings(next);
        }
        return next;
      });
    },
    [loaded]
  );

  return {
    hideCheckedItems: settings.hideCheckedItems,
    hideCheckboxes: settings.hideCheckboxes,
    setHideCheckedItems: (hideCheckedItems: boolean) => updateSettings({ hideCheckedItems }),
    setHideCheckboxes: (hideCheckboxes: boolean) => updateSettings({ hideCheckboxes }),
    loaded,
  };
}
