/**
 * Strict parsing for external media used as statement-source provenance.
 *
 * This module deliberately does not extend StatementVideo. Facebook and
 * Instagram references may document footage, but only a bounded YouTube
 * excerpt (or a rights-cleared Cloudinary upload) can power verified voting.
 */

export const MAX_MEDIA_SOURCE_URL_LENGTH = 2_048;

export interface YouTubeMediaSource {
  platform: "youtube";
  kind: "video";
  id: string;
  canonicalUrl: string;
}

export interface FacebookMediaSource {
  platform: "facebook";
  kind: "video" | "reel" | "share" | "shortlink";
  id: string;
  canonicalUrl: string;
}

export interface InstagramMediaSource {
  platform: "instagram";
  kind: "post" | "reel" | "tv";
  id: string;
  canonicalUrl: string;
}

export type ParsedMediaSource =
  | YouTubeMediaSource
  | FacebookMediaSource
  | InstagramMediaSource;

const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const FACEBOOK_VIDEO_ID_PATTERN = /^[1-9][0-9]{4,31}$/;
const FACEBOOK_TOKEN_PATTERN = /^[A-Za-z0-9_-]{3,128}$/;
const FACEBOOK_PAGE_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;
const INSTAGRAM_SHORTCODE_PATTERN = /^[A-Za-z0-9_-]{5,64}$/;

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
]);
const YOUTUBE_EMBED_HOSTS = new Set([
  ...YOUTUBE_HOSTS,
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);
const YOUTUBE_SHORT_HOSTS = new Set(["youtu.be", "www.youtu.be"]);
const FACEBOOK_HOSTS = new Set([
  "facebook.com",
  "www.facebook.com",
  "m.facebook.com",
  "web.facebook.com",
]);
const FACEBOOK_SHORT_HOSTS = new Set(["fb.watch", "www.fb.watch"]);
const INSTAGRAM_HOSTS = new Set([
  "instagram.com",
  "www.instagram.com",
  "m.instagram.com",
]);

function safeHttpUrl(input: string): URL | undefined {
  const value = input.trim();
  if (
    !value ||
    value.length > MAX_MEDIA_SOURCE_URL_LENGTH ||
    /[\u0000-\u001f\u007f\\]/.test(value)
  ) {
    return undefined;
  }

  try {
    const url = new URL(value);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password ||
      url.port
    ) {
      return undefined;
    }
    return url;
  } catch {
    return undefined;
  }
}

function singleQueryValue(url: URL, key: string): string | undefined {
  const values = url.searchParams.getAll(key);
  return values.length === 1 ? values[0] : undefined;
}

function parseYouTubeUrl(url: URL): YouTubeMediaSource | undefined {
  const host = url.hostname.toLowerCase();
  let id: string | undefined;

  if (YOUTUBE_SHORT_HOSTS.has(host)) {
    const match = /^\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname);
    id = match?.[1];
  } else if (YOUTUBE_HOSTS.has(host) && /^\/watch\/?$/.test(url.pathname)) {
    id = singleQueryValue(url, "v");
  } else if (YOUTUBE_EMBED_HOSTS.has(host)) {
    const match =
      /^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname);
    id = match?.[1];
  }

  if (!id || !YOUTUBE_VIDEO_ID_PATTERN.test(id)) return undefined;
  return {
    platform: "youtube",
    kind: "video",
    id,
    canonicalUrl: `https://www.youtube.com/watch?v=${id}`,
  };
}

