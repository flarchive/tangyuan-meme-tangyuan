/**
 * Attach a long-press handler that fires after `delay` ms (default 500) when
 * the user holds a touch on the element. The callback is invoked with the
 * original touch coordinates so it can position a context menu.
 *
 * Returns a cleanup function that removes all listeners.
 */
export function attachLongPress(
    el: HTMLElement,
    onLongPress: (x: number, y: number, originalEvent: TouchEvent) => void,
    delay = 500
): () => void {
    let timer: number | null = null;
    let startX = 0;
    let startY = 0;
    let moved = false;

    const clearTimer = () => {
        if (timer !== null) {
            window.clearTimeout(timer);
            timer = null;
        }
    };

    const onTouchStart = (e: TouchEvent) => {
        if (e.touches.length !== 1) return;
        const t = e.touches[0];
        startX = t.clientX;
        startY = t.clientY;
        moved = false;

        clearTimer();
        timer = window.setTimeout(() => {
            if (moved) return;
            try {
                e.preventDefault();
            } catch {
                // passive listener — swallow
            }
            onLongPress(startX, startY, e);
        }, delay);
    };

    const onTouchMove = (e: TouchEvent) => {
        if (!e.touches.length) return;
        const t = e.touches[0];
        const dx = Math.abs(t.clientX - startX);
        const dy = Math.abs(t.clientY - startY);
        if (dx > 8 || dy > 8) {
            moved = true;
            clearTimer();
        }
    };

    const onTouchEnd = () => {
        clearTimer();
    };

    const onTouchCancel = () => {
        clearTimer();
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchCancel, { passive: true });

    return () => {
        clearTimer();
        el.removeEventListener('touchstart', onTouchStart);
        el.removeEventListener('touchmove', onTouchMove);
        el.removeEventListener('touchend', onTouchEnd);
        el.removeEventListener('touchcancel', onTouchCancel);
    };
}
