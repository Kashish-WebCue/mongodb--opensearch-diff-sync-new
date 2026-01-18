# Facebook Ads OpenSearch Query Examples

This document provides example queries for searching and filtering Facebook ads data in OpenSearch.

## Basic Search Queries

### Search by Page Name
```json
GET /facebook-ads-read/_search
{
  "query": {
    "match": {
      "page_name": "Vehicles-Safe.online"
    }
  }
}
```

### Search by Advertiser Name
```json
GET /facebook-ads-read/_search
{
  "query": {
    "match": {
      "advertiser_name": "Vehicles-Safe"
    }
  }
}
```

### Search by Keywords
```json
GET /facebook-ads-read/_search
{
  "query": {
    "terms": {
      "keywords": ["Voitures", "Abordables", "Occasion"]
    }
  }
}
```

## Filtering Queries

### Filter by Country
```json
GET /facebook-ads-read/_search
{
  "query": {
    "bool": {
      "filter": [
        {
          "term": {
            "countrySearchedfor": "FR"
          }
        }
      ]
    }
  }
}
```

### Filter by Platform
```json
GET /facebook-ads-read/_search
{
  "query": {
    "bool": {
      "filter": [
        {
          "term": {
            "platforms.facebook": true
          }
        },
        {
          "term": {
            "platforms.instagram": true
          }
        }
      ]
    }
  }
}
```

### Filter by Active Status
```json
GET /facebook-ads-read/_search
{
  "query": {
    "bool": {
      "filter": [
        {
          "term": {
            "is_active": true
          }
        }
      ]
    }
  }
}
```

### Filter by Date Range
```json
GET /facebook-ads-read/_search
{
  "query": {
    "bool": {
      "filter": [
        {
          "range": {
            "start_date": {
              "gte": 1733126400,
              "lte": 1733558400
            }
          }
        }
      ]
    }
  }
}
```

## Complex Filtering

### Multiple Country Filter
```json
GET /facebook-ads-read/_search
{
  "query": {
    "bool": {
      "filter": [
        {
          "terms": {
            "countrySearchedfor_all": ["FR", "DE", "ES"]
          }
        }
      ]
    }
  }
}
```

### Publisher Platform Filter
```json
GET /facebook-ads-read/_search
{
  "query": {
    "bool": {
      "filter": [
        {
          "terms": {
            "publisher_platform": ["FACEBOOK", "INSTAGRAM"]
          }
        }
      ]
    }
  }
}
```

### Page Categories Filter
```json
GET /facebook-ads-read/_search
{
  "query": {
    "bool": {
      "filter": [
        {
          "terms": {
            "page_categories": ["Media/news company", "Business"]
          }
        }
      ]
    }
  }
}
```

## Search with Aggregations

### Count by Country
```json
GET /facebook-ads-read/_search
{
  "size": 0,
  "aggs": {
    "countries": {
      "terms": {
        "field": "countrySearchedfor",
        "size": 10
      }
    }
  }
}
```

### Count by Platform
```json
GET /facebook-ads-read/_search
{
  "size": 0,
  "aggs": {
    "platforms": {
      "terms": {
        "field": "publisher_platform",
        "size": 10
      }
    }
  }
}
```

### Date Range Aggregation
```json
GET /facebook-ads-read/_search
{
  "size": 0,
  "aggs": {
    "ads_over_time": {
      "date_histogram": {
        "field": "start_date",
        "calendar_interval": "day"
      }
    }
  }
}
```

## Text Search Queries

### Search in Creative Headlines
```json
GET /facebook-ads-read/_search
{
  "query": {
    "match": {
      "creative.headline": "voiture occasion"
    }
  }
}
```

### Search in Snapshot Body Text
```json
GET /facebook-ads-read/_search
{
  "query": {
    "match": {
      "snapshot.body.text": "véhicules d'occasion"
    }
  }
}
```

### Multi-field Search
```json
GET /facebook-ads-read/_search
{
  "query": {
    "multi_match": {
      "query": "voiture",
      "fields": [
        "page_name",
        "advertiser_name",
        "creative.headline",
        "snapshot.body.text",
        "keywords"
      ]
    }
  }
}
```

## Advanced Queries

### Boolean Query with Must and Should
```json
GET /facebook-ads-read/_search
{
  "query": {
    "bool": {
      "must": [
        {
          "term": {
            "is_active": true
          }
        }
      ],
      "should": [
        {
          "match": {
            "page_name": "vehicle"
          }
        },
        {
          "match": {
            "creative.headline": "car"
          }
        }
      ],
      "minimum_should_match": 1
    }
  }
}
```

### Filter by Page Like Count Range
```json
GET /facebook-ads-read/_search
{
  "query": {
    "bool": {
      "filter": [
        {
          "range": {
            "page_like_count": {
              "gte": 10000,
              "lte": 1000000
            }
          }
        }
      ]
    }
  }
}
```

### Search with Highlighting
```json
GET /facebook-ads-read/_search
{
  "query": {
    "match": {
      "page_name": "vehicle"
    }
  },
  "highlight": {
    "fields": {
      "page_name": {},
      "advertiser_name": {},
      "creative.headline": {}
    }
  }
}
```

## Performance Tips

1. **Use Filters**: Prefer `filter` over `must` for exact matches as filters are cached
2. **Limit Fields**: Use `_source` to limit returned fields
3. **Pagination**: Use `from` and `size` for pagination
4. **Sorting**: Use `sort` for consistent ordering
5. **Routing**: Include routing parameter when querying by `page_id`

### Example with Performance Optimizations
```json
GET /facebook-ads-read/_search?routing=112978047824911
{
  "query": {
    "bool": {
      "filter": [
        {
          "term": {
            "page_id": "112978047824911"
          }
        },
        {
          "term": {
            "is_active": true
          }
        }
      ]
    }
  },
  "_source": [
    "ad_archive_id",
    "page_name",
    "advertiser_name",
    "start_date",
    "end_date"
  ],
  "sort": [
    {
      "start_date": {
        "order": "desc"
      }
    }
  ],
  "size": 20
}
```
