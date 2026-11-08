declare module 'futu-api' {
    export default class FtWebsocket {
        start(ip: string, port: number, ssl: boolean, key: string): void;
        onlogin: ((ok: boolean, message: unknown) => void) | null;
        RequestHistoryKL(req: { c2s: Record<string, unknown> }): Promise<{
            retType?: number;
            retMsg?: string;
            errCode?: number;
            s2c?: { klList?: Array<{ time?: string; closePrice?: number | string; isBlank?: boolean }> };
        }>;
        stop(): void;
        websock?: { close?: () => void; onerror: ((error: unknown) => void) | null };
    }
}
