# Facebook Ads OpenSearch Sync

A production-ready Node.js service for synchronizing Facebook ads data from MongoDB to OpenSearch/Elasticsearch using MongoDB's change streams for real-time updates.

## Features

- **Real-time Sync**: Uses MongoDB change streams for instant synchronization of Facebook ads
- **Bulk Operations**: Optimized bulk indexing with configurable batch sizes (5-15MB, 2k-8k docs)
- **Production Ready**: Includes health checks, monitoring, graceful shutdown, and error handling
- **Facebook Ads Optimized**: Specifically designed for Facebook ads data structure and filtering needs
- **Configurable**: Environment-based configuration for different deployment scenarios
- **Docker Support**: Complete Docker setup with MongoDB and OpenSearch
- **Minimal Code**: Clean, maintainable codebase for easy debugging

## Architecture

- **MongoDB Change Streams**: Watches for Facebook ads document changes in real-time
- **Bulk Processor**: Batches documents for efficient OpenSearch indexing
- **OpenSearch Integration**: Uses MongoDB `_id` as OpenSearch document `_id` for idempotent upserts
- **Health Monitoring**: Comprehensive health checks and statistics
- **Facebook Ads Schema**: Optimized mapping for Facebook ads data structure

## Quick Start

### Using Docker Compose

1. Clone the repository
2. Copy `env.example` to `.env` (already configured for DigitalOcean)
3. Run the sync service:

```bash
docker-compose up -d
```

This will start:
- Sync Service (port 3000) connected to DigitalOcean MongoDB and OpenSearch

### Manual Setup

1. Install dependencies:
```bash
npm install
```

2. Copy environment configuration:
```bash
cp env.example .env
```

3. Run the service:
```bash
npm start
```

The service will connect to your DigitalOcean MongoDB (`selauto.fb_ad` collection) and OpenSearch cluster.

## Configuration

Key environment variables:

```bash
# MongoDB (DigitalOcean)
MONGODB_URI=mongodb+srv://doadmin:52e3T4p1u89cXKn6@webcue-data-e8122b46.mongo.ondigitalocean.com/selauto?tls=true&authSource=admin&replicaSet=webcue-data
MONGODB_DATABASE=selauto
MONGODB_COLLECTION=fb_ad

# OpenSearch (DigitalOcean)
OPENSEARCH_URL=https://db-opensearch-blr1-98834-do-user-18364252-0.m.db.ondigitalocean.com:25060
OPENSEARCH_USERNAME=doadmin
OPENSEARCH_PASSWORD=YOUR_PASSWORD_HERE
OPENSEARCH_INDEX=facebook-ads-hot
OPENSEARCH_INDEX_ALIAS=facebook-ads-read

# Sync Settings
SYNC_BATCH_SIZE=5000
SYNC_BATCH_SIZE_BYTES=10485760
SYNC_CONCURRENCY=2
SYNC_ENABLED=true
```

## API Endpoints

### Health Checks
- `GET /api/health` - Basic health check
- `GET /api/health/detailed` - Detailed health information
- `GET /api/health/ready` - Readiness probe
- `GET /api/health/live` - Liveness probe

### Sync Management
- `POST /api/sync/start` - Start sync service
- `POST /api/sync/stop` - Stop sync service
- `GET /api/sync/status` - Get sync status and statistics
- `POST /api/sync/full-sync` - Trigger full synchronization
- `POST /api/sync/flush` - Flush pending documents

### Statistics
- `GET /api/stats` - Get detailed statistics

## Facebook Ads Data Structure

The service is optimized for Facebook ads data with the following key fields indexed for filtering:

### Core Fields
- `ad_archive_id` - Facebook's unique ad identifier
- `page_id` - Facebook page ID (used for routing)
- `page_name` - Page name (searchable text)
- `advertiser_name` - Advertiser name
- `status` - Ad status (Active/Inactive)
- `is_active` - Boolean active status

### Geographic & Search Fields
- `countrySearchedfor` - Country code searched for
- `search_country` - Alternative country field
- `country` - Country code
- `region` - Geographic region
- `countrySearchedfor_all` - Array of all searched countries

### Platform & Media Fields
- `platforms` - Object with Facebook, Instagram, Messenger, Audience Network flags
- `publisher_platform` - Array of platforms (FACEBOOK, INSTAGRAM, etc.)
- `search_media_type` - Media type filter
- `categories` - Ad categories
- `page_categories` - Page categories

### Creative Content
- `creative` - Full creative object with headlines, body, CTAs, media
- `snapshot` - Snapshot data with images, videos, cards
- `keywords` - Extracted keywords array

### Dates & Timing
- `start_date` - Unix timestamp
- `end_date` - Unix timestamp  
- `started_running_on` - ISO date string
- `scraped_at` - When the ad was scraped

### URLs & Links
- `permalink_url` - Facebook ad permalink
- `redirected_final_url` - Final destination URL
- `link_url` - Creative link URL

### Additional Metadata
- `page_like_count` - Number of page likes
- `collation_id` - Collation identifier
- `contains_digital_created_media` - Digital media flag
- `contains_sensitive_content` - Sensitive content flag
- `is_profile_page` - Profile page flag
- `page_is_deleted` - Page deletion status

## Production Considerations

### OpenSearch Settings
- Uses 1 primary shard for ~1M docs (avoid oversharding)
- Refresh interval set to 1s for near real-time search
- Replica count set to 1 for optimal write performance
- Uses flattened mapping for dynamic attributes

### Performance Tuning
- Batch size: 5,000 documents or 10MB (whichever comes first)
- Concurrency: 2 concurrent operations
- Routing: Uses `page_id` or `countrySearchedfor` for shard routing
- External versioning: Optional for conflict resolution
- Facebook Ads specific: Optimized for high-frequency ad updates

### Monitoring
- Structured logging with Winston
- Health check endpoints for Kubernetes/Docker
- Comprehensive statistics and metrics
- Error tracking and retry mechanisms

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Lint code
npm run lint
```

## Docker Deployment

The service includes a production-ready Dockerfile with:
- Node.js 18 Alpine base image
- Non-root user for security
- Health checks
- Graceful shutdown handling
- Optimized layer caching

## License

MIT License
