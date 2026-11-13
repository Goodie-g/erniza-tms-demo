export const PAGE_DEFINITIONS = [
    {
        slug: 'home',
        title: 'Homepage',
        description: 'Hero, trust signals, featured content and calls to action on the public homepage.',
        sections: [
            {
                key: 'hero',
                label: 'Hero',
                description: 'Main above-the-fold banner.',
                fields: [
                    { key: 'eyebrow', label: 'Eyebrow', type: 'text', placeholder: 'Discover Tanzania' },
                    { key: 'title', label: 'Headline', type: 'text', placeholder: 'Experience the Wild Heart of Africa' },
                    { key: 'description', label: 'Description', type: 'textarea' },
                    { key: 'primaryLabel', label: 'Primary button label', type: 'text' },
                    { key: 'primaryUrl', label: 'Primary button link', type: 'url' },
                    { key: 'secondaryLabel', label: 'Secondary button label', type: 'text' },
                    { key: 'secondaryUrl', label: 'Secondary button link', type: 'url' },
                    { key: 'imageUrl', label: 'Background image URL', type: 'url' },
                ],
            },
            {
                key: 'stats',
                label: 'Statistics',
                description: 'Short proof points displayed below the hero.',
                fields: [
                    {
                        key: 'items',
                        label: 'Stats',
                        type: 'items',
                        itemFields: [
                            { key: 'value', label: 'Value', type: 'text' },
                            { key: 'label', label: 'Label', type: 'text' },
                        ],
                    },
                ],
            },
            {
                key: 'about',
                label: 'About intro',
                description: 'Short introduction to the company.',
                fields: [
                    { key: 'title', label: 'Title', type: 'text' },
                    { key: 'description', label: 'Description', type: 'textarea' },
                    { key: 'imageUrl', label: 'Image URL', type: 'url' },
                ],
            },
            {
                key: 'whyChooseUs',
                label: 'Why choose us',
                description: 'Differentiators shown as cards.',
                fields: [
                    { key: 'title', label: 'Section title', type: 'text' },
                    { key: 'subtitle', label: 'Subtitle', type: 'textarea' },
                    {
                        key: 'items',
                        label: 'Reasons',
                        type: 'items',
                        itemFields: [
                            { key: 'title', label: 'Title', type: 'text' },
                            { key: 'description', label: 'Description', type: 'textarea' },
                            { key: 'icon', label: 'Icon name', type: 'text' },
                        ],
                    },
                ],
            },
            {
                key: 'testimonials',
                label: 'Testimonials',
                description: 'Guest reviews displayed on the homepage.',
                fields: [
                    { key: 'title', label: 'Section title', type: 'text' },
                    {
                        key: 'items',
                        label: 'Testimonials',
                        type: 'items',
                        itemFields: [
                            { key: 'quote', label: 'Quote', type: 'textarea' },
                            { key: 'author', label: 'Author', type: 'text' },
                            { key: 'country', label: 'Country', type: 'text' },
                        ],
                    },
                ],
            },
            {
                key: 'cta',
                label: 'Call to action',
                description: 'Closing conversion banner.',
                fields: [
                    { key: 'title', label: 'Title', type: 'text' },
                    { key: 'description', label: 'Description', type: 'textarea' },
                    { key: 'buttonLabel', label: 'Button label', type: 'text' },
                    { key: 'buttonUrl', label: 'Button link', type: 'url' },
                ],
            },
        ],
    },
    {
        slug: 'about',
        title: 'About us',
        description: 'Company story, mission, values and community impact.',
        sections: [
            {
                key: 'story',
                label: 'Our story',
                description: 'The founding story and company background.',
                fields: [
                    { key: 'title', label: 'Title', type: 'text' },
                    { key: 'paragraphs', label: 'Paragraphs', type: 'list', help: 'One paragraph per line.' },
                    { key: 'imageUrl', label: 'Image URL', type: 'url' },
                ],
            },
            {
                key: 'mission',
                label: 'Mission',
                description: 'Mission statement.',
                fields: [
                    { key: 'title', label: 'Title', type: 'text' },
                    { key: 'description', label: 'Mission', type: 'textarea' },
                ],
            },
            {
                key: 'values',
                label: 'Values',
                description: 'Company values.',
                fields: [
                    { key: 'title', label: 'Section title', type: 'text' },
                    {
                        key: 'items',
                        label: 'Values',
                        type: 'items',
                        itemFields: [
                            { key: 'title', label: 'Title', type: 'text' },
                            { key: 'description', label: 'Description', type: 'textarea' },
                        ],
                    },
                ],
            },
        ],
    },
    {
        slug: 'contact',
        title: 'Contact information',
        description: 'Public contact details and response promise.',
        sections: [
            {
                key: 'details',
                label: 'Contact details',
                description: 'Displayed on the contact page and footer.',
                fields: [
                    { key: 'email', label: 'Email address', type: 'text' },
                    { key: 'phone', label: 'Phone number', type: 'text' },
                    { key: 'whatsapp', label: 'WhatsApp number', type: 'text' },
                    { key: 'address', label: 'Office address', type: 'textarea' },
                    { key: 'hours', label: 'Opening hours', type: 'text' },
                    { key: 'responseTime', label: 'Response promise', type: 'text' },
                    { key: 'mapUrl', label: 'Map embed URL', type: 'url' },
                ],
            },
        ],
    },
    {
        slug: 'footer',
        title: 'Footer',
        description: 'Footer blurb, social links and legal text.',
        sections: [
            {
                key: 'main',
                label: 'Footer content',
                description: 'Global footer shown on every public page.',
                fields: [
                    { key: 'about', label: 'About blurb', type: 'textarea' },
                    { key: 'instagram', label: 'Instagram URL', type: 'url' },
                    { key: 'facebook', label: 'Facebook URL', type: 'url' },
                    { key: 'tripadvisor', label: 'Tripadvisor URL', type: 'url' },
                    { key: 'copyright', label: 'Copyright line', type: 'text' },
                ],
            },
        ],
    },
];
export const DEFAULT_PAGE_CONTENT = {
    home: {
        hero: {
            eyebrow: 'Discover Tanzania',
            title: 'Experience the Wild Heart of Africa',
            description: 'From the snow-capped peak of Kilimanjaro to the endless plains of Serengeti, from the exotic beaches of Zanzibar to the hidden gems of the Southern Circuit — your authentic Tanzanian adventure starts here with Erniza.',
            primaryLabel: 'Explore Safaris',
            primaryUrl: '/tanzania-safaris.html',
            secondaryLabel: 'Mountain Treks',
            secondaryUrl: '/mountains.html',
            imageUrl: '/assets/serengeti/Hero-section-photo-2.jpg',
        },
        stats: {
            items: [
                { value: '5+', label: 'Years of Experience' },
                { value: '50+', label: 'Safari Packages' },
                { value: '100%', label: 'Tanzanian Owned' },
            ],
        },
        whyChooseUs: {
            title: 'Why Choose Erniza Africa Safaris',
            subtitle: "We're not just guides — we're your gateway to authentic Tanzania",
            items: [
                { title: 'Local Expertise', description: 'Born and raised in Tanzania, our guides know every hidden trail.', icon: 'compass' },
                { title: 'Sustainable Tourism', description: 'We support local communities and practice eco-friendly tourism.', icon: 'leaf' },
                { title: 'Safety First', description: 'Fully licensed, insured, and equipped with satellite communication.', icon: 'shield' },
                { title: 'Tailor-Made', description: 'Every itinerary is customised to your preferences, pace and budget.', icon: 'sparkles' },
            ],
        },
        testimonials: {
            title: 'What Our Guests Say',
            items: [
                {
                    quote: "Erniza's team made our dream safari a reality. We saw the Big Five, climbed Kilimanjaro, and relaxed in Zanzibar — all perfectly organised.",
                    author: 'The Anderson Family',
                    country: 'Australia',
                },
            ],
        },
        cta: {
            title: 'Ready for Your Tanzanian Adventure?',
            description: 'Let us craft your perfect itinerary — from the savanna to the summit to the sea.',
            buttonLabel: 'Start Planning Now',
            buttonUrl: '/contact.html',
        },
    },
    contact: {
        details: {
            email: 'info@ernizaafricasafaris.com',
            phone: '+255 776 749 127',
            whatsapp: '+255 776 749 127',
            address: 'Sanawari, Arusha, Tanzania',
            hours: 'Mon–Sat: 8:00 AM – 6:00 PM',
            responseTime: 'We respond within 24 hours',
        },
    },
    footer: {
        main: {
            about: '100% Tanzanian owned. Travel with purpose.',
            instagram: 'https://www.instagram.com/ernizaafrica/',
            facebook: '',
            tripadvisor: 'https://www.tripadvisor.com/Attraction_Review-g297913-d34578616-Reviews-Erniza_Africa_Safaris-Arusha_Arusha_Region.html',
            copyright: '© 2026 Erniza Africa Safaris. All rights reserved.',
        },
    },
};
//# sourceMappingURL=pages.js.map