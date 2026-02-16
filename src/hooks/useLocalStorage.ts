import { useState, useEffect, useRef } from 'react';

/**
 * A custom hook that manages state in localStorage.
 * @param key The key to use in localStorage
 * @param initialValue The initial value if no value is found in localStorage
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
    // Get initial value from localStorage or fallback
    const [state, setState] = useState<T>(() => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(`Error reading localStorage key "${key}":`, error);
            return initialValue;
        }
    });

    // Use a ref to avoid unnecessary effect triggers if initialValue changes (though it shouldn't usually)
    const isFirstRender = useRef(true);

    // Sync state to localStorage whenever it changes
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        try {
            localStorage.setItem(key, JSON.stringify(state));
        } catch (error) {
            console.error(`Error setting localStorage key "${key}":`, error);
        }
    }, [key, state]);

    return [state, setState];
}
