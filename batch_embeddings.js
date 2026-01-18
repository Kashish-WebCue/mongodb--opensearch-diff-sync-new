/**
 * Batch Image Embedding Processor
 * 
 * Reads ads from NEW OpenSearch, generates pHash + Vertex AI embeddings,
 * and updates the documents with image_phash and image_embedding fields.
 * 
 * Features:
 * - Tracks failed images and retries them at the end
 * - Automatic retry on rate limit errors
 * - Continues running until ALL images are processed
 */

const { Client } = require('@opensearch-project/opensearch');

// Configuration - set via environment variables
const OPENSEARCH_URL = process.env.OPENSEARCH_URL;
const OPENSEARCH_INDEX = process.env.OPENSEARCH_INDEX || 'facebook-ads-v2';
const IMAGE_SERVICE_URL = process.env.IMAGE_SERVICE_URL;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 100;
const CONCURRENCY = parseInt(process.env.CONCURRENCY) || 1;
const DELAY_MS = parseInt(process.env.DELAY_MS) || 1500;
const MAX_RETRY_ROUNDS = parseInt(process.env.MAX_RETRY_ROUNDS) || 5;

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
    rateLimited: 0,
    startTime: Date.now()
};

// Track failed documents for retry
let failedDocs = [];

async function getImageEmbedding(imageUrl, retries = 5) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await fetch(`${IMAGE_SERVICE_URL}/generate-embedding`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image_url: imageUrl }),
                timeout: 60000
            });

            // Handle rate limit with retry
            if (response.status === 429) {
                const waitTime = Math.pow(2, attempt) * 3000; // 6s, 12s, 24s, 48s, 96s
                console.log(`Rate limited (429). Waiting ${waitTime / 1000}s before retry ${attempt}/${retries}...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`HTTP ${response.status}: ${text.substring(0, 100)}`);
            }

            const result = await response.json();

            // Check if rate limited at Vertex AI level
            if (result.rate_limited) {
                const waitTime = Math.pow(2, attempt) * 5000;
                console.log(`Vertex AI rate limited. Waiting ${waitTime / 1000}s before retry ${attempt}/${retries}...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }

            return result;
        } catch (error) {
            if (attempt === retries) {
                console.error(`Embedding error for ${imageUrl.substring(0, 60)}...: ${error.message} (after ${retries} attempts)`);
                return { error: error.message, rate_limited: error.message.includes('429') };
            }
            // Retry on network errors
            const waitTime = Math.pow(2, attempt) * 2000;
            console.log(`Error: ${error.message}. Retrying in ${waitTime / 1000}s (${attempt}/${retries})...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
    return { error: 'Max retries exceeded', rate_limited: true };
}

async function processDocument(doc, isRetry = false) {
    const docId = doc._id;
    const source = doc._source;

    // Skip if already has embeddings
    if (source.image_phash && source.image_embedding) {
        stats.skipped++;
        return { success: true, skipped: true };
    }

    // Get images
    const images = source.snapshot?.images || [];
    if (!images.length) {
        stats.skipped++;
        return { success: true, skipped: true };
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
        return { success: true, skipped: true };
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
            return { success: true };
        } catch (e) {
            console.error(`Update error for ${docId}: ${e.message}`);
            stats.errors++;
            return { success: false, error: e.message, doc };
        }
    } else if (result && result.rate_limited) {
        // Rate limited - add to retry queue
        stats.rateLimited++;
        if (!isRetry) {
            failedDocs.push(doc);
        }
        return { success: false, rateLimited: true, doc };
    } else {
        stats.errors++;
        return { success: false, error: result?.error || 'Unknown error', doc };
    }
}

async function processBatch(docs, isRetry = false) {
    // Process sequentially for better rate limit handling
    for (const doc of docs) {
        await processDocument(doc, isRetry);
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        stats.processed++;
    }
}

async function logStats() {
    const elapsed = (Date.now() - stats.startTime) / 1000;
    const rate = stats.success / elapsed;
    console.log(`[${new Date().toISOString()}] Success: ${stats.success} | Errors: ${stats.errors} | RateLimited: ${stats.rateLimited} | Skipped: ${stats.skipped} | Failed Queue: ${failedDocs.length} | Rate: ${rate.toFixed(2)}/sec`);
}

async function retryFailedDocs(round) {
    if (failedDocs.length === 0) {
        console.log('No failed documents to retry.');
        return;
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`RETRY ROUND ${round}: ${failedDocs.length} failed documents`);
    console.log('='.repeat(60));

    const docsToRetry = [...failedDocs];
    failedDocs = []; // Clear for next round

    // Wait before retry to allow rate limits to reset
    console.log('Waiting 60 seconds before retry round...');
    await new Promise(resolve => setTimeout(resolve, 60000));

    for (const doc of docsToRetry) {
        const result = await processDocument(doc, true);
        if (!result.success && result.rateLimited) {
            failedDocs.push(doc); // Re-add if still rate limited
        }
        await new Promise(resolve => setTimeout(resolve, DELAY_MS * 2)); // Slower for retries
    }

    console.log(`Retry round ${round} complete. Remaining failed: ${failedDocs.length}`);
}

async function main() {
    console.log('='.repeat(60));
    console.log('Image Embedding Batch Processor');
    console.log('='.repeat(60));
    console.log(`OpenSearch: ${OPENSEARCH_INDEX}`);
    console.log(`Image Service: ${IMAGE_SERVICE_URL}`);
    console.log(`Batch Size: ${BATCH_SIZE}, Delay: ${DELAY_MS}ms`);
    console.log(`Max Retry Rounds: ${MAX_RETRY_ROUNDS}`);
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
        scroll: '10m',
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

    // Log stats every 60 seconds
    const logInterval = setInterval(logStats, 60000);

    // Main processing loop
    while (hits.length > 0) {
        await processBatch(hits);

        // Get next batch
        response = await osClient.scroll({
            scroll_id: scrollId,
            scroll: '10m'
        });

        scrollId = response.body._scroll_id;
        hits = response.body.hits.hits;
    }

    // Clear scroll
    await osClient.clearScroll({ scroll_id: scrollId });

    console.log('\n' + '='.repeat(60));
    console.log('FIRST PASS COMPLETE');
    logStats();
    console.log('='.repeat(60));

    // Retry failed documents
    for (let round = 1; round <= MAX_RETRY_ROUNDS && failedDocs.length > 0; round++) {
        await retryFailedDocs(round);
    }

    clearInterval(logInterval);

    console.log('\n' + '='.repeat(60));
    console.log('ALL PROCESSING COMPLETE');
    logStats();
    if (failedDocs.length > 0) {
        console.log(`\n⚠️  ${failedDocs.length} documents could not be processed after ${MAX_RETRY_ROUNDS} retry rounds`);
    } else {
        console.log('\n✅ All documents processed successfully!');
    }
    console.log('='.repeat(60));
}

// Run
main().catch(console.error);
