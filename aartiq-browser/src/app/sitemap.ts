
import { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
    return [
        {
            url: 'https://browser.ponsrischool.in',
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 1,
        },
    ];
}
