const { Client } = require('@opensearch-project/opensearch');
const config = require('../config');
const logger = require('../utils/logger');

class OpenSearchService {
  constructor() {
    this.client = new Client({
      node: config.opensearch.url,
      auth: {
        username: config.opensearch.username,
        password: config.opensearch.password
      },
      ssl: config.opensearch.ssl
    });
    this.indexName = config.opensearch.index;
    this.indexAlias = config.opensearch.indexAlias;
  }

  async initialize() {
    try {
      await this.createIndexIfNotExists();
      await this.setupIndexAlias();
      await this.setupIndexSettings();
      logger.info('OpenSearch service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize OpenSearch service:', error);
      throw error;
    }
  }

  async deleteIndex() {
    try {
      const exists = await this.client.indices.exists({
        index: this.indexName
      });

      if (exists.body) {
        await this.client.indices.delete({
          index: this.indexName
        });
        logger.info(`Deleted index: ${this.indexName}`);
      } else {
        logger.info(`Index ${this.indexName} does not exist, skipping deletion`);
      }
    } catch (error) {
      logger.error(`Failed to delete index ${this.indexName}:`, error);
      throw error;
    }
  }

  async createIndexIfNotExists() {
    const exists = await this.client.indices.exists({
      index: this.indexName
    });

    if (!exists.body) {
      await this.client.indices.create({
        index: this.indexName,
        body: {
          settings: {
            number_of_shards: 1,
            number_of_replicas: 1,
            refresh_interval: '1s',
            'index.mapping.total_fields.limit': 2000
          },
          mappings: {
            properties: {
              mongo_id: { type: 'keyword' },
              ad_archive_id: { type: 'keyword' },
              library_id: { type: 'keyword' },
              page_id: { type: 'keyword' },
              page_name: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              advertiser_name: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              status: { type: 'keyword' },
              is_active: { type: 'boolean' },
              started_running_on: { type: 'date' },
              start_date: { type: 'date' },
              scraped_at: { type: 'date' },
              permalink_url: { type: 'keyword' },
              redirected_final_url: { type: 'keyword' },
              currency: { type: 'keyword' },
              keywords: { type: 'keyword' },
              countrySearchedfor: { type: 'keyword' },
              search_country: { type: 'keyword' },
              country: { type: 'keyword' },
              region: { type: 'keyword' },
              platforms: {
                properties: {
                  facebook: { type: 'boolean' },
                  instagram: { type: 'boolean' },
                  messenger: { type: 'boolean' },
                  audience_network: { type: 'boolean' }
                }
              },
              publisher_platform: { type: 'keyword' },
              creative: {
                properties: {
                  headline: { type: 'text', fields: { keyword: { type: 'keyword' } } },
                  body: { type: 'text' },
                  cta: { type: 'keyword' },
                  cta_text: { type: 'keyword' },
                  cta_type: { type: 'keyword' },
                  link_url: { type: 'keyword' },
                  redirected_final_url: { type: 'keyword' },
                  image_url: { type: 'keyword' },
                  image_urls: { type: 'keyword' },
                  video_url: { type: 'keyword' },
                  video_urls: { type: 'keyword' },
                  media_items: {
                    properties: {
                      type: { type: 'keyword' },
                      url: { type: 'keyword' },
                      videoUrl: { type: 'keyword' }
                    }
                  },
                  cards: {
                    properties: {
                      image_url: { type: 'keyword' },
                      title: { type: 'text', fields: { keyword: { type: 'keyword' } } },
                      body: { type: 'text' },
                      caption: { type: 'text' },
                      cta_text: { type: 'keyword' },
                      cta_type: { type: 'keyword' },
                      link_url: { type: 'keyword' },
                      redirected_final_url: { type: 'keyword' }
                    }
                  }
                }
              },
              snapshot: {
                properties: {
                  images: {
                    properties: {
                      original_image_url: { type: 'keyword' },
                      resized_image_url: { type: 'keyword' },
                      watermarked_resized_image_url: { type: 'keyword' },
                      url: { type: 'keyword' },
                      image_url: { type: 'keyword' }
                    }
                  },
                  videos: {
                    properties: {
                      video_preview_image_url: { type: 'keyword' },
                      video_hd_url: { type: 'keyword' },
                      video_sd_url: { type: 'keyword' }
                    }
                  },
                  cards: {
                    properties: {
                      original_image_url: { type: 'keyword' },
                      resized_image_url: { type: 'keyword' },
                      watermarked_resized_image_url: { type: 'keyword' },
                      video_preview_image_url: { type: 'keyword' },
                      video_hd_url: { type: 'keyword' },
                      video_sd_url: { type: 'keyword' },
                      title: { type: 'text', fields: { keyword: { type: 'keyword' } } },
                      body: { type: 'text' },
                      caption: { type: 'text' },
                      cta_text: { type: 'keyword' },
                      cta_type: { type: 'keyword' },
                      link_url: { type: 'keyword' },
                      redirected_final_url: { type: 'keyword' }
                    }
                  },
                  cta_text: { type: 'keyword' },
                  cta_type: { type: 'keyword' },
                  link_url: { type: 'keyword' },
                  redirected_final_url: { type: 'keyword' },
                  body: {
                    properties: {
                      text: { type: 'text' }
                    }
                  },
                  title: { type: 'text', fields: { keyword: { type: 'keyword' } } },
                  caption: { type: 'text' }
                }
              },
              // Additional fields for filtering
              search_query: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              search_media_type: { type: 'keyword' },
              search_type: { type: 'keyword' },
              categories: { type: 'keyword' },
              page_categories: { type: 'keyword' },
              page_like_count: { type: 'long' },
              end_date: { type: 'date' },
              collation_id: { type: 'keyword' },
              collation_count: { type: 'long' },
              contains_digital_created_media: { type: 'boolean' },
              contains_sensitive_content: { type: 'boolean' },
              is_profile_page: { type: 'boolean' },
              page_is_deleted: { type: 'boolean' },
              page_entity_type: { type: 'keyword' },
              entity_type: { type: 'keyword' },
              gated_type: { type: 'keyword' },
              hide_data_status: { type: 'keyword' },
              is_aaa_eligible: { type: 'boolean' },
              targeted_or_reached_countries: { type: 'keyword' },
              political_countries: { type: 'keyword' },
              countrySearchedfor_all: {
                properties: {
                  country: { type: 'keyword' },
                  is_active: { type: 'boolean' }
                }
              },
              // URL Filter fields
              'url-filter': {
                properties: {
                  'url-filter-url': { type: 'keyword' },
                  'url-filter-name': { type: 'text', fields: { keyword: { type: 'keyword' } } },
                  'url-filter-id': { type: 'keyword' },
                  'matched-url': { type: 'keyword' }
                }
              },
              'url-filter-updated-at': { type: 'date' }
            }
          }
        }
      });
      logger.info(`Created index: ${this.indexName}`);
    }
  }

