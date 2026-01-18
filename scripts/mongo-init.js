// MongoDB initialization script for Facebook Ads
db = db.getSiblingDB('selauto');

// Create collection
db.createCollection('fb_ad');

// Create indexes for better performance
db.fb_ad.createIndex({ "_id": 1 });
db.fb_ad.createIndex({ "page_id": 1 });
db.fb_ad.createIndex({ "ad_archive_id": 1 });
db.fb_ad.createIndex({ "countrySearchedfor": 1 });
db.fb_ad.createIndex({ "search_country": 1 });
db.fb_ad.createIndex({ "is_active": 1 });
db.fb_ad.createIndex({ "start_date": 1 });
db.fb_ad.createIndex({ "end_date": 1 });
db.fb_ad.createIndex({ "scraped_at": 1 });
db.fb_ad.createIndex({ "page_name": 1 });
db.fb_ad.createIndex({ "advertiser_name": 1 });
db.fb_ad.createIndex({ "keywords": 1 });
db.fb_ad.createIndex({ "publisher_platform": 1 });
db.fb_ad.createIndex({ "categories": 1 });

// Insert sample Facebook ad data
db.fb_ad.insertMany([
  {
    _id: ObjectId(),
    ad_archive_id: "922791893318982",
    page_id: "112978047824911",
    page_name: "Vehicles-Safe.online",
    advertiser_name: "Vehicles-Safe.online",
    status: "Active",
    is_active: true,
    started_running_on: "2024-12-01T00:00:00.000Z",
    start_date: 1733126400,
    end_date: 1733558400,
    scraped_at: new Date(),
    permalink_url: "https://www.facebook.com/ads/library/?id=922791893318982",
    redirected_final_url: "https://daily-advisor.com/conduisez-votre-reve-des-voitures-abordables-en-vente-des-maintenant/?campaign=1287",
    currency: "EUR",
    keywords: ["Conduisez", "Votre", "Reve", "Des", "Voitures", "Abordables"],
    countrySearchedfor: "FR",
    search_country: "FR",
    country: "FR",
    region: "Europe",
    platforms: {
      facebook: true,
      instagram: true,
      messenger: false,
      audience_network: true
    },
    publisher_platform: ["FACEBOOK", "INSTAGRAM", "AUDIENCE_NETWORK"],
    search_query: "daily-advisor.com",
    search_media_type: "all",
    categories: ["UNKNOWN"],
    page_categories: ["Media/news company"],
    page_like_count: 107525,
    collation_id: "579118541160156",
    collation_count: 1,
    contains_digital_created_media: false,
    contains_sensitive_content: false,
    is_profile_page: false,
    page_is_deleted: false,
    page_entity_type: "PERSON_PROFILE",
    entity_type: "PERSON_PROFILE",
    gated_type: "ELIGIBLE",
    hide_data_status: "NONE",
    is_aaa_eligible: true,
    targeted_or_reached_countries: [],
    political_countries: [],
    countrySearchedfor_all: ["FR"]
  }
]);

print('MongoDB initialization completed for Facebook Ads');
