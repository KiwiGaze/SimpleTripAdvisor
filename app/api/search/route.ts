//app/api/chat/route.ts
import { getGroupConfig } from '@/app/actions';
import { serverEnv } from '@/env/server';
import { xai } from '@ai-sdk/xai';
import { cohere } from '@ai-sdk/cohere'
import { mistral } from "@ai-sdk/mistral";
import CodeInterpreter from '@e2b/code-interpreter';
import FirecrawlApp from '@mendable/firecrawl-js';
import { tavily } from '@tavily/core';
import {
    convertToCoreMessages,
    smoothStream,
    streamText,
    tool,
    createDataStreamResponse,
    customProvider,
    generateObject,
    NoSuchToolError,
    generateText
} from 'ai';
import Exa from 'exa-js';
import { z } from 'zod';
import MemoryClient from 'mem0ai';

const scira = customProvider({
    languageModels: {
        'scira-default': xai('grok-3-beta'), // Corresponds to "Grok 3.0"
        'scira-vision': xai('grok-2-vision-1212'), // Corresponds to "Grok 2.0 Vision"
        'scira-grok3-mini-fast-beta': xai('grok-3-mini-fast-beta'), // Corresponds to "Grok 3.0 Mini"
        'scira-grok3-mini-beta': xai('grok-3-mini-beta'), // Corresponds to "Grok 3.0"
    }
})

interface MapboxFeature {
    id: string;
    name: string;
    formatted_address: string;
    geometry: {
        type: string;
        coordinates: number[];
    };
    feature_type: string;
    context: string;
    coordinates: number[];
    bbox: number[];
    source: string;
}

interface GoogleResult {
    place_id: string;
    formatted_address: string;
    geometry: {
        location: {
            lat: number;
            lng: number;
        };
        viewport: {
            northeast: {
                lat: number;
                lng: number;
            };
            southwest: {
                lat: number;
                lng: number;
            };
        };
    };
    types: string[];
    address_components: Array<{
        long_name: string;
        short_name: string;
        types: string[];
    }>;
}

function sanitizeUrl(url: string): string {
    return url.replace(/\s+/g, '%20');
}

async function isValidImageUrl(url: string): Promise<{ valid: boolean; redirectedUrl?: string }> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal,
            headers: {
                'Accept': 'image/*',
                'User-Agent': 'Mozilla/5.0 (compatible; ImageValidator/1.0)'
            },
            redirect: 'follow' // Ensure redirects are followed
        });

        clearTimeout(timeout);

        // Log response details for debugging
        console.log(`Image validation [${url}]: status=${response.status}, content-type=${response.headers.get('content-type')}`);

        // Capture redirected URL if applicable
        const redirectedUrl = response.redirected ? response.url : undefined;

        // Check if we got redirected (for logging purposes)
        if (response.redirected) {
            console.log(`Image was redirected from ${url} to ${redirectedUrl}`);
        }

        // Handle specific response codes
        if (response.status === 404) {
            console.log(`Image not found (404): ${url}`);
            return { valid: false };
        }

        if (response.status === 403) {
            console.log(`Access forbidden (403) - likely CORS issue: ${url}`);

            // Try to use proxy instead of whitelisting domains
            try {
                // Attempt to handle CORS blocked images by trying to access via proxy
                const controller = new AbortController();
                const proxyTimeout = setTimeout(() => controller.abort(), 5000);

                const proxyResponse = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`, {
                    method: 'HEAD',
                    signal: controller.signal
                });

                clearTimeout(proxyTimeout);

                if (proxyResponse.ok) {
                    const contentType = proxyResponse.headers.get('content-type');
                    const proxyRedirectedUrl = proxyResponse.headers.get('x-final-url') || undefined;

                    if (contentType && contentType.startsWith('image/')) {
                        console.log(`Proxy validation successful for ${url}`);
                        return {
                            valid: true,
                            redirectedUrl: proxyRedirectedUrl || redirectedUrl
                        };
                    }
                }
            } catch (proxyError) {
                console.error(`Proxy validation failed for ${url}:`, proxyError);
            }
            return { valid: false };
        }

        if (response.status >= 400) {
            console.log(`Image request failed with status ${response.status}: ${url}`);
            return { valid: false };
        }

        // Check content type to ensure it's actually an image
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.startsWith('image/')) {
            console.log(`Invalid content type for image: ${contentType}, url: ${url}`);
            return { valid: false };
        }

        return { valid: true, redirectedUrl };
    } catch (error) {
        // Check if error is related to CORS
        const errorMsg = error instanceof Error ? error.message : String(error);

        if (errorMsg.includes('CORS') || errorMsg.includes('blocked by CORS policy')) {
            console.error(`CORS error for ${url}:`, errorMsg);

            // Try to use proxy instead of whitelisting domains
            try {
                // Attempt to handle CORS blocked images by trying to access via proxy
                const controller = new AbortController();
                const proxyTimeout = setTimeout(() => controller.abort(), 5000);

                const proxyResponse = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`, {
                    method: 'HEAD',
                    signal: controller.signal
                });

                clearTimeout(proxyTimeout);

                if (proxyResponse.ok) {
                    const contentType = proxyResponse.headers.get('content-type');
                    const proxyRedirectedUrl = proxyResponse.headers.get('x-final-url') || undefined;

                    if (contentType && contentType.startsWith('image/')) {
                        console.log(`Proxy validation successful for ${url}`);
                        return { valid: true, redirectedUrl: proxyRedirectedUrl };
                    }
                }
            } catch (proxyError) {
                console.error(`Proxy validation failed for ${url}:`, proxyError);
            }
        }

        // Log the specific error
        console.error(`Image validation error for ${url}:`, errorMsg);
        return { valid: false };
    }
}