function parseFacebookUrl(url: URL): FacebookMediaSource | undefined {
  const host = url.hostname.toLowerCase();

  if (FACEBOOK_SHORT_HOSTS.has(host)) {
    const match = /^\/([A-Za-z0-9_-]{3,128})\/?$/.exec(url.pathname);
    const id = match?.[1];
    if (!id || !FACEBOOK_TOKEN_PATTERN.test(id)) return undefined;

    // fb.watch is a redirect token, not a Facebook video ID. Preserve the
    // canonical short link rather than resolving it over the network or
    // pretending it can be used as a verified player identifier.
    return {
      platform: "facebook",
      kind: "shortlink",
      id,
      canonicalUrl: `https://fb.watch/${id}/`,
    };
  }

  if (!FACEBOOK_HOSTS.has(host)) return undefined;

  const watchPath = /^\/watch(?:\/live)?\/?$/.test(url.pathname);
  const legacyVideoPath = /^\/video\.php\/?$/.test(url.pathname);
  if (watchPath || legacyVideoPath) {
    const id = singleQueryValue(url, "v");
    if (!id || !FACEBOOK_VIDEO_ID_PATTERN.test(id)) return undefined;
    return {
      platform: "facebook",
      kind: "video",
      id,
      canonicalUrl: `https://www.facebook.com/watch/?v=${id}`,
    };
  }

  const pageVideoMatch =
    /^\/([A-Za-z0-9._-]{1,100})\/videos\/([1-9][0-9]{4,31})\/?$/.exec(
      url.pathname
    );
  if (
    pageVideoMatch &&
    FACEBOOK_PAGE_PATTERN.test(pageVideoMatch[1]) &&
    FACEBOOK_VIDEO_ID_PATTERN.test(pageVideoMatch[2])
  ) {
    const id = pageVideoMatch[2];
    return {
      platform: "facebook",
      kind: "video",
      id,
      canonicalUrl: `https://www.facebook.com/watch/?v=${id}`,
    };
  }

  const reelMatch = /^\/reel\/([1-9][0-9]{4,31})\/?$/.exec(url.pathname);
  if (reelMatch && FACEBOOK_VIDEO_ID_PATTERN.test(reelMatch[1])) {
    const id = reelMatch[1];
    return {
      platform: "facebook",
      kind: "reel",
      id,
      canonicalUrl: `https://www.facebook.com/reel/${id}/`,
    };
  }

  const shareMatch =
    /^\/share\/(v|r)\/([A-Za-z0-9_-]{3,128})\/?$/.exec(url.pathname);
  if (shareMatch && FACEBOOK_TOKEN_PATTERN.test(shareMatch[2])) {
    const shareKind = shareMatch[1];
    const id = shareMatch[2];
    return {
      platform: "facebook",
      kind: "share",
      id,
      canonicalUrl: `https://www.facebook.com/share/${shareKind}/${id}/`,
    };
  }

  return undefined;
}

function parseInstagramUrl(url: URL): InstagramMediaSource | undefined {
  const host = url.hostname.toLowerCase();
  if (!INSTAGRAM_HOSTS.has(host)) return undefined;

  const match =
    /^\/(p|reel|tv)\/([A-Za-z0-9_-]{5,64})\/?$/.exec(url.pathname);
  if (!match || !INSTAGRAM_SHORTCODE_PATTERN.test(match[2])) return undefined;

  const kind =
    match[1] === "p" ? "post" : (match[1] as "reel" | "tv");
  const id = match[2];
  return {
    platform: "instagram",
    kind,
    id,
    canonicalUrl: `https://www.instagram.com/${match[1]}/${id}/`,
  };
}

export function parseYouTubeMediaSourceUrl(
  input: string
): YouTubeMediaSource | undefined {
  const url = safeHttpUrl(input);
  return url ? parseYouTubeUrl(url) : undefined;
}

export function parseFacebookMediaSourceUrl(
  input: string
): FacebookMediaSource | undefined {
  const url = safeHttpUrl(input);
  return url ? parseFacebookUrl(url) : undefined;
}

export function parseInstagramMediaSourceUrl(
  input: string
): InstagramMediaSource | undefined {
  const url = safeHttpUrl(input);
  return url ? parseInstagramUrl(url) : undefined;
}

/** Parse a supported public media URL without following redirects. */
export function parseMediaSourceUrl(
  input: string
): ParsedMediaSource | undefined {
  const url = safeHttpUrl(input);
  if (!url) return undefined;

  const host = url.hostname.toLowerCase();
  if (YOUTUBE_HOSTS.has(host) || YOUTUBE_EMBED_HOSTS.has(host) || YOUTUBE_SHORT_HOSTS.has(host)) {
    return parseYouTubeUrl(url);
  }
  if (FACEBOOK_HOSTS.has(host) || FACEBOOK_SHORT_HOSTS.has(host)) {
    return parseFacebookUrl(url);
  }
  if (INSTAGRAM_HOSTS.has(host)) {
    return parseInstagramUrl(url);
  }
  return undefined;
}

/** Return a stable HTTPS URL with tracking parameters removed. */
export function canonicalizeMediaSourceUrl(input: string): string | undefined {
  return parseMediaSourceUrl(input)?.canonicalUrl;
}

/**
 * Only YouTube source URLs may seed an external StatementVideo configuration.
 * A true result still requires bounded timestamps and the normal publication
 * checks; Facebook and Instagram remain source provenance only.
 */
export function canConfigureExternalVotingVideo(
  source: ParsedMediaSource
): source is YouTubeMediaSource {
  return source.platform === "youtube";
}
