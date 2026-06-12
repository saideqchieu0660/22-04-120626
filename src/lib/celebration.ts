import confetti from 'canvas-confetti';

export const triggerCelebration = () => {
    window.dispatchEvent(new CustomEvent("app-pulse-logo"));
    confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#fde047', '#3b82f6', '#ef4444', '#22c55e']
    });
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate([100, 50, 100, 50, 150]); // Distinct triple pulse pattern for celebration milestone
    }
};
