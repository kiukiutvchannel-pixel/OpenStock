import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Bell, KeyRound, ShieldCheck, Star } from "lucide-react";
import Panel from "@/components/Panel";
import ProfileForm from "@/components/profile/ProfileForm";
import PasswordForm from "@/components/profile/PasswordForm";
import { auth, getSession } from "@/lib/better-auth/auth";
import { getUserWatchlist } from "@/lib/actions/watchlist.actions";
import { getUserAlerts } from "@/lib/actions/alert.actions";
import { alertsEnabled } from "@/lib/market-data";
import { UI_LOCALE, UI_TIME_ZONE } from "@/lib/i18n/format";
import { zh } from "@/lib/i18n/zh-Hant";

export const metadata = { title: '個人檔案 | 穩步' };

const METHOD_LABELS: Record<string, string> = {
    credential: zh.auth.methodEmail,
    google: 'Google',
    github: 'GitHub',
};

export default async function ProfilePage() {
    const session = await getSession();
    if (!session?.user) redirect('/sign-in');
    const { user } = session;

    const [accounts, watchlist, alerts] = await Promise.all([
        auth.api.listUserAccounts({ headers: await headers() }).catch(() => []),
        getUserWatchlist(),
        getUserAlerts(),
    ]);
    const linked = new Set(accounts.map((a: { providerId: string }) => a.providerId));
    const activeAlerts = alerts.filter((a: { triggered?: boolean }) => !a.triggered).length;
    const memberSince = new Date(user.createdAt).toLocaleDateString(UI_LOCALE, { timeZone: UI_TIME_ZONE, year: 'numeric', month: 'long' });

    const stats = [
        { label: zh.auth.profileWatching, value: watchlist.length, icon: Star },
        { label: alertsEnabled ? zh.auth.profileActiveAlerts : zh.auth.profilePausedAlerts, value: activeAlerts, icon: Bell },
        { label: zh.auth.profileSignInMethods, value: linked.size, icon: ShieldCheck },
    ];

    return (
        <>
            <section className="hatch">
                <div className="card flex flex-wrap items-center gap-4 p-5">
                    <span className="grid size-14 flex-none place-items-center rounded-full bg-brand-soft text-[22px] font-bold text-brand-ink">
                        {user.name?.[0]?.toUpperCase() ?? '?'}
                    </span>
                    <div className="min-w-0 flex-1">
                        <h1 className="truncate text-[22px] font-bold tracking-[-0.03em]">{user.name}</h1>
                        <p className="truncate text-faint">{user.email} · {zh.auth.profileMemberSince} {memberSince}</p>
                    </div>
                </div>
                <div className="bento mt-[3px]">
                    {stats.map(({ label, value, icon: Icon }) => (
                        <div key={label} className="bento-tile col-span-4 gap-2.5 max-lg:col-span-12">
                            <div className="bento-head"><span className="bento-ico"><Icon /></span>{label}</div>
                            <p className="bento-value text-[26px]">{value}</p>
                        </div>
                    ))}
                </div>
            </section>

            <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
                <Panel title={zh.auth.profileDetails} sub={zh.auth.profileDetailsSub}>
                    <ProfileForm
                        initial={{
                            name: user.name,
                            country: user.country ?? 'US',
                            investmentGoals: user.investmentGoals ?? 'Growth',
                            riskTolerance: user.riskTolerance ?? 'Medium',
                            preferredIndustry: user.preferredIndustry ?? 'Technology',
                        }}
                    />
                </Panel>

                <div className="flex min-w-0 flex-col gap-3">
                    <Panel title={zh.auth.profileMethods} sub={zh.auth.profileMethodsSub}>
                        <ul className="row-list">
                            {[...linked].map((id) => (
                                <li key={id} className="flex items-center gap-3 px-3.5 py-3">
                                    <span className="bento-ico"><KeyRound /></span>
                                    <span className="flex-1 font-semibold">{METHOD_LABELS[id] ?? id}</span>
                                    <span className="pill is-up">{zh.auth.profileConnected}</span>
                                </li>
                            ))}
                        </ul>
                    </Panel>

                    {linked.has('credential') && (
                        <Panel title={zh.auth.profilePassword} sub={zh.auth.profilePasswordSub}>
                            <PasswordForm />
                        </Panel>
                    )}
                </div>
            </div>
        </>
    );
}
