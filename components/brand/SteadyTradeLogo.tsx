/**
 * 穩步 SteadyTrade lockup. Vector only — the reference JPEG is not embedded.
 * Upstream product: OpenStock (AGPL-3.0). See LICENSE.
 */

type IconProps = { className?: string; title?: string };

export function SteadyTradeIcon({ className, title = '穩步' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 64 64" fill="none" role="img" aria-label={title} xmlns="http://www.w3.org/2000/svg">
            <rect width="64" height="64" rx="15" fill="#0E1A33" />
            <path fill="#14B8A6" d="M13 42h10v12H13z" />
            <path fill="#10B981" d="M24 32h10v22H24z" />
            <path fill="#34D399" d="M35 22h10v32H35z" />
            <path d="M40 22c5-5 9.2-8.2 15.4-10" stroke="#34D399" strokeWidth="5.2" strokeLinecap="round" />
            <circle cx="55.6" cy="11.8" r="3.15" fill="#F0C14A" />
        </svg>
    );
}

export default function SteadyTradeLogo({
    className = '',
    iconClassName = 'size-9',
    compact = false,
}: {
    className?: string;
    iconClassName?: string;
    compact?: boolean;
}) {
    return (
        <span className={`inline-flex items-center gap-2.5 ${className}`}>
            <SteadyTradeIcon className={iconClassName} />
            <span className="flex min-w-0 flex-col leading-none">
                <span className="text-[15px] font-bold tracking-[-0.03em] text-foreground">SteadyTrade</span>
                {!compact && <span className="mt-1 text-[12px] font-semibold tracking-[0.14em] text-muted-foreground">穩步</span>}
            </span>
        </span>
    );
}
