import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PAGE_CONTENT, PAGE_DEFINITIONS, } from '@erniza/shared';
import { config } from '../config.js';
import { closeDb, getDb } from '../db/client.js';
import { hashPassword } from '../lib/password.js';
import { nextReference } from '../lib/reference.js';
import { storeImage } from '../services/storage.js';
import { DEFAULT_SETTINGS } from '../services/settings.js';
import { createQuotationVersion, writeQuotationItems } from '../modules/quotations/service.js';
const here = path.dirname(fileURLToPath(import.meta.url));
const assetCandidates = [
    path.resolve(process.cwd(), 'assets'),
    path.resolve(process.cwd(), '../../assets'),
    path.resolve(here, '../../../assets'),
];
function isoDate(offsetDays) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + offsetDays);
    return date.toISOString().slice(0, 10);
}
function timestamp(offsetDays) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + offsetDays);
    return date;
}
const MEDIA_SEEDS = [
    { key: 'serengeti', file: 'serengeti/Serengeti-migration-card.jpg', alt: 'Wildebeest crossing the Serengeti plains' },
    { key: 'ngorongoro', file: 'ngorongoro/hero.jpg', alt: 'Ngorongoro Crater rim at sunrise' },
    { key: 'tarangire', file: 'Tarangire and Manyara/tomas-malik-zGYFIzpUUCI-unsplash.jpg', alt: 'Elephants among baobabs in Tarangire' },
    { key: 'selous', file: 'selous/marijn-van-der-marel-fZzfaLwOKjU-unsplash.jpg', alt: 'River safari in Nyerere National Park' },
    { key: 'ruaha', file: 'ruaha/large_small_herd_8d7587aab2.jpg', alt: 'Elephant herd in Ruaha National Park' },
    { key: 'katavi', file: 'katavi/large_Hippos_Katavi_17_8d470047c1.jpg', alt: 'Hippos in a Katavi waterhole' },
    { key: 'zanzibar', file: 'Zanzibar/andre-abreu-FW5Es_Bt1Zk-unsplash.jpg', alt: 'Turquoise water off Zanzibar' },
    { key: 'kilimanjaro', file: 'klm/daniel-vargas-LM6udy8TMgo-unsplash.jpg', alt: 'Mount Kilimanjaro above the clouds' },
    { key: 'mahale', file: 'Mahale/simone-dinoia-9sssA1nSKe8-unsplash.jpg', alt: 'Lake Tanganyika shoreline at Mahale' },
];
const PRODUCT_SEEDS = [
    {
        key: 'serengeti-migration',
        name: 'Serengeti Great Migration Safari',
        slug: 'serengeti-great-migration-safari',
        category: 'northern',
        media: 'serengeti',
        summary: 'Follow the Great Migration across the Serengeti plains with expert guides and exclusive camps.',
        description: 'Witness one of the greatest wildlife spectacles on earth. This classic northern safari combines the Serengeti migration routes with the Ngorongoro Crater and cultural visits, staying in carefully selected camps close to the action.',
        days: 7,
        nights: 6,
        difficulty: 'Easy',
        minTravellers: 2,
        maxTravellers: 8,
        featured: true,
        price: 3150,
        destinations: ['serengeti', 'ngorongoro'],
        activities: ['game-drives', 'migration', 'balloon'],
        itinerary: [
            { title: 'Arrival in Arusha', description: 'Met at Kilimanjaro International Airport and transferred to your Arusha hotel for a safari briefing.', accommodation: 'Mount Meru Hotel', meals: 'Bed & breakfast' },
            { title: 'Arusha to Serengeti', description: 'Fly to the Serengeti and enjoy an afternoon game drive in the Seronera Valley.', accommodation: 'Serengeti Heritage Camp', meals: 'Full board' },
            { title: 'Full day in the Serengeti', description: 'Game drives following the migration herds, with picnic lunch under an acacia tree.', accommodation: 'Serengeti Heritage Camp', meals: 'Full board' },
            { title: 'Northern Serengeti', description: 'Explore the Mara River area for river crossings and big cat action (seasonal).', accommodation: 'Migration Tented Camp', meals: 'Full board' },
            { title: 'Serengeti to Ngorongoro', description: 'Morning game drive followed by a scenic drive to the Ngorongoro highlands and a Maasai village visit.', accommodation: 'Ngorongoro Serena Lodge', meals: 'Full board' },
            { title: 'Ngorongoro Crater', description: 'Descend into the crater for a full day of game viewing, including rhino and lion.', accommodation: 'Ngorongoro Serena Lodge', meals: 'Full board' },
            { title: 'Departure', description: 'Return to Arusha with a stop at a local craft market before your airport transfer.', meals: 'Breakfast' },
        ],
    },
    {
        key: 'ngorongoro',
        name: 'Ngorongoro Crater Explorer',
        slug: 'ngorongoro-crater-explorer',
        category: 'northern',
        media: 'ngorongoro',
        summary: 'A short, luxurious escape into the world-famous Ngorongoro Crater and its abundant wildlife.',
        description: 'Perfect for travellers with limited time, this escape focuses on the Ngorongoro Conservation Area, a UNESCO World Heritage Site and one of the best places in Africa to see the Big Five in a single day.',
        days: 4,
        nights: 3,
        difficulty: 'Easy',
        minTravellers: 2,
        maxTravellers: 12,
        featured: true,
        price: 1850,
        destinations: ['ngorongoro', 'tarangire'],
        activities: ['game-drives', 'cultural-visit'],
        itinerary: [
            { title: 'Arusha to Ngorongoro', description: 'Drive through the highlands with a Maasai village visit en route.', accommodation: 'Ngorongoro Serena Lodge', meals: 'Full board' },
            { title: 'Full day crater tour', description: 'Early descent into the crater for a full day of game viewing and a picnic by the hippo pool.', accommodation: 'Ngorongoro Serena Lodge', meals: 'Full board' },
            { title: 'Tarangire National Park', description: 'Drive to Tarangire for an afternoon game drive among giant baobabs and elephant herds.', accommodation: 'Tarangire Safari Lodge', meals: 'Full board' },
            { title: 'Return to Arusha', description: 'Morning game drive and return to Arusha for your departure.', meals: 'Breakfast' },
        ],
    },
    {
        key: 'tarangire-manyara',
        name: 'Tarangire & Lake Manyara Safari',
        slug: 'tarangire-lake-manyara-safari',
        category: 'northern',
        media: 'tarangire',
        summary: 'Elephant herds, baobab forests and the birdlife of Lake Manyara on a relaxed four-day safari.',
        description: 'An excellent value introduction to Tanzania’s northern circuit. Explore Tarangire’s elephant-filled river valley and Lake Manyara’s groundwater forest, home to tree-climbing lions and flamingos.',
        days: 5,
        nights: 4,
        difficulty: 'Easy',
        minTravellers: 2,
        maxTravellers: 10,
        featured: false,
        price: 2100,
        destinations: ['tarangire', 'manyara'],
        activities: ['game-drives', 'walking-safari', 'cultural-visit'],
        itinerary: [
            { title: 'Arusha to Tarangire', description: 'Afternoon game drive among baobabs and the Tarangire River.', accommodation: 'Tarangire Safari Lodge', meals: 'Full board' },
            { title: 'Full day in Tarangire', description: 'Explore the park’s diverse landscapes and huge elephant families.', accommodation: 'Tarangire Safari Lodge', meals: 'Full board' },
            { title: 'Lake Manyara', description: 'Game drive through the groundwater forest and along the soda lake.', accommodation: 'Manyara Serena Lodge', meals: 'Full board' },
            { title: 'Walking safari and villages', description: 'Guided walking safari and a visit to a local village.', accommodation: 'Manyara Serena Lodge', meals: 'Full board' },
            { title: 'Return to Arusha', description: 'Morning at leisure before returning to Arusha.', meals: 'Breakfast' },
        ],
    },
    {
        key: 'selous',
        name: 'Selous Game Reserve Adventure',
        slug: 'selous-game-reserve-adventure',
        category: 'southern',
        media: 'selous',
        summary: 'Boat safaris and walking safaris in the vast, wild Nyerere National Park (Selous).',
        description: 'Discover one of Africa’s largest protected areas. Selous offers boat safaris on the Rufiji River, guided walking safaris and superb game viewing away from the crowds.',
        days: 6,
        nights: 5,
        difficulty: 'Moderate',
        minTravellers: 2,
        maxTravellers: 8,
        featured: true,
        price: 2300,
        destinations: ['selous'],
        activities: ['boat-safari', 'walking-safari', 'game-drives'],
        itinerary: [
            { title: 'Fly to Selous', description: 'Fly from Dar es Salaam and enjoy an afternoon boat safari on the Rufiji River.', accommodation: 'Selous Riverside Camp', meals: 'Full board' },
            { title: 'Game drives', description: 'Full day exploring the reserve by 4x4.', accommodation: 'Selous Riverside Camp', meals: 'Full board' },
            { title: 'Walking safari', description: 'Guided walking safari with an armed ranger.', accommodation: 'Selous Riverside Camp', meals: 'Full board' },
            { title: 'River and lakes', description: 'Boat safari through the lakes and channels of the Rufiji.', accommodation: 'Selous Riverside Camp', meals: 'Full board' },
            { title: 'Village visit', description: 'Cultural visit and afternoon game drive.', accommodation: 'Selous Riverside Camp', meals: 'Full board' },
            { title: 'Departure', description: 'Morning boat safari and flight back to Dar es Salaam.', meals: 'Breakfast' },
        ],
    },
    {
        key: 'ruaha',
        name: 'Ruaha National Park Safari',
        slug: 'ruaha-national-park-safari',
        category: 'southern',
        media: 'ruaha',
        summary: 'Remote, rugged and rewarding: big prides, rare antelope and dramatic river landscapes.',
        description: 'Ruaha is Tanzania’s largest national park and a haven for predators. This safari is ideal for repeat visitors and photographers looking for a true wilderness experience.',
        days: 7,
        nights: 6,
        difficulty: 'Moderate',
        minTravellers: 2,
        maxTravellers: 6,
        featured: false,
        price: 2600,
        destinations: ['ruaha'],
        activities: ['game-drives', 'walking-safari', 'birding'],
        itinerary: [
            { title: 'Fly to Ruaha', description: 'Fly from Dar es Salaam or Arusha and take an afternoon game drive along the Great Ruaha River.', accommodation: 'Ruaha River Lodge', meals: 'Full board' },
            { title: 'Exploring Ruaha', description: 'Full-day game drives in search of lion, leopard and rare antelope.', accommodation: 'Ruaha River Lodge', meals: 'Full board' },
            { title: 'Walking safari', description: 'Track wildlife on foot with an expert guide.', accommodation: 'Ruaha River Lodge', meals: 'Full board' },
            { title: 'Photographic hides', description: 'Spend the day at the river with time in the photographic hides.', accommodation: 'Ruaha River Lodge', meals: 'Full board' },
            { title: 'Northern sector', description: 'Explore the northern sector and its rocky kopjes.', accommodation: 'Ruaha River Lodge', meals: 'Full board' },
            { title: 'Sundowners', description: 'Final game drive and sundowners overlooking the river.', accommodation: 'Ruaha River Lodge', meals: 'Full board' },
            { title: 'Departure', description: 'Morning game drive and flight back.', meals: 'Breakfast' },
        ],
    },
    {
        key: 'katavi-mahale',
        name: 'Katavi & Mahale Mountains',
        slug: 'katavi-mahale-mountains',
        category: 'western',
        media: 'katavi',
        summary: 'The ultimate off-the-beaten-track safari: Katavi’s plains and chimpanzees on Lake Tanganyika.',
        description: 'For adventurous travellers, this itinerary combines the remote wilderness of Katavi with the rainforests of Mahale Mountains, where habituated chimpanzees live beside pristine beaches.',
        days: 10,
        nights: 9,
        difficulty: 'Challenging',
        minTravellers: 2,
        maxTravellers: 6,
        featured: true,
        price: 4500,
        destinations: ['katavi', 'mahale'],
        activities: ['game-drives', 'chimpanzee-trekking', 'snorkelling'],
        itinerary: [
            { title: 'Fly to Katavi', description: 'Charter flight to Katavi and afternoon game drive.', accommodation: 'Katavi Wildlife Camp', meals: 'Full board' },
            { title: 'Katavi plains', description: 'Full-day game drives in one of Tanzania’s most remote parks.', accommodation: 'Katavi Wildlife Camp', meals: 'Full board' },
            { title: 'Hippo pools', description: 'Watch huge herds gather at the shrinking waterholes.', accommodation: 'Katavi Wildlife Camp', meals: 'Full board' },
            { title: 'Fly to Mahale', description: 'Fly to Mahale Mountains on the shores of Lake Tanganyika.', accommodation: 'Mahale Beach Lodge', meals: 'Full board' },
            { title: 'Chimpanzee trekking', description: 'Trek into the rainforest to observe habituated chimpanzees.', accommodation: 'Mahale Beach Lodge', meals: 'Full board' },
            { title: 'Forest and beach', description: 'Second chimpanzee trek and afternoon on the beach.', accommodation: 'Mahale Beach Lodge', meals: 'Full board' },
            { title: 'Lake Tanganyika', description: 'Snorkelling, kayaking and relaxation on the lake.', accommodation: 'Mahale Beach Lodge', meals: 'Full board' },
            { title: 'Mahale forest walk', description: 'Guided forest walk and waterfall visit.', accommodation: 'Mahale Beach Lodge', meals: 'Full board' },
            { title: 'Beach day', description: 'A final day at leisure on the lake shore.', accommodation: 'Mahale Beach Lodge', meals: 'Full board' },
            { title: 'Departure', description: 'Boat transfer and flight back to Arusha.', meals: 'Breakfast' },
        ],
    },
    {
        key: 'northern-classic',
        name: 'Northern Circuit Classic',
        slug: 'northern-circuit-classic',
        category: 'northern',
        media: 'serengeti',
        summary: 'The complete northern circuit: Tarangire, Serengeti, Ngorongoro and Lake Manyara.',
        description: 'Our most popular comprehensive safari. Visit all the major northern parks with a balanced pace, excellent guides and comfortable lodges throughout.',
        days: 8,
        nights: 7,
        difficulty: 'Easy',
        minTravellers: 2,
        maxTravellers: 12,
        featured: true,
        price: 6075,
        destinations: ['tarangire', 'serengeti', 'ngorongoro', 'manyara'],
        activities: ['game-drives', 'migration', 'cultural-visit'],
        itinerary: [
            { title: 'Tarangire National Park', description: 'Game drive among baobabs and elephants.', accommodation: 'Karatu lodge', meals: 'Full board' },
            { title: 'Serengeti National Park', description: 'Drive to the Serengeti via the Ngorongoro Conservation Area.', accommodation: 'Serengeti central camp', meals: 'Full board' },
            { title: 'Serengeti', description: 'Full-day game viewing in the central Serengeti.', accommodation: 'Serengeti central camp', meals: 'Full board' },
            { title: 'Serengeti', description: 'Another full day following the wildlife movements.', accommodation: 'Serengeti central camp', meals: 'Full board' },
            { title: 'Ngorongoro Crater', description: 'Descend into the crater for a full day of game viewing.', accommodation: 'Ngorongoro lodge', meals: 'Full board' },
            { title: 'Lake Manyara', description: 'Game drive in Lake Manyara National Park.', accommodation: 'Manyara lodge', meals: 'Full board' },
            { title: 'Cultural day', description: 'Maasai village and local community projects.', accommodation: 'Manyara lodge', meals: 'Full board' },
            { title: 'Return to Arusha', description: 'Drive back to Arusha and the airport.', meals: 'Breakfast' },
        ],
    },
    {
        key: 'budget-camping',
        name: 'Budget Camping Safari',
        slug: 'budget-camping-safari',
        category: 'northern',
        media: 'tarangire',
        summary: 'Big adventures on a small budget: Tarangire, Manyara and Ngorongoro under canvas.',
        description: 'A hands-on camping safari for travellers who want authentic bush nights without compromising on wildlife. Comfortable dome tents, camp cooks and experienced guides.',
        days: 4,
        nights: 3,
        difficulty: 'Easy',
        minTravellers: 2,
        maxTravellers: 14,
        featured: false,
        price: 950,
        destinations: ['tarangire', 'manyara', 'ngorongoro'],
        activities: ['game-drives', 'camping'],
        itinerary: [
            { title: 'Arusha to Tarangire', description: 'Game drive among elephants and baobabs, then camp under the stars.', accommodation: 'Public campsite', meals: 'Full board' },
            { title: 'Lake Manyara', description: 'Full-day game drive and camp overnight.', accommodation: 'Public campsite', meals: 'Full board' },
            { title: 'Ngorongoro Crater', description: 'Early descent into the crater with a picnic lunch.', accommodation: 'Crater rim campsite', meals: 'Full board' },
            { title: 'Return to Arusha', description: 'Morning at leisure and drive back to Arusha.', meals: 'Breakfast' },
        ],
    },
    {
        key: 'mikumi',
        name: 'Mikumi National Park Safari',
        slug: 'mikumi-national-park-safari',
        category: 'southern',
        media: 'ruaha',
        summary: 'An easy escape from Dar es Salaam into the Mkata Floodplain and its reliable wildlife.',
        description: 'Mikumi is one of Tanzania’s most accessible parks, perfect for a short break from Dar es Salaam. Expect elephants, giraffe, zebra, lion and excellent birdlife.',
        days: 4,
        nights: 3,
        difficulty: 'Easy',
        minTravellers: 2,
        maxTravellers: 10,
        featured: false,
        price: 1500,
        destinations: ['mikumi'],
        activities: ['game-drives', 'birding'],
        itinerary: [
            { title: 'Dar es Salaam to Mikumi', description: 'Scenic drive to Mikumi and afternoon game drive on the Mkata Floodplain.', accommodation: 'Mikumi Wildlife Camp', meals: 'Full board' },
            { title: 'Full day in Mikumi', description: 'Morning and afternoon game drives plus a visit to the hippo pools.', accommodation: 'Mikumi Wildlife Camp', meals: 'Full board' },
            { title: 'Southern sector', description: 'Explore the less-visited southern sector.', accommodation: 'Mikumi Wildlife Camp', meals: 'Full board' },
            { title: 'Return to Dar es Salaam', description: 'Sunrise game drive and drive back to the city.', meals: 'Breakfast' },
        ],
    },
    {
        key: 'stone-town',
        name: 'Stone Town Cultural Experience',
        slug: 'stone-town-cultural-experience',
        category: 'zanzibar',
        media: 'zanzibar',
        summary: 'Spices, history and sunset dhows in Zanzibar’s UNESCO-listed Stone Town.',
        description: 'Immerse yourself in Zanzibar’s Swahili, Arab and European heritage. Visit spice farms, historic sites and markets with a local guide, and finish with a sunset dhow cruise.',
        days: 4,
        nights: 3,
        difficulty: 'Easy',
        minTravellers: 1,
        maxTravellers: 12,
        featured: false,
        price: 850,
        destinations: ['zanzibar'],
        activities: ['spice-tour', 'cultural-visit', 'dhow-cruise'],
        itinerary: [
            { title: 'Arrival and Stone Town', description: 'Airport transfer, boutique hotel and guided walking tour of Stone Town.', accommodation: 'Stone Town boutique hotel', meals: 'Bed & breakfast' },
            { title: 'Spice tour and Prison Island', description: 'Visit a spice farm and take a boat to Prison Island to see giant tortoises.', accommodation: 'Stone Town boutique hotel', meals: 'Breakfast & lunch' },
            { title: 'History and sunset dhow', description: 'Slave market memorial, museums and a sunset dhow cruise.', accommodation: 'Stone Town boutique hotel', meals: 'Breakfast' },
            { title: 'Departure', description: 'Morning at leisure and airport transfer.', meals: 'Breakfast' },
        ],
    },
    {
        key: 'zanzibar-beach',
        name: 'Zanzibar Beach Paradise',
        slug: 'zanzibar-beach-paradise',
        category: 'zanzibar',
        media: 'zanzibar',
        summary: 'Powder-white sand and turquoise water on Zanzibar’s northern beaches.',
        description: 'Unwind at Nungwi and Kendwa with optional snorkelling, diving and sunset cruises. Combine with a safari for the perfect bush-and-beach holiday.',
        days: 6,
        nights: 5,
        difficulty: 'Easy',
        minTravellers: 1,
        maxTravellers: 20,
        featured: true,
        price: 1200,
        destinations: ['zanzibar'],
        activities: ['snorkelling', 'dhow-cruise', 'beach'],
        itinerary: [
            { title: 'Arrival', description: 'Transfer to your beach hotel and settle in.', accommodation: 'Nungwi beach resort', meals: 'Half board' },
            { title: 'Beach day', description: 'Relax on the beach or book a diving course.', accommodation: 'Nungwi beach resort', meals: 'Half board' },
            { title: 'Snorkelling trip', description: 'Boat trip to Mnemba Atoll for snorkelling.', accommodation: 'Nungwi beach resort', meals: 'Half board' },
            { title: 'Sunset dhow', description: 'Free morning and sunset dhow cruise.', accommodation: 'Nungwi beach resort', meals: 'Half board' },
            { title: 'Island life', description: 'Optional spa, kite-surfing or village visit.', accommodation: 'Nungwi beach resort', meals: 'Half board' },
            { title: 'Departure', description: 'Transfer to Zanzibar airport.', meals: 'Breakfast' },
        ],
    },
    {
        key: 'kilimanjaro',
        name: 'Kilimanjaro Machame Route',
        slug: 'kilimanjaro-machame-route',
        category: 'trekking',
        media: 'kilimanjaro',
        summary: 'Climb Africa’s highest peak on the scenic Machame route with experienced mountain guides.',
        description: 'The Machame route offers excellent acclimatisation and spectacular scenery. Our licensed guides, porters and mountain cooks support you all the way to Uhuru Peak (5,895 m).',
        days: 8,
        nights: 7,
        difficulty: 'Challenging',
        minTravellers: 1,
        maxTravellers: 15,
        featured: true,
        price: 2200,
        destinations: ['kilimanjaro'],
        activities: ['trekking', 'summit'],
        itinerary: [
            { title: 'Machame Gate to Machame Camp', description: 'Trek through the rainforest to 2,835 m.', accommodation: 'Machame Camp', meals: 'Full board' },
            { title: 'Machame Camp to Shira Camp', description: 'Ascend through moorland to the Shira Plateau (3,750 m).', accommodation: 'Shira Camp', meals: 'Full board' },
            { title: 'Shira to Barranco Camp', description: 'Acclimatisation via Lava Tower (4,600 m).', accommodation: 'Barranco Camp', meals: 'Full board' },
            { title: 'Barranco to Karanga Camp', description: 'Climb the Barranco Wall and cross to Karanga.', accommodation: 'Karanga Camp', meals: 'Full board' },
            { title: 'Karanga to Barafu Camp', description: 'Short trek to high camp at 4,670 m and early rest.', accommodation: 'Barafu Camp', meals: 'Full board' },
            { title: 'Summit day', description: 'Midnight start to Uhuru Peak, then descend to Mweka Camp.', accommodation: 'Mweka Camp', meals: 'Full board' },
            { title: 'Mweka Camp to Mweka Gate', description: 'Descend through the forest and collect certificates.', accommodation: 'Arusha hotel', meals: 'Breakfast & lunch' },
            { title: 'Departure', description: 'Airport transfer.', meals: 'Breakfast' },
        ],
    },
    {
        key: 'mount-meru',
        name: 'Mount Meru Trek',
        slug: 'mount-meru-trek',
        category: 'trekking',
        media: 'kilimanjaro',
        summary: 'A rewarding four-day acclimatisation trek on Tanzania’s second-highest mountain.',
        description: 'Mount Meru (4,566 m) is a superb standalone trek and the ideal warm-up for Kilimanjaro. Trek through Arusha National Park with armed rangers and enjoy sunrise views of Kilimanjaro.',
        days: 4,
        nights: 3,
        difficulty: 'Moderate',
        minTravellers: 1,
        maxTravellers: 12,
        featured: false,
        price: 950,
        destinations: ['meru'],
        activities: ['trekking', 'summit', 'walking-safari'],
        itinerary: [
            { title: 'Momella Gate to Miriakamba Hut', description: 'Trek through open grassland with wildlife, 2,514 m.', accommodation: 'Miriakamba Hut', meals: 'Full board' },
            { title: 'Miriakamba to Saddle Hut', description: 'Ascend through montane forest to 3,570 m.', accommodation: 'Saddle Hut', meals: 'Full board' },
            { title: 'Summit and descent', description: 'Sunrise summit at Socialist Peak (4,566 m), then descend to Miriakamba.', accommodation: 'Miriakamba Hut', meals: 'Full board' },
            { title: 'Return to Arusha', description: 'Descend to Momella Gate and transfer to Arusha.', meals: 'Breakfast & lunch' },
        ],
    },
];
const DESTINATION_SEEDS = [
    { key: 'serengeti', name: 'Serengeti National Park', slug: 'serengeti-national-park', region: 'Northern Tanzania', summary: 'Endless plains, the Great Migration and the highest concentration of predators in Africa.', bestTime: 'June to October' },
    { key: 'ngorongoro', name: 'Ngorongoro Crater', slug: 'ngorongoro-crater', region: 'Northern Tanzania', summary: 'A UNESCO World Heritage Site and a natural amphitheatre teeming with wildlife.', bestTime: 'Year-round' },
    { key: 'tarangire', name: 'Tarangire National Park', slug: 'tarangire-national-park', region: 'Northern Tanzania', summary: 'Giant baobabs, huge elephant herds and a lifeline river in the dry season.', bestTime: 'June to October' },
    { key: 'manyara', name: 'Lake Manyara National Park', slug: 'lake-manyara-national-park', region: 'Northern Tanzania', summary: 'Groundwater forest, tree-climbing lions and flocks of flamingos.', bestTime: 'June to October' },
    { key: 'selous', name: 'Nyerere National Park (Selous)', slug: 'nyerere-national-park', region: 'Southern Tanzania', summary: 'One of Africa’s largest reserves, with boat safaris on the Rufiji River.', bestTime: 'June to October' },
    { key: 'ruaha', name: 'Ruaha National Park', slug: 'ruaha-national-park', region: 'Southern Tanzania', summary: 'Tanzania’s largest park: rugged, remote and superb for predators.', bestTime: 'June to October' },
    { key: 'katavi', name: 'Katavi National Park', slug: 'katavi-national-park', region: 'Western Tanzania', summary: 'True wilderness with enormous hippo pods and buffalo herds.', bestTime: 'July to October' },
    { key: 'mahale', name: 'Mahale Mountains', slug: 'mahale-mountains', region: 'Western Tanzania', summary: 'Rainforest chimpanzees and white-sand beaches on Lake Tanganyika.', bestTime: 'May to October' },
    { key: 'mikumi', name: 'Mikumi National Park', slug: 'mikumi-national-park', region: 'Southern Tanzania', summary: 'Accessible from Dar es Salaam, with reliable wildlife on the Mkata Floodplain.', bestTime: 'Year-round' },
    { key: 'zanzibar', name: 'Zanzibar', slug: 'zanzibar', region: 'Indian Ocean', summary: 'Spice Island beaches, Stone Town history and turquoise water.', bestTime: 'June to October, January to February' },
    { key: 'kilimanjaro', name: 'Mount Kilimanjaro', slug: 'mount-kilimanjaro', region: 'Northern Tanzania', summary: 'Africa’s highest peak and the world’s tallest free-standing mountain.', bestTime: 'January to March, June to October' },
    { key: 'meru', name: 'Mount Meru', slug: 'mount-meru', region: 'Northern Tanzania', summary: 'Tanzania’s second-highest mountain and a superb acclimatisation trek.', bestTime: 'June to February' },
];
const ACTIVITY_SEEDS = [
    { key: 'game-drives', name: 'Game drives', slug: 'game-drives', category: 'Wildlife', summary: 'Expert-guided 4x4 game drives in Tanzania’s national parks.' },
    { key: 'migration', name: 'Great Migration', slug: 'great-migration', category: 'Wildlife', summary: 'Follow the wildebeest and zebra migration across the Serengeti.' },
    { key: 'balloon', name: 'Hot air balloon safari', slug: 'hot-air-balloon-safari', category: 'Adventure', summary: 'Sunrise balloon flights over the Serengeti plains.' },
    { key: 'walking-safari', name: 'Walking safaris', slug: 'walking-safaris', category: 'Adventure', summary: 'Track wildlife on foot with armed rangers and expert guides.' },
    { key: 'cultural-visit', name: 'Cultural visits', slug: 'cultural-visits', category: 'Culture', summary: 'Meet Maasai and local communities and learn about their traditions.' },
    { key: 'boat-safari', name: 'Boat safaris', slug: 'boat-safaris', category: 'Wildlife', summary: 'Explore rivers and lakes by boat for a different perspective.' },
    { key: 'birding', name: 'Birdwatching', slug: 'birdwatching', category: 'Nature', summary: 'Tanzania is home to more than 1,100 bird species.' },
    { key: 'chimpanzee-trekking', name: 'Chimpanzee trekking', slug: 'chimpanzee-trekking', category: 'Wildlife', summary: 'Observe habituated chimpanzees in the Mahale and Gombe forests.' },
    { key: 'snorkelling', name: 'Snorkelling & diving', slug: 'snorkelling-diving', category: 'Beach', summary: 'Discover coral reefs and tropical fish around Zanzibar.' },
    { key: 'spice-tour', name: 'Spice tours', slug: 'spice-tours', category: 'Culture', summary: 'Taste and learn about Zanzibar’s famous spices.' },
    { key: 'dhow-cruise', name: 'Sunset dhow cruise', slug: 'sunset-dhow-cruise', category: 'Beach', summary: 'Sail the Indian Ocean on a traditional wooden dhow.' },
    { key: 'beach', name: 'Beach relaxation', slug: 'beach-relaxation', category: 'Beach', summary: 'Unwind on Zanzibar’s white-sand beaches.' },
    { key: 'trekking', name: 'Mountain trekking', slug: 'mountain-trekking', category: 'Trekking', summary: 'Licensed guides and porters for Kilimanjaro and Mount Meru.' },
    { key: 'summit', name: 'Summit expeditions', slug: 'summit-expeditions', category: 'Trekking', summary: 'Reach Uhuru Peak or Socialist Peak with expert support.' },
    { key: 'camping', name: 'Camping safaris', slug: 'camping-safaris', category: 'Adventure', summary: 'Sleep under the stars in Tanzania’s national parks.' },
];
const CUSTOMER_SEEDS = [
    { key: 'anderson', firstName: 'James', lastName: 'Anderson', email: 'james.anderson@example.com', phone: '+61 412 555 018', country: 'Australia', channel: 'email' },
    { key: 'rossi', firstName: 'Elena', lastName: 'Rossi', email: 'elena.rossi@example.com', phone: '+39 333 555 014', country: 'Italy', channel: 'whatsapp' },
    { key: 'chen', firstName: 'Michael', lastName: 'Chen', email: 'michael.chen@example.com', phone: '+65 8123 4455', country: 'Singapore', channel: 'email' },
    { key: 'dubois', firstName: 'Sophie', lastName: 'Dubois', email: 'sophie.dubois@example.com', phone: '+33 6 12 34 56 78', country: 'France', channel: 'email' },
    { key: 'thompson', firstName: 'David', lastName: 'Thompson', email: 'david.thompson@example.com', phone: '+44 7700 900123', country: 'United Kingdom', channel: 'email' },
    { key: 'muller', firstName: 'Lukas', lastName: 'Müller', email: 'lukas.mueller@example.com', phone: '+49 151 2345 6789', country: 'Germany', channel: 'whatsapp' },
    { key: 'tanaka', firstName: 'Aiko', lastName: 'Tanaka', email: 'aiko.tanaka@example.com', phone: '+81 90 1234 5678', country: 'Japan', channel: 'email' },
    { key: 'mendez', firstName: 'Carlos', lastName: 'Mendez', email: 'carlos.mendez@example.com', phone: '+34 612 345 678', country: 'Spain', channel: 'phone' },
    { key: 'sharma', firstName: 'Priya', lastName: 'Sharma', email: 'priya.sharma@example.com', phone: '+91 98765 43210', country: 'India', channel: 'whatsapp' },
    { key: 'brown', firstName: 'Olivia', lastName: 'Brown', email: 'olivia.brown@example.com', phone: '+1 416 555 0198', country: 'Canada', channel: 'email' },
];
const ENQUIRY_SEEDS = [
    { key: 'e1', customer: 'anderson', product: 'serengeti-migration', source: 'website', status: 'converted', travelStart: 45, travelEnd: 51, adults: 2, children: 1, budget: 8000, notes: 'Family with one child (9). Interested in the balloon add-on.' },
    { key: 'e2', customer: 'dubois', product: 'ngorongoro', source: 'email', status: 'converted', travelStart: 20, travelEnd: 23, adults: 2, children: 0, budget: 4200 },
    { key: 'e3', customer: 'chen', product: 'northern-classic', source: 'referral', status: 'quotation_sent', travelStart: 90, travelEnd: 97, adults: 4, children: 2, budget: 26000, followUp: 3, notes: 'Travelling with two teenagers; wants family-friendly lodges.' },
    { key: 'e4', customer: 'rossi', product: 'zanzibar-beach', source: 'whatsapp', status: 'quotation_in_progress', travelStart: 120, travelEnd: 125, adults: 2, children: 0, budget: 3000 },
    { key: 'e5', customer: 'thompson', product: 'tarangire-manyara', source: 'website', status: 'converted', travelStart: -60, travelEnd: -55, adults: 2, children: 0, budget: 4500 },
    { key: 'e6', customer: 'mendez', product: 'ruaha', source: 'email', status: 'lost', travelStart: 70, travelEnd: 76, adults: 2, children: 0, budget: 5000, lostReason: 'Chose a competitor offering a direct charter from Zanzibar.' },
    { key: 'e7', customer: 'tanaka', product: 'stone-town', source: 'website', status: 'follow_up', travelStart: 35, travelEnd: 38, adults: 2, children: 0, budget: 2000, followUp: -2, notes: 'Quote expired; follow up with an updated validity date.' },
    { key: 'e8', customer: 'brown', product: 'kilimanjaro', source: 'referral', status: 'converted', travelStart: 70, travelEnd: 77, adults: 2, children: 0, budget: 5000 },
    { key: 'e9', customer: 'thompson', product: 'serengeti-migration', source: 'website', status: 'new', travelStart: 150, travelEnd: 156, adults: 2, children: 0, budget: 7000 },
    { key: 'e10', customer: 'muller', product: 'katavi-mahale', source: 'website', status: 'new', travelStart: 180, travelEnd: 189, adults: 2, children: 0, budget: 10000 },
    { key: 'e11', customer: 'sharma', product: 'mikumi', source: 'whatsapp', status: 'contacted', travelStart: 25, travelEnd: 28, adults: 3, children: 0, budget: 4500, followUp: 2 },
];
const QUOTE_SEEDS = [
    {
        key: 'q1',
        customer: 'anderson',
        enquiry: 'e1',
        product: 'serengeti-migration',
        status: 'accepted',
        travelStart: 45,
        travelEnd: 51,
        adults: 2,
        children: 1,
        validityDays: 21,
        items: [
            { description: 'Serengeti Great Migration Safari – 2 adults', quantity: '2', unitPrice: '3150.00' },
            { description: 'Child rate (9 years) – sharing with parents', quantity: '1', unitPrice: '1800.00' },
            { description: 'Serengeti hot air balloon safari', quantity: '3', unitPrice: '250.00' },
        ],
    },
    {
        key: 'q2',
        customer: 'dubois',
        enquiry: 'e2',
        product: 'ngorongoro',
        status: 'accepted',
        travelStart: 20,
        travelEnd: 23,
        adults: 2,
        children: 0,
        validityDays: 14,
        items: [{ description: 'Ngorongoro Crater Explorer – 2 adults', quantity: '2', unitPrice: '1850.00' }],
    },
    {
        key: 'q3',
        customer: 'chen',
        enquiry: 'e3',
        product: 'northern-classic',
        status: 'sent',
        travelStart: 90,
        travelEnd: 97,
        adults: 4,
        children: 2,
        validityDays: 30,
        notes: 'Family rooms requested at all lodges. Quote includes private vehicle.',
        items: [
            { description: 'Northern Circuit Classic – 4 adults', quantity: '4', unitPrice: '6075.00' },
            { description: 'Child rate – 2 children sharing', quantity: '2', unitPrice: '3500.00' },
        ],
    },
    {
        key: 'q4',
        customer: 'rossi',
        enquiry: 'e4',
        product: 'zanzibar-beach',
        status: 'draft',
        travelStart: 120,
        travelEnd: 125,
        adults: 2,
        children: 0,
        validityDays: 14,
        items: [{ description: 'Zanzibar Beach Paradise – 2 adults', quantity: '2', unitPrice: '1200.00' }],
    },
    {
        key: 'q5',
        customer: 'thompson',
        enquiry: 'e5',
        product: 'tarangire-manyara',
        status: 'accepted',
        travelStart: -60,
        travelEnd: -55,
        adults: 2,
        children: 0,
        validityDays: 14,
        items: [{ description: 'Tarangire & Lake Manyara Safari – 2 adults', quantity: '2', unitPrice: '2100.00' }],
    },
    {
        key: 'q6',
        customer: 'mendez',
        enquiry: 'e6',
        product: 'ruaha',
        status: 'rejected',
        travelStart: 70,
        travelEnd: 76,
        adults: 2,
        children: 0,
        validityDays: 14,
        notes: 'Client chose an alternative itinerary.',
        items: [{ description: 'Ruaha National Park Safari – 2 adults', quantity: '2', unitPrice: '2600.00' }],
    },
    {
        key: 'q7',
        customer: 'tanaka',
        enquiry: 'e7',
        product: 'stone-town',
        status: 'expired',
        travelStart: 35,
        travelEnd: 38,
        adults: 2,
        children: 0,
        validityDays: 5,
        items: [{ description: 'Stone Town Cultural Experience – 2 adults', quantity: '2', unitPrice: '850.00' }],
    },
    {
        key: 'q8',
        customer: 'brown',
        enquiry: 'e8',
        product: 'kilimanjaro',
        status: 'accepted',
        travelStart: 70,
        travelEnd: 77,
        adults: 2,
        children: 0,
        validityDays: 30,
        items: [
            { description: 'Kilimanjaro Machame Route – 2 climbers', quantity: '2', unitPrice: '2200.00' },
            { description: 'Mountain equipment hire and tipping kitty', quantity: '2', unitPrice: '180.00' },
        ],
    },
];
export async function seedDatabase(options = {}) {
    if (config.isProduction) {
        throw new Error('Refusing to seed a production database. Use the create-admin command for production setup.');
    }
    const db = getDb();
    const existing = await db.query('SELECT count(*)::int AS count FROM products');
    if ((existing.rows[0]?.count ?? 0) > 0 && !options.reset) {
        return { skipped: true };
    }
    const password = config.seedAdminPassword;
    const [ownerHash, managerHash] = await Promise.all([hashPassword(password), hashPassword(password)]);
    const counts = await db.transaction(async (tx) => {
        if (options.reset)
            await clearSeedData(tx);
        const media = await importMedia(tx);
        const ownerId = await upsertAdmin(tx, config.seedAdminEmail, config.seedAdminName, ownerHash, 'owner');
        const managerId = await upsertAdmin(tx, 'manager@ernizaafricasafaris.com', 'Erniza Manager', managerHash, 'manager');
        await tx.query(`INSERT INTO settings (key, value, updated_by, updated_at)
       VALUES ('company', $1, $2, now()), ('billing', $3, $2, now()), ('notifications', $4, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`, [
            JSON.stringify(DEFAULT_SETTINGS.company),
            ownerId,
            JSON.stringify(DEFAULT_SETTINGS.billing),
            JSON.stringify(DEFAULT_SETTINGS.notifications),
        ]);
        for (const definition of PAGE_DEFINITIONS) {
            await tx.query(`INSERT INTO website_pages (slug, title, content, status, seo_title, seo_description, published_at, updated_by)
         VALUES ($1,$2,$3,'published',$4,$5,now(),$6)`, [
                definition.slug,
                definition.title,
                JSON.stringify(DEFAULT_PAGE_CONTENT[definition.slug] ?? {}),
                `${definition.title} | Erniza Africa Safaris`,
                definition.description,
                ownerId,
            ]);
        }
        const categoryIds = new Map();
        const categories = [
            { key: 'northern', name: 'Northern Circuit', slug: 'northern-circuit', description: 'Serengeti, Ngorongoro, Tarangire and Lake Manyara.' },
            { key: 'southern', name: 'Southern Circuit', slug: 'southern-circuit', description: 'Nyerere, Ruaha and Mikumi national parks.' },
            { key: 'western', name: 'Western Circuit', slug: 'western-circuit', description: 'Katavi, Mahale and Gombe.' },
            { key: 'zanzibar', name: 'Zanzibar & Coast', slug: 'zanzibar-and-coast', description: 'Beach holidays and cultural experiences.' },
            { key: 'trekking', name: 'Mountain Trekking', slug: 'mountain-trekking', description: 'Kilimanjaro, Meru and guided treks.' },
        ];
        for (let index = 0; index < categories.length; index += 1) {
            const category = categories[index];
            const result = await tx.query(`INSERT INTO product_categories (name, slug, description, sort_order) VALUES ($1,$2,$3,$4) RETURNING id`, [category.name, category.slug, category.description, index]);
            categoryIds.set(category.key, result.rows[0].id);
        }
        const destinationIds = new Map();
        for (const destination of DESTINATION_SEEDS) {
            const result = await tx.query(`INSERT INTO destinations (name, slug, region, country, summary, description, best_time, status, featured, published_at)
         VALUES ($1,$2,$3,'Tanzania',$4,$5,$6,'published',$7,now()) RETURNING id`, [
                destination.name,
                destination.slug,
                destination.region,
                destination.summary,
                `${destination.summary} Erniza Africa Safaris arranges private guided visits with experienced local guides and carefully selected accommodation.`,
                destination.bestTime,
                ['serengeti', 'ngorongoro', 'zanzibar', 'kilimanjaro'].includes(destination.key),
            ]);
            destinationIds.set(destination.key, result.rows[0].id);
        }
        const activityIds = new Map();
        for (const activity of ACTIVITY_SEEDS) {
            const result = await tx.query(`INSERT INTO activities (name, slug, category, summary, description, status)
         VALUES ($1,$2,$3,$4,$5,'published') RETURNING id`, [
                activity.name,
                activity.slug,
                activity.category,
                activity.summary,
                `${activity.summary} Available on selected Erniza itineraries and as a custom add-on.`,
            ]);
            activityIds.set(activity.key, result.rows[0].id);
        }
        const productIds = new Map();
        for (const product of PRODUCT_SEEDS) {
            const heroId = media.get(product.media)?.id ?? null;
            const result = await tx.query(`INSERT INTO products
          (category_id, name, slug, summary, description, highlights, inclusions, exclusions,
           duration_days, duration_nights, difficulty, min_travellers, max_travellers, accommodation_info,
           seo_title, seo_description, status, featured, hero_image_id, published_at, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'published',$17,$18,now(),$19,$19)
         RETURNING id`, [
                categoryIds.get(product.category) ?? null,
                product.name,
                product.slug,
                product.summary,
                product.description,
                JSON.stringify([
                    'Private safari with an expert English-speaking guide',
                    'All park fees and conservation levies',
                    'Comfortable accommodation as per itinerary',
                    'Airport transfers and 4x4 safari vehicle',
                    'Drinking water throughout the safari',
                ]),
                JSON.stringify([
                    'Accommodation and meals as specified',
                    'Professional guide and safari vehicle',
                    'Park entry and concession fees',
                    'Bottled drinking water',
                    'Government taxes and levies',
                ]),
                JSON.stringify([
                    'International flights and visa fees',
                    'Travel insurance',
                    'Alcoholic and premium beverages',
                    'Optional activities unless stated',
                    'Tips and personal items',
                ]),
                product.days,
                product.nights,
                product.difficulty,
                product.minTravellers,
                product.maxTravellers,
                'Accommodation is selected to match the itinerary and budget. Lodges and camps are subject to availability at the time of booking.',
                `${product.name} | Erniza Africa Safaris`,
                product.summary,
                product.featured,
                heroId,
                ownerId,
            ]);
            const productId = result.rows[0].id;
            productIds.set(product.key, productId);
            for (let index = 0; index < product.destinations.length; index += 1) {
                const destinationId = destinationIds.get(product.destinations[index]);
                if (destinationId) {
                    await tx.query(`INSERT INTO product_destinations (product_id, destination_id, sort_order) VALUES ($1,$2,$3)`, [productId, destinationId, index]);
                }
            }
            for (const activityKey of product.activities) {
                const activityId = activityIds.get(activityKey);
                if (activityId) {
                    await tx.query(`INSERT INTO product_activities (product_id, activity_id) VALUES ($1,$2)`, [
                        productId,
                        activityId,
                    ]);
                }
            }
            for (const [key, asset] of media) {
                if (key === product.media) {
                    await tx.query(`INSERT INTO product_media (product_id, media_id, sort_order) VALUES ($1,$2,0)`, [
                        productId,
                        asset.id,
                    ]);
                }
            }
            const itinerary = await tx.query(`INSERT INTO itineraries (product_id, title, notes) VALUES ($1,$2,$3) RETURNING id`, [productId, `${product.name} – day by day`, 'Itinerary may be adjusted to match flight times and lodge availability.']);
            for (let index = 0; index < product.itinerary.length; index += 1) {
                const day = product.itinerary[index];
                await tx.query(`INSERT INTO itinerary_days (itinerary_id, day_number, title, description, accommodation, meals)
           VALUES ($1,$2,$3,$4,$5,$6)`, [itinerary.rows[0].id, index + 1, day.title, day.description, day.accommodation ?? null, day.meals ?? null]);
            }
            await tx.query(`INSERT INTO product_media (product_id, media_id, sort_order)
         SELECT $1, id, 1 FROM media WHERE id <> $2 ORDER BY created_at LIMIT 2
         ON CONFLICT DO NOTHING`, [productId, heroId ?? '00000000-0000-0000-0000-000000000000']);
        }
        const customerIds = new Map();
        for (const customer of CUSTOMER_SEEDS) {
            const reference = await nextReference(tx, 'CUS');
            const result = await tx.query(`INSERT INTO customers (reference, first_name, last_name, email, phone, whatsapp, country, preferred_channel, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`, [
                reference,
                customer.firstName,
                customer.lastName,
                customer.email,
                customer.phone,
                customer.channel === 'whatsapp' ? customer.phone : null,
                customer.country,
                customer.channel,
                customer.key === 'anderson' ? 'Repeat guest. Prefers early-morning game drives.' : null,
            ]);
            customerIds.set(customer.key, result.rows[0].id);
        }
        const enquiryIds = new Map();
        for (const enquiry of ENQUIRY_SEEDS) {
            const reference = await nextReference(tx, 'ENQ');
            const customerId = customerIds.get(enquiry.customer);
            const productId = productIds.get(enquiry.product) ?? null;
            const result = await tx.query(`INSERT INTO enquiries
          (reference, customer_id, product_id, source, status, travel_date_start, travel_date_end,
           adults, children, country, accommodation_preference, budget_amount, budget_currency,
           special_requirements, internal_notes, follow_up_date, assigned_to, lost_reason, converted_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'USD',$13,$14,$15,$16,$17,$18,$19)
         RETURNING id`, [
                reference,
                customerId,
                productId,
                enquiry.source,
                enquiry.status,
                isoDate(enquiry.travelStart),
                isoDate(enquiry.travelEnd),
                enquiry.adults,
                enquiry.children,
                CUSTOMER_SEEDS.find((customer) => customer.key === enquiry.customer)?.country ?? null,
                enquiry.adults + enquiry.children > 4 ? 'Family rooms / connecting rooms' : 'Mid-range lodges',
                enquiry.budget.toFixed(2),
                enquiry.notes ?? null,
                enquiry.notes ?? null,
                enquiry.followUp !== undefined ? isoDate(enquiry.followUp) : null,
                enquiry.status === 'new' ? null : managerId,
                enquiry.lostReason ?? null,
                enquiry.status === 'converted' ? timestamp(-5) : null,
                timestamp(-Math.max(0, 40 - ENQUIRY_SEEDS.indexOf(enquiry) * 3)),
            ]);
            const enquiryId = result.rows[0].id;
            enquiryIds.set(enquiry.key, enquiryId);
            if (enquiry.notes) {
                await tx.query(`INSERT INTO enquiry_notes (enquiry_id, author_id, note) VALUES ($1,$2,$3)`, [
                    enquiryId,
                    managerId,
                    enquiry.notes,
                ]);
            }
        }
        const quoteIds = new Map();
        for (const quote of QUOTE_SEEDS) {
            const reference = await nextReference(tx, 'QUO');
            const customerId = customerIds.get(quote.customer);
            const productId = productIds.get(quote.product) ?? null;
            const issued = quote.status !== 'draft';
            const result = await tx.query(`INSERT INTO quotations
          (reference, customer_id, enquiry_id, primary_product_id, status, current_version, currency,
           travel_date_start, travel_date_end, adults, children, accommodation, itinerary, special_arrangements,
           payment_terms, validity_until, notes, created_by, updated_by, issued_at, accepted_at, rejected_at, created_at)
         VALUES ($1,$2,$3,$4,$5,1,'USD',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16,$17,$18,$19,$20)
         RETURNING id`, [
                reference,
                customerId,
                enquiryIds.get(quote.enquiry) ?? null,
                productId,
                quote.status,
                isoDate(quote.travelStart),
                isoDate(quote.travelEnd),
                quote.adults,
                quote.children,
                'Mid-range lodges and tented camps',
                PRODUCT_SEEDS.find((product) => product.key === quote.product)?.description ?? null,
                quote.children > 0 ? 'Family-friendly rooms and flexible game drive times.' : null,
                DEFAULT_SETTINGS.billing.defaultPaymentTerms,
                isoDate(quote.travelStart - 1 + quote.validityDays),
                quote.notes ?? null,
                ownerId,
                issued ? timestamp(-7) : null,
                quote.status === 'accepted' ? timestamp(-4) : null,
                quote.status === 'rejected' ? timestamp(-3) : null,
                timestamp(-12),
            ]);
            const quoteId = result.rows[0].id;
            const totals = await writeQuotationItems(tx, quoteId, quote.items, '0', '0');
            let versionId = null;
            if (issued) {
                const version = await createQuotationVersion(tx, quoteId, quote.status === 'accepted' ? 'accepted' : quote.status === 'rejected' ? 'rejected' : 'issued');
                versionId = version.id;
            }
            if (quote.status === 'expired') {
                await tx.query("UPDATE quotation_versions SET status = 'superseded' WHERE quotation_id = $1", [quoteId]);
            }
            quoteIds.set(quote.key, { id: quoteId, versionId, total: totals.total, reference });
        }
        const bookingIds = new Map();
        const bookingSeeds = [
            { key: 'b1', quote: 'q1', status: 'confirmed', start: 45, end: 51, paid: ['2040.00', '1500.00'], tour: 'scheduled' },
            { key: 'b2', quote: 'q2', status: 'confirmed', start: 20, end: 23, paid: ['1850.00'], tour: 'scheduled' },
            { key: 'b3', quote: 'q5', status: 'completed', start: -60, end: -55, paid: ['4200.00'], tour: 'completed' },
            { key: 'b4', quote: 'q8', status: 'pending_confirmation', start: 70, end: 77, paid: [], tour: 'scheduled' },
        ];
        for (const booking of bookingSeeds) {
            const quote = QUOTE_SEEDS.find((item) => item.key === booking.quote);
            const quoteRecord = quoteIds.get(booking.quote);
            const customerId = customerIds.get(quote.customer);
            const productId = productIds.get(quote.product) ?? null;
            const reference = await nextReference(tx, 'BKG');
            const snapshot = {
                quotation: {
                    id: quoteRecord.id,
                    reference: quoteRecord.reference,
                    total: quoteRecord.total,
                    currency: 'USD',
                },
                items: quote.items,
                customer: CUSTOMER_SEEDS.find((customer) => customer.key === quote.customer),
                capturedAt: new Date().toISOString(),
            };
            const result = await tx.query(`INSERT INTO bookings
          (reference, customer_id, quotation_id, quotation_version_id, product_id, status,
           travel_date_start, travel_date_end, adults, children, currency, total_amount,
           accommodation, itinerary, special_requirements, operational_notes, guide_name, driver_name, vehicle,
           snapshot, confirmed_at, completed_at, created_by, updated_by, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'USD',$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$22,$23)
         RETURNING id`, [
                reference,
                customerId,
                quoteRecord.id,
                quoteRecord.versionId,
                productId,
                booking.status,
                isoDate(booking.start),
                isoDate(booking.end),
                quote.adults,
                quote.children,
                quoteRecord.total,
                'Mid-range lodges and tented camps',
                PRODUCT_SEEDS.find((product) => product.key === quote.product)?.description ?? null,
                'Please advise any dietary requirements at least 14 days before arrival.',
                booking.status === 'completed' ? 'Completed without incident. Feedback received.' : 'Confirm final rooming list 30 days before departure.',
                'Joseph Mollel',
                'Emanuel Kileo',
                'Toyota Land Cruiser – 7 seater',
                JSON.stringify(snapshot),
                booking.status === 'pending_confirmation' ? null : timestamp(-4),
                booking.status === 'completed' ? timestamp(-54) : null,
                ownerId,
                timestamp(-5),
            ]);
            const bookingId = result.rows[0].id;
            bookingIds.set(booking.key, bookingId);
            const customer = CUSTOMER_SEEDS.find((item) => item.key === quote.customer);
            await tx.query(`INSERT INTO booking_travellers (booking_id, first_name, last_name, email, phone, nationality, is_lead)
         VALUES ($1,$2,$3,$4,$5,$6,true)`, [bookingId, customer.firstName, customer.lastName, customer.email, customer.phone, customer.country]);
            const paymentMethods = ['bank_transfer', 'card'];
            for (let index = 0; index < booking.paid.length; index += 1) {
                const paymentReference = await nextReference(tx, 'PAY');
                const receiptNumber = await nextReference(tx, 'RCP');
                await tx.query(`INSERT INTO payments
            (reference, receipt_number, booking_id, customer_id, type, method, amount, currency, paid_at,
             external_reference, notes, recorded_by, created_at)
           VALUES ($1,$2,$3,$4,'payment',$5,$6,'USD',$7,$8,$9,$10,$11)`, [
                    paymentReference,
                    receiptNumber,
                    bookingId,
                    customerId,
                    paymentMethods[index % paymentMethods.length],
                    booking.paid[index],
                    isoDate(booking.start - 14 + index * 5),
                    index === 0 ? `BT-${reference.slice(-4)}` : null,
                    index === 0 ? 'Deposit received.' : 'Balance payment received.',
                    managerId,
                    timestamp(booking.start - 14 + index * 5),
                ]);
            }
            {
                const tourReference = await nextReference(tx, 'TOU');
                const tour = await tx.query(`INSERT INTO tours
            (reference, booking_id, title, status, departure_date, return_date, guide_name, driver_name, vehicle, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`, [
                    tourReference,
                    bookingId,
                    `${quote.product.replace(/-/g, ' ')} departure`,
                    booking.tour,
                    isoDate(booking.start),
                    isoDate(booking.end),
                    'Joseph Mollel',
                    'Emanuel Kileo',
                    'Toyota Land Cruiser – 7 seater',
                    'Airport pickup included. Confirm guest arrival time 48 hours before departure.',
                ]);
                await tx.query(`INSERT INTO tour_assignments (tour_id, role, name, contact) VALUES ($1,'guide',$2,$3), ($1,'driver',$4,$5)`, [tour.rows[0].id, 'Joseph Mollel', '+255 776 749 127', 'Emanuel Kileo', '+255 754 123 456']);
            }
        }
        await tx.query(`INSERT INTO customer_interactions (customer_id, enquiry_id, type, summary, occurred_at, created_by)
       VALUES ($1,$2,'call',$3,$4,$5), ($6,$7,'whatsapp',$8,$9,$5)`, [
            customerIds.get('anderson'),
            enquiryIds.get('e1'),
            'Discussed the balloon add-on and confirmed the family room configuration.',
            timestamp(-10),
            managerId,
            customerIds.get('chen'),
            enquiryIds.get('e3'),
            'Sent a WhatsApp summary of the family itinerary and followed up on passport details.',
            timestamp(-2),
        ]);
        await tx.query(`INSERT INTO audit_logs (actor_id, actor_email, action, entity_type, entity_id, changes, created_at)
       VALUES ($1,$2,'seed.completed','system',null,$3,now())`, [ownerId, config.seedAdminEmail, JSON.stringify({ seededAt: new Date().toISOString() })]);
        const count = async (table) => {
            const result = await tx.query(`SELECT count(*)::int AS count FROM ${table}`);
            return result.rows[0]?.count ?? 0;
        };
        return {
            products: await count('products'),
            destinations: await count('destinations'),
            activities: await count('activities'),
            customers: await count('customers'),
            enquiries: await count('enquiries'),
            quotations: await count('quotations'),
            bookings: await count('bookings'),
            payments: await count('payments'),
            tours: await count('tours'),
            pages: await count('website_pages'),
            media: await count('media'),
        };
    });
    return { skipped: false, counts };
}
async function importMedia(tx) {
    const imported = new Map();
    const assetRoot = assetCandidates.find((candidate) => existsSync(path.join(candidate, 'serengeti')));
    if (!assetRoot)
        return imported;
    for (const item of MEDIA_SEEDS) {
        const filePath = path.join(assetRoot, item.file);
        try {
            const buffer = await fs.readFile(filePath);
            const stored = await storeImage({
                buffer,
                mimetype: filePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg',
                size: buffer.length,
                originalname: path.basename(filePath),
            });
            const result = await tx.query(`INSERT INTO media (storage_bucket, storage_path, file_name, mime_type, size_bytes, width, height, alt_text)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`, [stored.bucket, stored.path, stored.fileName, stored.mimeType, stored.sizeBytes, stored.width, stored.height, item.alt]);
            imported.set(item.key, { id: result.rows[0].id });
        }
        catch (error) {
            // Seed data should still load when an image is unavailable.
            // eslint-disable-next-line no-console
            console.warn(`Could not import seed image ${item.file}:`, error.message);
        }
    }
    return imported;
}
async function upsertAdmin(tx, email, fullName, passwordHash, role) {
    const existing = await tx.query('SELECT id FROM admin_users WHERE lower(email) = lower($1)', [email]);
    if (existing.rows[0]) {
        await tx.query(`UPDATE admin_users SET password_hash = $2, full_name = $3, role = $4, is_active = true, updated_at = now()
        WHERE id = $1`, [existing.rows[0].id, passwordHash, fullName, role]);
        return existing.rows[0].id;
    }
    const result = await tx.query(`INSERT INTO admin_users (email, password_hash, full_name, role) VALUES ($1,$2,$3,$4) RETURNING id`, [email, passwordHash, fullName, role]);
    return result.rows[0].id;
}
async function clearSeedData(tx) {
    const tables = [
        'tour_assignments',
        'tours',
        'payment_adjustments',
        'payments',
        'invoice_items',
        'invoices',
        'booking_travellers',
        'booking_itineraries',
        'bookings',
        'quotation_versions',
        'quotation_items',
        'quotations',
        'enquiry_notes',
        'customer_interactions',
        'enquiries',
        'customers',
        'itinerary_days',
        'itineraries',
        'product_media',
        'product_activities',
        'product_destinations',
        'products',
        'product_categories',
        'destinations',
        'activities',
        'website_pages',
        'audit_logs',
        'document_counters',
    ];
    for (const table of tables) {
        await tx.query(`DELETE FROM ${table}`);
    }
    // Media rows are recreated from the imported image files.
    await tx.query('DELETE FROM media');
}
export async function runSeedCli() {
    const reset = process.argv.includes('--reset');
    const result = await seedDatabase({ reset });
    if (result.skipped) {
        console.log('Seed skipped: data already exists. Re-run with --reset to rebuild the development dataset.');
        return;
    }
    console.log('Seed complete.');
    console.table(result.counts);
    console.log(`Owner login: ${config.seedAdminEmail}`);
    console.log(`Manager login: manager@ernizaafricasafaris.com`);
    console.log(`Development password: ${config.seedAdminPassword}`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    runSeedCli()
        .catch((error) => {
        console.error('Seed failed:', error);
        process.exitCode = 1;
    })
        .finally(async () => {
        await closeDb();
    });
}
