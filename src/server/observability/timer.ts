export type Timer = {
    stop: () => number;
};

export function startTimer(): Timer {
    const start = process.hrtime.bigint();
    return {
        stop: () => {
            const end = process.hrtime.bigint();
            const diff = Number(end - start) / 1_000_000;
            return Math.round(diff);
        },
    };
}
