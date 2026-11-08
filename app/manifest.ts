import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: '穩步 SteadyTrade',
        short_name: '穩步',
        description: '穩步 SteadyTrade。基於 OpenStock（AGPL-3.0）修改。',
        start_url: '/',
        display: 'standalone',
        background_color: '#0E1A33',
        theme_color: '#0E1A33',
        lang: 'zh-Hant',
        icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
    };
}
