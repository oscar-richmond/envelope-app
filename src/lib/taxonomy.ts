
export const INDUSTRY_TAXONOMY = [
    {
        label: "Professional & Business Services",
        key: "PROFESSIONAL_SERVICES",
        items: [
            { label: "Management Consultancy", sicPrefixes: ["7022"] },
            { label: "Marketing & Advertising", sicPrefixes: ["7311", "7312", "7021"] },
            { label: "Design, Branding & Creative Services", sicPrefixes: ["7410"] },
            { label: "IT Services & Software", sicPrefixes: ["6201", "6202", "6203", "6209", "6311", "6312"] },
            { label: "Accounting & Bookkeeping", sicPrefixes: ["6920"] },
            { label: "Legal Services", sicPrefixes: ["6910"] },
            { label: "Recruitment & HR Services", sicPrefixes: ["7810", "7820", "7830"] },
            { label: "Business Support Services", sicPrefixes: ["8211", "8219", "8220", "8230", "8291", "8292", "8299"] }
        ]
    },
    {
        label: "Technology & Digital",
        key: "TECHNOLOGY",
        items: [
            { label: "Software & SaaS", sicPrefixes: ["6201"] }, // Often overlaps with IT
            { label: "Web & App Development", sicPrefixes: ["6201"] },
            { label: "IT Consulting", sicPrefixes: ["6202"] },
            { label: "Data & Analytics", sicPrefixes: ["6311"] },
            { label: "Cybersecurity", sicPrefixes: ["6209"] }, // Niche, often general 6209
            { label: "AI / Machine Learning", sicPrefixes: ["6209", "6399"] },
            { label: "Telecommunications", sicPrefixes: ["6110", "6120", "6130", "6190"] }
        ]
    },
    {
        label: "Retail & E-commerce",
        key: "RETAIL",
        items: [
            { label: "Online Retail", sicPrefixes: ["4791"] },
            { label: "Physical Retail", sicPrefixes: ["4711", "4719", "472", "473", "474", "475", "476", "477"] },
            { label: "Wholesale", sicPrefixes: ["46"] },
            { label: "Consumer Goods", sicPrefixes: ["47"] } // General Fallback
        ]
    },
    {
        label: "Hospitality, Leisure & Travel",
        key: "HOSPITALITY",
        items: [
            { label: "Hotels & Accommodation", sicPrefixes: ["5510", "5520", "5530", "5590"] },
            { label: "Restaurants, Cafés & Bars", sicPrefixes: ["5610", "5621", "5629", "5630"] },
            { label: "Events & Venues", sicPrefixes: ["8230", "900"] }, // 8230 is Org of Conventions
            { label: "Travel Services", sicPrefixes: ["7911", "7912", "7990"] }
        ]
    },
    {
        label: "Property & Built Environment",
        key: "PROPERTY",
        items: [
            { label: "Property Development", sicPrefixes: ["4110"] },
            { label: "Estate & Letting Agencies", sicPrefixes: ["6810", "6820", "6831", "6832"] },
            { label: "Facilities Management", sicPrefixes: ["8110", "8121", "8122", "8129", "8130"] },
            { label: "Construction Services", sicPrefixes: ["4120", "42", "43"] },
            { label: "Architecture & Surveying", sicPrefixes: ["7111", "7112"] }
        ]
    },
    {
        label: "Healthcare & Wellness (Private)",
        key: "HEALTHCARE",
        items: [
            { label: "Private Clinics", sicPrefixes: ["8621", "8622", "8623"] },
            { label: "Dental Practices", sicPrefixes: ["8623"] },
            { label: "Mental Health Services", sicPrefixes: ["8690"] },
            { label: "Fitness & Wellness", sicPrefixes: ["9311", "9312", "9313", "9319"] },
            { label: "Care Providers (Private)", sicPrefixes: ["8710", "8720", "8730", "8790", "8810", "8891", "8899"] }
        ]
    },
    {
        label: "Manufacturing & Industrial",
        key: "MANUFACTURING",
        items: [
            { label: "Manufacturing", sicPrefixes: ["10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33"] },
            { label: "Engineering", sicPrefixes: ["7112"] },
            { label: "Industrial Services", sicPrefixes: ["331", "332"] },
            { label: "Energy & Utilities", sicPrefixes: ["35"] }
        ]
    },
    {
        label: "Education & Training (Private)",
        key: "EDUCATION",
        items: [
            { label: "Private Schools & Colleges", sicPrefixes: ["8510", "8520", "8531", "8532", "8541", "8542"] },
            { label: "Training Providers", sicPrefixes: ["8551", "8552", "8553", "8559"] },
            { label: "Online Education", sicPrefixes: ["8560"] },
        ]
    },
    {
        label: "Finance & Insurance",
        key: "FINANCE",
        items: [
            { label: "Financial Advisory", sicPrefixes: ["6619", "6630"] },
            { label: "Insurance Services", sicPrefixes: ["6511", "6512", "6621", "6622", "6629"] },
            { label: "Investment & Wealth Management", sicPrefixes: ["6430", "6492", "6499"] }
        ]
    },
    {
        label: "Media, Publishing & Entertainment",
        key: "MEDIA",
        items: [
            { label: "Media Production", sicPrefixes: ["5911", "5912", "5913", "5914", "5920", "6010", "6020"] },
            { label: "Publishing", sicPrefixes: ["5811", "5812", "5813", "5814", "5819"] },
            { label: "Music, Film & Entertainment", sicPrefixes: ["9001", "9002", "9003", "9004"] }
        ]
    },
    {
        label: "Logistics, Transport & Automotive",
        key: "LOGISTICS",
        items: [
            { label: "Logistics & Distribution", sicPrefixes: ["4941", "5210", "5221", "5222", "5223", "5224", "5229"] },
            { label: "Transport Services", sicPrefixes: ["4910", "4920", "4931", "4932", "4939", "50", "51"] },
            { label: "Automotive Services", sicPrefixes: ["4511", "4519", "4520", "4531", "4532"] }
        ]
    },
    {
        label: "Other / Miscellaneous",
        key: "OTHER",
        items: [
            { label: "Non-profits & Associations", sicPrefixes: ["9411", "9412", "9420", "9491", "9492", "9499"] },
            { label: "Membership Organisations", sicPrefixes: ["94"] },
            { label: "Other Services", sicPrefixes: ["9601", "9602", "9603", "9604", "9609"] }
        ]
    }
];

export function getSicCodesForIndustries(selectedIndustryLabels: string[]): string[] {
    const codes = new Set<string>();

    // Flatten taxonomy helper
    const allItems = INDUSTRY_TAXONOMY.flatMap(group => group.items);

    selectedIndustryLabels.forEach(label => {
        const match = allItems.find(i => i.label === label);
        if (match) {
            match.sicPrefixes.forEach(prefix => codes.add(prefix));
        }
    });

    return Array.from(codes);
}
