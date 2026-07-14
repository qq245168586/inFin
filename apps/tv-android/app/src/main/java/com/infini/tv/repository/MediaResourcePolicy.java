package com.infini.tv.repository;

/** Defines whether a TV screen is allowed to cache course video resources. */
public enum MediaResourcePolicy {
  CACHE_REQUIRED(true),
  METADATA_ONLY(false);

  private final boolean cacheResources;

  MediaResourcePolicy(boolean cacheResources) {
    this.cacheResources = cacheResources;
  }

  public boolean shouldCacheResources() {
    return cacheResources;
  }
}