const extractDomain = (url: string): string => {
    const urlPattern = /^https?:\/\/([^/?#]+)(?:[/?#]|$)/i;
    return url.match(urlPattern)?.[1] || url;
};

const deduplicateByDomainAndUrl = <T extends { url: string }>(items: T[]): T[] => {
    const seenDomains = new Set<string>();
    const seenUrls = new Set<string>();

    return items.filter(item => {
        const domain = extractDomain(item.url);
        const isNewUrl = !seenUrls.has(item.url);
        const isNewDomain = !seenDomains.has(domain);

        if (isNewUrl && isNewDomain) {
            seenUrls.add(item.url);
            seenDomains.add(domain);
            return true;
        }
        return false;
    });
};

// Modify the POST function to use the new handler
export async function POST(req: Request) {
    const { messages, model, group, user_id, timezone } = await req.json();
    const { tools: activeTools, systemPrompt, toolInstructions, responseGuidelines } = await getGroupConfig(group);

    console.log("Running with model: ", model.trim());
    console.log("Group: ", group);
    console.log("Timezone: ", timezone);

    console.log("Running inside part 1");
    return createDataStreamResponse({
        execute: async (dataStream) => {
            const toolsResult = streamText({
                model: scira.languageModel(model),
                messages: convertToCoreMessages(messages),
                temperature: 0,
                experimental_activeTools: [...activeTools],
                system: toolInstructions,
                toolChoice: 'required',
                providerOptions: {
                    mistral: {
                        parallel_tool_calls: false,
                    }
                },
                tools: {
                    text_translate: tool({
                        description: "Translate text from one language to another.",
                        parameters: z.object({
                            text: z.string().describe("The text to translate."),
                            to: z.string().describe("The language to translate to (e.g., 'fr' for French)."),
                        }),
                        execute: async ({ text, to }: { text: string; to: string }) => {
                            const { object: translation } = await generateObject({
                                model: scira.languageModel(model),
                                system: `You are a helpful assistant that translates text from one language to another.`,
                                prompt: `Translate the following text to ${to} language: ${text}`,
                                schema: z.object({
                                    translatedText: z.string(),
                                    detectedLanguage: z.string(),
                                }),
                            });
                            console.log(translation);
                            return {
                                translatedText: translation.translatedText,
                                detectedLanguage: translation.detectedLanguage,
                            };
                        },
                    }),
                    web_search: tool({
                        description: 'Search the web for information with 5-10 queries, max results and search depth.',
                        parameters: z.object({
                            queries: z.array(z.string().describe('Array of search queries to look up on the web. Default is 5 to 10 queries.')),
                            maxResults: z.array(
                                z.number().describe('Array of maximum number of results to return per query. Default is 10.').default(10),
                            ),
                            topics: z.array(
                                z.enum(['general', 'news', 'finance']).describe('Array of topic types to search for. Default is general.').default('general'),
                            ),
                            searchDepth: z.array(
                                z.enum(['basic', 'advanced']).describe('Array of search depths to use. Default is basic. Use advanced for more detailed results.').default('basic'),
                            ),
                            exclude_domains: z
                                .array(z.string())
                                .describe('A list of domains to exclude from all search results. Default is an empty list.').default([]),
                        }),
                        execute: async ({
                            queries,
                            maxResults,
                            topics,
                            searchDepth,
                            exclude_domains,
                        }: {
                            queries: string[];
                            maxResults: number[];
                            topics: ('general' | 'news' | 'finance')[];
                            searchDepth: ('basic' | 'advanced')[];
                            exclude_domains?: string[];
                        }) => {
                            const apiKey = serverEnv.TAVILY_API_KEY;
                            const tvly = tavily({ apiKey });
                            const includeImageDescriptions = true;

                            console.log('Queries:', queries);
                            console.log('Max Results:', maxResults);
                            console.log('Topics:', topics);
                            console.log('Search Depths:', searchDepth);
                            console.log('Exclude Domains:', exclude_domains);

                            // Execute searches in parallel
                            const searchPromises = queries.map(async (query, index) => {
                                const data = await tvly.search(query, {
                                    topic: topics[index] || topics[0] || 'general',
                                    days: topics[index] === 'news' ? 7 : undefined,
                                    maxResults: maxResults[index] || maxResults[0] || 10,
                                    searchDepth: searchDepth[index] || searchDepth[0] || 'basic',
                                    includeAnswer: true,
                                    includeImages: true,
                                    includeImageDescriptions: includeImageDescriptions,
                                    excludeDomains: exclude_domains,
                                });

                                // Add annotation for query completion
                                dataStream.writeMessageAnnotation({
                                    type: 'query_completion',
                                    data: {
                                        query,
                                        index,
                                        total: queries.length,
                                        status: 'completed',
                                        resultsCount: data.results.length,
                                        imagesCount: data.images.length
                                    }
                                });

                                return {
                                    query,
                                    results: deduplicateByDomainAndUrl(data.results).map((obj: any) => ({
                                        url: obj.url,
                                        title: obj.title,
                                        content: obj.content,
                                        raw_content: obj.raw_content,
                                        published_date: topics[index] === 'news' ? obj.published_date : undefined,
                                    })),
                                    images: includeImageDescriptions
                                        ? await Promise.all(
                                            deduplicateByDomainAndUrl(data.images).map(
                                                async ({ url, description }: { url: string; description?: string }) => {
                                                    const sanitizedUrl = sanitizeUrl(url);
                                                    const imageValidation = await isValidImageUrl(sanitizedUrl);
                                                    return imageValidation.valid
                                                        ? {
                                                            url: imageValidation.redirectedUrl || sanitizedUrl,
                                                            description: description ?? '',
                                                        }
                                                        : null;
                                                },
                                            ),
                                        ).then((results) =>
                                            results.filter(
                                                (image): image is { url: string; description: string } =>
                                                    image !== null &&
                                                    typeof image === 'object' &&
                                                    typeof image.description === 'string' &&
                                                    image.description !== '',
                                            ),
                                        )
                                        : await Promise.all(
                                            deduplicateByDomainAndUrl(data.images).map(async ({ url }: { url: string }) => {
                                                const sanitizedUrl = sanitizeUrl(url);
                                                const imageValidation = await isValidImageUrl(sanitizedUrl);
                                                return imageValidation.valid ? (imageValidation.redirectedUrl || sanitizedUrl) : null;
                                            }),
                                        ).then((results) => results.filter((url) => url !== null) as string[]),
                                };
                            });

                            const searchResults = await Promise.all(searchPromises);

                            return {
                                searches: searchResults,
                            };
                        },
                    }),
                    get_weather_data: tool({
                        description: 'Get the weather data for the given coordinates.',
                        parameters: z.object({
                            lat: z.number().describe('The latitude of the location.'),
                            lon: z.number().describe('The longitude of the location.'),
                        }),
                        execute: async ({ lat, lon }: { lat: number; lon: number }) => {
                            const apiKey = serverEnv.OPENWEATHER_API_KEY;
                            const response = await fetch(
                                `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}`,
                            );
                            const data = await response.json();
                            return data;
                        },
                    }),
                    find_place: tool({
                        description:
                            'Find a place using Google Maps API for forward geocoding and Mapbox for reverse geocoding.',
                        parameters: z.object({
                            query: z.string().describe('The search query for forward geocoding'),
                            coordinates: z.array(z.number()).describe('Array of [latitude, longitude] for reverse geocoding'),
                        }),
                        execute: async ({ query, coordinates }: { query: string; coordinates: number[] }) => {
                            try {
                                // Forward geocoding with Google Maps API
                                const googleApiKey = serverEnv.GOOGLE_MAPS_API_KEY;
                                const googleResponse = await fetch(
                                    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
                                        query,
                                    )}&key=${googleApiKey}`,
                                );
                                const googleData = await googleResponse.json();

                                // Reverse geocoding with Mapbox
                                const mapboxToken = serverEnv.MAPBOX_ACCESS_TOKEN;
                                const [lat, lng] = coordinates;
                                const mapboxResponse = await fetch(
                                    `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${lng}&latitude=${lat}&access_token=${mapboxToken}`,
                                );
                                const mapboxData = await mapboxResponse.json();

                                // Process and combine results
                                const features = [];

                                // Process Google results
                                if (googleData.status === 'OK' && googleData.results.length > 0) {
                                    features.push(
                                        ...googleData.results.map((result: GoogleResult) => ({
                                            id: result.place_id,
                                            name: result.formatted_address.split(',')[0],
                                            formatted_address: result.formatted_address,
                                            geometry: {
                                                type: 'Point',
                                                coordinates: [result.geometry.location.lng, result.geometry.location.lat],
                                            },
                                            feature_type: result.types[0],
                                            address_components: result.address_components,
                                            viewport: result.geometry.viewport,
                                            place_id: result.place_id,
                                            source: 'google',
                                        })),
                                    );
                                }

                                // Process Mapbox results
                                if (mapboxData.features && mapboxData.features.length > 0) {
                                    features.push(
                                        ...mapboxData.features.map(
                                            (feature: any): MapboxFeature => ({
                                                id: feature.id,
                                                name: feature.properties.name_preferred || feature.properties.name,
                                                formatted_address: feature.properties.full_address,
                                                geometry: feature.geometry,
                                                feature_type: feature.properties.feature_type,
                                                context: feature.properties.context,
                                                coordinates: feature.properties.coordinates,
                                                bbox: feature.properties.bbox,
                                                source: 'mapbox',
                                            }),
                                        ),
                                    );
                                }

                                return {
                                    features,
                                    google_attribution: 'Powered by Google Maps Platform',
                                    mapbox_attribution: 'Powered by Mapbox',
                                };
                            } catch (error) {
                                console.error('Geocoding error:', error);
                                throw error;
                            }
                        },
                    }),
                    text_search: tool({
                        description: 'Perform a text-based search for places using Mapbox API.',
                        parameters: z.object({
                            query: z.string().describe("The search query (e.g., '123 main street')."),
                            location: z.string().describe("The location to center the search (e.g., '42.3675294,-71.186966')."),
                            radius: z.number().describe('The radius of the search area in meters (max 50000).'),
                        }),
                        execute: async ({ query, location, radius }: { query: string; location?: string; radius?: number }) => {
                            const mapboxToken = serverEnv.MAPBOX_ACCESS_TOKEN;

                            let proximity = '';
                            if (location) {
                                const [lng, lat] = location.split(',').map(Number);
                                proximity = `&proximity=${lng},${lat}`;
                            }

                            const response = await fetch(
                                `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
                                    query,
                                )}.json?types=poi${proximity}&access_token=${mapboxToken}`,
                            );
                            const data = await response.json();

                            // If location and radius provided, filter results by distance
                            let results = data.features;
                            if (location && radius) {
                                const [centerLng, centerLat] = location.split(',').map(Number);
                                const radiusInDegrees = radius / 111320;
                                results = results.filter((feature: any) => {
                                    const [placeLng, placeLat] = feature.center;
                                    const distance = Math.sqrt(
                                        Math.pow(placeLng - centerLng, 2) + Math.pow(placeLat - centerLat, 2),
                                    );
                                    return distance <= radiusInDegrees;
                                });
                            }

                            return {
                                results: results.map((feature: any) => ({
                                    name: feature.text,
                                    formatted_address: feature.place_name,
                                    geometry: {
                                        location: {
                                            lat: feature.center[1],
                                            lng: feature.center[0],
                                        },
                                    },
                                })),
                            };
                        },
                    }),
                    nearby_search: tool({
                        description: 'Search for nearby places, such as restaurants or hotels based on the details given.',
                        parameters: z.object({
                            location: z.string().describe('The location name given by user.'),
                            latitude: z.number().describe('The latitude of the location.'),
                            longitude: z.number().describe('The longitude of the location.'),
                            type: z
                                .string()
                                .describe('The type of place to search for (restaurants, hotels, attractions, geos).'),
                            radius: z.number().default(30000).describe('The radius in meters (max 50000, default 30000).'),
                        }),
                        execute: async ({
                            location,
                            latitude,
                            longitude,
                            type,
                            radius,
                        }: {
                            latitude: number;
                            longitude: number;
                            location: string;
                            type: string;
                            radius: number;
                        }) => {
                            const apiKey = serverEnv.TRIPADVISOR_API_KEY;
                            let finalLat = latitude;
                            let finalLng = longitude;

                            try {
                                // Try geocoding first
                                const geocodingData = await fetch(
                                    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
                                        location,
                                    )}&key=${serverEnv.GOOGLE_MAPS_API_KEY}`,
                                );

                                const geocoding = await geocodingData.json();

                                if (geocoding.results?.[0]?.geometry?.location) {
                                    let trimmedLat = geocoding.results[0].geometry.location.lat.toString().split('.');
                                    finalLat = parseFloat(trimmedLat[0] + '.' + trimmedLat[1].slice(0, 6));
                                    let trimmedLng = geocoding.results[0].geometry.location.lng.toString().split('.');
                                    finalLng = parseFloat(trimmedLng[0] + '.' + trimmedLng[1].slice(0, 6));
                                    console.log('Using geocoded coordinates:', finalLat, finalLng);
                                } else {
                                    console.log('Using provided coordinates:', finalLat, finalLng);
                                }

                                // Get nearby places
                                const nearbyResponse = await fetch(
                                    `https://api.content.tripadvisor.com/api/v1/location/nearby_search?latLong=${finalLat},${finalLng}&category=${type}&radius=${radius}&language=en&key=${apiKey}`,
                                    {
                                        method: 'GET',
                                        headers: {
                                            Accept: 'application/json',
                                            origin: 'https://mplx.local',
                                            referer: 'https://mplx.local',
                                        },
                                    },
                                );

                                if (!nearbyResponse.ok) {
                                    throw new Error(`Nearby search failed: ${nearbyResponse.status}`);
                                }

                                const nearbyData = await nearbyResponse.json();

                                if (!nearbyData.data || nearbyData.data.length === 0) {
                                    console.log('No nearby places found');
                                    return {
                                        results: [],
                                        center: { lat: finalLat, lng: finalLng },
                                    };
                                }

                                // Process each place
                                const detailedPlaces = await Promise.all(
                                    nearbyData.data.map(async (place: any) => {
                                        try {
                                            if (!place.location_id) {
                                                console.log(`Skipping place "${place.name}": No location_id`);
                                                return null;
                                            }

                                            // Fetch place details
                                            const detailsResponse = await fetch(
                                                `https://api.content.tripadvisor.com/api/v1/location/${place.location_id}/details?language=en&currency=USD&key=${apiKey}`,
                                                {
                                                    method: 'GET',
                                                    headers: {
                                                        Accept: 'application/json',
                                                        origin: 'https://mplx.local',
                                                        referer: 'https://mplx.local',
                                                    },
                                                },
                                            );

                                            if (!detailsResponse.ok) {
                                                console.log(`Failed to fetch details for "${place.name}"`);
                                                return null;
                                            }

                                            const details = await detailsResponse.json();

                                            console.log(`Place details for "${place.name}":`, details);

                                            // Fetch place photos
                                            let photos = [];
                                            try {
                                                const photosResponse = await fetch(
                                                    `https://api.content.tripadvisor.com/api/v1/location/${place.location_id}/photos?language=en&key=${apiKey}`,
                                                    {
                                                        method: 'GET',
                                                        headers: {
                                                            Accept: 'application/json',
                                                            origin: 'https://mplx.local',
                                                            referer: 'https://mplx.local',
                                                        },
                                                    },
                                                );

                                                if (photosResponse.ok) {
                                                    const photosData = await photosResponse.json();
                                                    photos =
                                                        photosData.data
                                                            ?.map((photo: any) => ({
                                                                thumbnail: photo.images?.thumbnail?.url,
                                                                small: photo.images?.small?.url,
                                                                medium: photo.images?.medium?.url,
                                                                large: photo.images?.large?.url,
                                                                original: photo.images?.original?.url,
                                                                caption: photo.caption,
                                                            }))
                                                            .filter((photo: any) => photo.medium) || [];
                                                }
                                            } catch (error) {
                                                console.log(`Photo fetch failed for "${place.name}":`, error);
                                            }

                                            // Get timezone for the location
                                            const tzResponse = await fetch(
                                                `https://maps.googleapis.com/maps/api/timezone/json?location=${details.latitude
                                                },${details.longitude}&timestamp=${Math.floor(Date.now() / 1000)}&key=${serverEnv.GOOGLE_MAPS_API_KEY
                                                }`,
                                            );
                                            const tzData = await tzResponse.json();
                                            const timezone = tzData.timeZoneId || 'UTC';

                                            // Process hours and status with timezone
                                            const localTime = new Date(
                                                new Date().toLocaleString('en-US', {
                                                    timeZone: timezone,
                                                }),
                                            );
                                            const currentDay = localTime.getDay();
                                            const currentHour = localTime.getHours();
                                            const currentMinute = localTime.getMinutes();
                                            const currentTime = currentHour * 100 + currentMinute;

                                            let is_closed = true;
                                            let next_open_close = null;
                                            let next_day = currentDay;

                                            if (details.hours?.periods) {
                                                // Sort periods by day and time for proper handling of overnight hours
                                                const sortedPeriods = [...details.hours.periods].sort((a, b) => {
                                                    if (a.open.day !== b.open.day) return a.open.day - b.open.day;
                                                    return parseInt(a.open.time) - parseInt(b.open.time);
                                                });

                                                // Find current or next opening period
                                                for (let i = 0; i < sortedPeriods.length; i++) {
                                                    const period = sortedPeriods[i];
                                                    const openTime = parseInt(period.open.time);
                                                    const closeTime = period.close ? parseInt(period.close.time) : 2359;
                                                    const periodDay = period.open.day;

                                                    // Handle overnight hours
                                                    if (closeTime < openTime) {
                                                        // Place is open from previous day
                                                        if (currentDay === periodDay && currentTime < closeTime) {
                                                            is_closed = false;
                                                            next_open_close = period.close.time;
                                                            break;
                                                        }
                                                        // Place is open today and extends to tomorrow
                                                        if (currentDay === periodDay && currentTime >= openTime) {
                                                            is_closed = false;
                                                            next_open_close = period.close.time;
                                                            next_day = (periodDay + 1) % 7;
                                                            break;
                                                        }
                                                    } else {
                                                        // Normal hours within same day
                                                        if (
                                                            currentDay === periodDay &&
                                                            currentTime >= openTime &&
                                                            currentTime < closeTime
                                                        ) {
                                                            is_closed = false;
                                                            next_open_close = period.close.time;
                                                            break;
                                                        }
                                                    }

                                                    // Find next opening time if currently closed
                                                    if (is_closed) {
                                                        if (
                                                            periodDay > currentDay ||
                                                            (periodDay === currentDay && openTime > currentTime)
                                                        ) {
                                                            next_open_close = period.open.time;
                                                            next_day = periodDay;
                                                            break;
                                                        }
                                                    }
                                                }
                                            }

                                            // Return processed place data
                                            return {
                                                name: place.name || 'Unnamed Place',
                                                location: {
                                                    lat: parseFloat(details.latitude || place.latitude || finalLat),
                                                    lng: parseFloat(details.longitude || place.longitude || finalLng),
                                                },
                                                timezone,
                                                place_id: place.location_id,
                                                vicinity: place.address_obj?.address_string || '',
                                                distance: parseFloat(place.distance || '0'),
                                                bearing: place.bearing || '',
                                                type: type,
                                                rating: parseFloat(details.rating || '0'),
                                                price_level: details.price_level || '',
                                                cuisine: details.cuisine?.[0]?.name || '',
                                                description: details.description || '',
                                                phone: details.phone || '',
                                                website: details.website || '',
                                                reviews_count: parseInt(details.num_reviews || '0'),
                                                is_closed,
                                                hours: details.hours?.weekday_text || [],
                                                next_open_close,
                                                next_day,
                                                periods: details.hours?.periods || [],
                                                photos,
                                                source: details.source?.name || 'TripAdvisor',
                                            };
                                        } catch (error) {
                                            console.log(`Failed to process place "${place.name}":`, error);
                                            return null;
                                        }
                                    }),
                                );

                                // Filter and sort results
                                const validPlaces = detailedPlaces
                                    .filter((place) => place !== null)
                                    .sort((a, b) => (a?.distance || 0) - (b?.distance || 0));

                                return {
                                    results: validPlaces,
                                    center: { lat: finalLat, lng: finalLng },
                                };
                            } catch (error) {
                                console.error('Nearby search error:', error);
                                throw error;
                            }
                        },
                    }),
                    track_flight: tool({
                        description: 'Track flight information and status',
                        parameters: z.object({
                            flight_number: z.string().describe('The flight number to track'),
                        }),
                        execute: async ({ flight_number }: { flight_number: string }) => {
                            try {
                                const response = await fetch(
                                    `https://api.aviationstack.com/v1/flights?access_key=${serverEnv.AVIATION_STACK_API_KEY}&flight_iata=${flight_number}`,
                                );
                                return await response.json();
                            } catch (error) {
                                console.error('Flight tracking error:', error);
                                throw error;
                            }
                        },
                    }),
                    datetime: tool({
                        description: 'Get the current date and time in the user\'s timezone',
                        parameters: z.object({}),
                        execute: async () => {
                            try {
                                // Get current date and time with timezone
                                // const now = new Date();
                                const now = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));

                                // Format date and time using the timezone
                                return {
                                    timestamp: now.getTime(),
                                    iso: now.toISOString(),
                                    timezone: timezone,
                                    formatted: {
                                        date: new Intl.DateTimeFormat('en-US', {
                                            weekday: 'long',
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric',
                                            timeZone: timezone
                                        }).format(now),
                                        time: new Intl.DateTimeFormat('en-US', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            second: '2-digit',
                                            hour12: true,
                                            timeZone: timezone
                                        }).format(now),
                                        dateShort: new Intl.DateTimeFormat('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric',
                                            timeZone: timezone
                                        }).format(now),
                                        timeShort: new Intl.DateTimeFormat('en-US', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            hour12: true,
                                            timeZone: timezone
                                        }).format(now)
                                    }
                                };
                            } catch (error) {
                                console.error('Datetime error:', error);
                                throw error;
                            }
                        },
                    }),
                },
                experimental_repairToolCall: async ({
                    toolCall,
                    tools,
                    parameterSchema,
                    error,
                }) => {
                    if (NoSuchToolError.isInstance(error)) {
                        return null; // do not attempt to fix invalid tool names
                    }

                    console.log("Fixing tool call================================");
                    console.log("toolCall", toolCall);
                    console.log("tools", tools);
                    console.log("parameterSchema", parameterSchema);
                    console.log("error", error);

                    const tool = tools[toolCall.toolName as keyof typeof tools];

                    const { object: repairedArgs } = await generateObject({
                        model: scira.languageModel("scira-default"),
                        schema: tool.parameters,
                        prompt: [
                            `The model tried to call the tool "${toolCall.toolName}"` +
                            ` with the following arguments:`,
                            JSON.stringify(toolCall.args),
                            `The tool accepts the following schema:`,
                            JSON.stringify(parameterSchema(toolCall)),
                            'Please fix the arguments.',
                            'Do not use print statements stock chart tool.',
                            `For the stock chart tool you have to generate a python code with matplotlib and yfinance to plot the stock chart.`,
                            `For the web search make multiple queries to get the best results.`,
                            `Today's date is ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`
                        ].join('\n'),
                    });

                    console.log("repairedArgs", repairedArgs);

                    return { ...toolCall, args: JSON.stringify(repairedArgs) };
                },
                onChunk(event) {
                    if (event.chunk.type === 'tool-call') {
                        console.log('Called Tool: ', event.chunk.toolName);
                    }
                },
                onStepFinish(event) {
                    if (event.warnings) {
                        console.log('Warnings: ', event.warnings);
                    }
                },
                onFinish(event) {
                    console.log('Fin reason[1]: ', event.finishReason);
                    console.log('Reasoning[1]: ', event.reasoning);
                    console.log('reasoning details[1]: ', event.reasoningDetails);
                    console.log('Steps[1] ', event.steps);
                    console.log('Messages[1]: ', event.response.messages);
                },
                onError(event) {
                    console.log('Error: ', event.error);
                },
            });

            toolsResult.mergeIntoDataStream(dataStream, {
                experimental_sendFinish: false
            });

            console.log("we got here");

            const response = streamText({
                model: scira.languageModel(model),
                system: responseGuidelines,
                experimental_transform: smoothStream({
                    chunking: 'word',
                    delayInMs: 15,
                }),
                messages: [...convertToCoreMessages(messages), ...(await toolsResult.response).messages],
                onFinish(event) {
                    console.log('Fin reason[2]: ', event.finishReason);
                    console.log('Reasoning[2]: ', event.reasoning);
                    console.log('reasoning details[2]: ', event.reasoningDetails);
                    console.log('Steps[2] ', event.steps);
                    console.log('Messages[2]: ', event.response.messages);
                },
                onError(event) {
                    console.log('Error: ', event.error);
                },
            });

            return response.mergeIntoDataStream(dataStream, {
                experimental_sendStart: true,
            });
        }
    })
    
}