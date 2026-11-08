/**
 * PAPER TRADING ONLY — one auto fill per account, symbol, strategy, direction, and bar.
 * The in-memory store mirrors a unique index: concurrent claims for one key yield a single winner.
 */

export type IdempotencyParts = {
    accountId: string;
    symbol: string;
    strategy: string;
    direction: 'buy' | 'sell';
    barTimestamp: string;
};

export function buildIdempotencyKey(parts: IdempotencyParts): string {
    return [parts.accountId, parts.symbol, parts.strategy, parts.direction, parts.barTimestamp].join('|');
}

export class MemoryClaimStore {
    private keys = new Set<string>();
    private chains = new Map<string, Promise<void>>();

    claim(key: string): Promise<'claimed' | 'duplicate'> {
        const prev = this.chains.get(key) ?? Promise.resolve();
        let release: () => void = () => undefined;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        this.chains.set(key, prev.then(() => gate));
        return prev.then(() => {
            try {
                if (this.keys.has(key)) return 'duplicate' as const;
                this.keys.add(key);
                return 'claimed' as const;
            } finally {
                release();
            }
        });
    }

    has(key: string): boolean {
        return this.keys.has(key);
    }
}

/** Serializes book mutations the way a document transaction would for one account. */
export function createSerializedBook<T extends object>(initial: T) {
    let chain: Promise<void> = Promise.resolve();
    const state = initial;
    return {
        state,
        run<R>(fn: (state: T) => Promise<R> | R): Promise<R> {
            const run = chain.then(() => fn(state));
            chain = run.then(() => undefined, () => undefined);
            return run;
        },
    };
}