  async setupIndexAlias() {
    try {
      await this.client.indices.putAlias({
        index: this.indexName,
        name: this.indexAlias
      });
      logger.info(`Setup alias: ${this.indexAlias} -> ${this.indexName}`);
    } catch (error) {
      logger.warn('Failed to setup index alias:', error.message);
    }
  }

  async setupIndexSettings() {
    try {
      await this.client.indices.putSettings({
        index: this.indexName,
        body: {
          settings: {
            refresh_interval: '1s',
            number_of_replicas: 1
          }
        }
      });
    } catch (error) {
      logger.warn('Failed to update index settings:', error.message);
    }
  }

  async bulkIndex(documents) {
    if (!documents || documents.length === 0) {
      return { success: true, processed: 0 };
    }

    const body = [];

    for (const doc of documents) {
      const docId = doc._id.toString();

      // Process url-filter object to convert ObjectId to string if needed
      let urlFilter = null;
      if (doc['url-filter']) {
        urlFilter = { ...doc['url-filter'] };
        // Convert url-filter-id ObjectId to string if present
        if (urlFilter['url-filter-id'] && typeof urlFilter['url-filter-id'].toString === 'function') {
          urlFilter['url-filter-id'] = urlFilter['url-filter-id'].toString();
        }
      }

      // Index action
      body.push({
        update: {
          _index: this.indexName,
          _id: docId,
          routing: doc.page_id || doc.countrySearchedfor || docId,
          retry_on_conflict: 3 // Retry up to 3 times on version conflicts
        }
      });

      // Document content
      body.push({
        doc: {
          mongo_id: docId,
          ad_archive_id: doc.ad_archive_id,
          library_id: doc.library_id,
          page_id: doc.page_id,
          page_name: doc.page_name,
          advertiser_name: doc.advertiser_name,
          status: doc.status,
          is_active: doc.is_active,
          started_running_on: doc.started_running_on,
          start_date: doc.start_date,
          scraped_at: doc.scraped_at,
          permalink_url: doc.permalink_url,
          redirected_final_url: doc.redirected_final_url,
          currency: doc.currency,
          keywords: doc.keywords,
          countrySearchedfor: doc.countrySearchedfor,
          search_country: doc.search_country,
          country: doc.country,
          region: doc.region,
          platforms: doc.platforms,
          publisher_platform: doc.publisher_platform,
          creative: doc.creative,
          snapshot: doc.snapshot,
          // Additional fields
          search_query: doc.search_query,
          search_media_type: doc.search_media_type,
          search_type: doc.search_type,
          categories: doc.categories,
          page_categories: doc.page_categories,
          page_like_count: doc.page_like_count,
          end_date: doc.end_date,
          collation_id: doc.collation_id,
          collation_count: doc.collation_count,
          contains_digital_created_media: doc.contains_digital_created_media,
          contains_sensitive_content: doc.contains_sensitive_content,
          is_profile_page: doc.is_profile_page,
          page_is_deleted: doc.page_is_deleted,
          page_entity_type: doc.page_entity_type,
          entity_type: doc.entity_type,
          gated_type: doc.gated_type,
          hide_data_status: doc.hide_data_status,
          is_aaa_eligible: doc.is_aaa_eligible,
          targeted_or_reached_countries: doc.targeted_or_reached_countries,
          political_countries: doc.political_countries,
          // Normalize countrySearchedfor_all to always be an array of objects
          countrySearchedfor_all: Array.isArray(doc.countrySearchedfor_all)
            ? doc.countrySearchedfor_all.map(item => {
              if (typeof item === 'string') {
                return { country: item, is_active: null };
              }
              if (item && typeof item === 'object') {
                return {
                  country: item.country || null,
                  is_active: item.is_active !== undefined ? item.is_active : null
                };
              }
              return null;
            }).filter(item => item !== null)
            : doc.countrySearchedfor_all,
          // URL Filter fields
          'url-filter': urlFilter,
          'url-filter-updated-at': doc['url-filter-updated-at'] || null
        },
        doc_as_upsert: true
      });
    }

    try {
      const response = await this.client.bulk({
        body,
        refresh: false // Don't wait for refresh for better performance
      });

      const errors = response.body.items.filter(item =>
        item.update && item.update.error
      );

      // Separate version conflicts from actual errors
      const versionConflicts = errors.filter(item =>
        item.update.error.type === 'version_conflict_engine_exception'
      );
      const actualErrors = errors.filter(item =>
        item.update.error.type !== 'version_conflict_engine_exception'
      );

      if (versionConflicts.length > 0) {
        logger.debug(`Bulk index had ${versionConflicts.length} version conflicts (retried but still failed)`);
      }

      if (actualErrors.length > 0) {
        logger.warn(`Bulk index completed with ${actualErrors.length} actual errors:`, actualErrors);
      }

      return {
        success: true,
        processed: documents.length,
        errors: actualErrors.length,
        versionConflicts: versionConflicts.length,
        took: response.body.took
      };
    } catch (error) {
      logger.error('Bulk index failed:', error);
      throw error;
    }
  }

  async deleteDocument(docId) {
    try {
      await this.client.delete({
        index: this.indexName,
        id: docId,
        refresh: false
      });
      return { success: true };
    } catch (error) {
      if (error.statusCode === 404) {
        logger.warn(`Document ${docId} not found for deletion`);
        return { success: true };
      }
      logger.error(`Failed to delete document ${docId}:`, error);
      throw error;
    }
  }

  async healthCheck() {
    try {
      const response = await this.client.cluster.health({
        index: this.indexName
      });

      return {
        status: response.body.status,
        cluster_name: response.body.cluster_name,
        number_of_nodes: response.body.number_of_nodes,
        active_shards: response.body.active_shards
      };
    } catch (error) {
      logger.error('OpenSearch health check failed:', error);
      throw error;
    }
  }

  async getIndexStats() {
    try {
      const response = await this.client.indices.stats({
        index: this.indexName
      });

      return {
        docs_count: response.body.indices[this.indexName].total.docs.count,
        store_size: response.body.indices[this.indexName].total.store.size_in_bytes,
        index_size: response.body.indices[this.indexName].total.indexing.index_total
      };
    } catch (error) {
      logger.error('Failed to get index stats:', error);
      throw error;
    }
  }
}

module.exports = OpenSearchService;
