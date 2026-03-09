/* ============================================
   GitHub API Module
   Fetches user data and calculates boat stats
   ============================================ */

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function getCacheKey(type, username) {
  return `gitboat_${type}_${username.toLowerCase()}`;
}

function getFromCache(key) {
  try {
    const cached = sessionStorage.getItem(key);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < CACHE_TTL) {
        return parsed.data;
      }
      sessionStorage.removeItem(key);
    }
  } catch (e) {
    console.warn('Cache read error:', e);
  }
  return null;
}

function setInCache(key, data) {
  try {
    sessionStorage.setItem(key, JSON.stringify({
      timestamp: Date.now(),
      data
    }));
  } catch (e) {
    console.warn('Cache write error:', e);
  }
}

async function fetchFromGitHub(url) {
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Sailor not found on these seas.');
    }
    if (response.status === 403) {
      const remaining = response.headers.get('x-ratelimit-remaining');
      if (remaining === '0') {
        throw new Error('The API seas are too rough (Rate limit exceeded). Try again later.');
      }
    }
    throw new Error(`GitHub API error: ${response.statusText}`);
  }

  return response.json();
}

export async function fetchUserProfile(username) {
  const cacheKey = getCacheKey('profile', username);
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const data = await fetchFromGitHub(`https://api.github.com/users/${username}`);
  setInCache(cacheKey, data);
  return data;
}

export async function fetchUserRepos(username) {
  const cacheKey = getCacheKey('repos', username);
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  // Fetch up to 100 public repos (sorting by updated to get most relevant if they have more)
  const data = await fetchFromGitHub(`https://api.github.com/users/${username}/repos?per_page=100&sort=updated`);
  setInCache(cacheKey, data);
  return data;
}

export function calculateBoatStats(profile, repos) {
  let totalSizeProxy = 0;
  let totalStars = 0;
  const languageCounts = {};

  repos.forEach(repo => {
    totalSizeProxy += (repo.size || 0);
    totalStars += (repo.stargazers_count || 0);
    
    if (repo.language) {
      // Weight primary language by repo size to find the true main language
      languageCounts[repo.language] = (languageCounts[repo.language] || 0) + (repo.size || 1);
    }
  });

  let primaryLanguage = 'Unknown';
  let maxLangScore = 0;
  for (const [lang, score] of Object.entries(languageCounts)) {
    if (score > maxLangScore) {
      maxLangScore = score;
      primaryLanguage = lang;
    }
  }

  // Calculate account age in years
  const createdAt = new Date(profile.created_at);
  const now = new Date();
  const ageInMilliseconds = now - createdAt;
  const ageInYears = ageInMilliseconds / (1000 * 60 * 60 * 24 * 365.25);

  return {
    totalCommits: Math.max(profile.public_repos, Math.floor(totalSizeProxy / 50)), // Rough approximation
    publicRepos: profile.public_repos,
    totalStars: totalStars,
    followers: profile.followers,
    following: profile.following,
    accountAge: Math.floor(ageInYears * 10) / 10, // 1 decimal place
    avatarUrl: profile.avatar_url,
    primaryLanguage: primaryLanguage
  };
}
