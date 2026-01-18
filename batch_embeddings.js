/**
 * Batch Image Embedding Processor
 * 
 * Reads ads from NEW OpenSearch, generates pHash + Vertex AI embeddings,
 * and updates the documents with image_phash and image_embedding fields.
 * 
 * Runs on DigitalOcean App Platform continuously.
 */

const { Client } = require('@opensearch-project/opensearch');

// Configuration - set via environment variables
const OPENSEARCH_URL = process.env.OPENSEARCH_URL;
const OPENSEARCH_INDEX = process.env.OPENSEARCH_INDEX || 'facebook-ads-v2';
const IMAGE_SERVICE_URL = process.env.IMAGE_SERVICE_URL;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 100;
const CONCURRENCY = parseInt(process.env.CONCURRENCY) || 5;
const DELAY_MS = parseInt(process.env.DELAY_MS) || 100;

// Create OpenSearch client
const osClient = new Client({
    node: OPENSEARCH_URL,
    ssl: { rejectUnauthorized: false }
});

// Stats
let stats = {
    processed: 0,
    success: 0,
    errors: 0,
    skipped: 0,
    startTime: Date.now()
};

async function getImageEmbedding(imageUrl, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await fetch(`${IMAGE_SERVICE_URL}/generate-embedding`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image_url: imageUrl })
            });

            // Handle rate limit with retry
            if (response.status === 429) {
                const waitTime = Math.pow(2, attempt) * 2000; // 4s, 8s, 16s
                console.log(`Rate limited (429). Waiting ${waitTime / 1000}s before retry ${attempt}/${retries}...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            if (attempt === retries) {
                console.error(`Embedding error for ${imageUrl.substring(0, 50)}...: ${error.message} (after ${retries} attempts)`);
                return null;
            }
            // Retry on network errors
            const waitTime = Math.pow(2, attempt) * 1000;
            console.log(`Error: ${error.message}. Retrying in ${waitTime / 1000}s (${attempt}/${retries})...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
    return null;
}

async function processDocument(doc) {
    const docId = doc._id;
    const source = doc._source;

    // Skip if already has embeddings
    if (source.image_phash && source.image_embedding) {
        stats.skipped++;
        return;
    }

    // Get images
    const images = source.snapshot?.images || [];
    if (!images.length) {
        stats.skipped++;
        return;
    }

    // Find best image URL - prefer DigitalOcean Spaces URLs
    let imageUrl = null;
    const img = images[0];
    const urlOptions = [
        img.resized_image_url,
        img.original_image_url,
        img.watermarked_resized_image_url
    ].filter(Boolean);

    // Prefer DigitalOcean Spaces URLs (accessible), skip Facebook CDN (403 errors)
    for (const url of urlOptions) {
        if (url.includes('digitaloceanspaces.com')) {
            imageUrl = url;
            break;
        }
    }

    // Skip if no DigitalOcean Spaces URL available
    if (!imageUrl) {
        stats.skipped++;
        return;
    }

    // Get embedding
    const result = await getImageEmbedding(imageUrl);

    if (result && result.phash && result.embedding) {
        // Update document
        try {
            await osClient.update({
                index: OPENSEARCH_INDEX,
                id: docId,
                body: {
                    doc: {
                        image_phash: result.phash,
                        image_embedding: result.embedding
                    }
                }
            });
            stats.success++;
        } catch (e) {
            console.error(`Update error for ${docId}: ${e.message}`);
            stats.errors++;
        }
    } else {
        stats.errors++;
    }

    stats.processed++;
}

async function processBatch(docs) {
    // Process with limited concurrency
    const chunks = [];
    for (let i = 0; i < docs.length; i += CONCURRENCY) {
        chunks.push(docs.slice(i, i + CONCURRENCY));
    }

    for (const chunk of chunks) {
        await Promise.all(chunk.map(doc => processDocument(doc)));
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
}

async function logStats() {
    const elapsed = (Date.now() - stats.startTime) / 1000;
    const rate = stats.processed / elapsed;
    console.log(`[${new Date().toISOString()}] Processed: ${stats.processed} | Success: ${stats.success} | Errors: ${stats.errors} | Skipped: ${stats.skipped} | Rate: ${rate.toFixed(1)}/sec`);
}

async function main() {
    console.log('='.repeat(60));
    console.log('Image Embedding Batch Processor');
    console.log('='.repeat(60));
    console.log(`OpenSearch: ${OPENSEARCH_INDEX}`);
    console.log(`Image Service: ${IMAGE_SERVICE_URL}`);
    console.log(`Batch Size: ${BATCH_SIZE}, Concurrency: ${CONCURRENCY}`);
    console.log('='.repeat(60));

    // Get total documents without embeddings
    const countResult = await osClient.count({
        index: OPENSEARCH_INDEX,
        body: {
            query: {
                bool: {
                    must_not: [
                        { exists: { field: 'image_embedding' } }
                    ],
                    must: [
                        { exists: { field: 'snapshot.images' } }
                    ]
                }
            }
        }
    });

    const total = countResult.body.count;
    console.log(`Documents to process: ${total.toLocaleString()}`);

    // Process using scroll
    let response = await osClient.search({
        index: OPENSEARCH_INDEX,
        scroll: '5m',
        size: BATCH_SIZE,
        body: {
            query: {
                bool: {
                    must_not: [
                        { exists: { field: 'image_embedding' } }
                    ],
                    must: [
                        { exists: { field: 'snapshot.images' } }
                    ]
                }
            },
            _source: ['snapshot.images', 'image_phash', 'image_embedding']
        }
    });

    let scrollId = response.body._scroll_id;
    let hits = response.body.hits.hits;

    // Log stats every 30 seconds
    const logInterval = setInterval(logStats, 30000);

    while (hits.length > 0) {
        await processBatch(hits);

        // Get next batch
        response = await osClient.scroll({
            scroll_id: scrollId,
            scroll: '5m'
        });

        scrollId = response.body._scroll_id;
        hits = response.body.hits.hits;
    }

    clearInterval(logInterval);

    console.log('='.repeat(60));
    console.log('BATCH PROCESSING COMPLETE');
    logStats();
    console.log('='.repeat(60));

    // Clear scroll
    await osClient.clearScroll({ scroll_id: scrollId });
}

// Run
main().catch(console.error);
