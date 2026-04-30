const ALLOWED_ORIGIN = 'hhttps://boeingliam-deployments.github.io/afp-portal/'; // Lock this down to your GitHub Pages URL for security


const ROBLOX_APIS = {
  userByName: 'https://users.roblox.com/v1/usernames/users',
  userById:   'https://users.roblox.com/v1/users/',
  avatar:     'https://thumbnails.roblox.com/v1/users/avatar-headshot',
  presence:   'https://presence.roblox.com/v1/presence/users',
  friends:    'https://friends.roblox.com/v1/users/',
  games:      'https://games.roblox.com/v2/users/',
  badges:     'https://badges.roblox.com/v1/users/',
};

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/^\//, '');
  const params = Object.fromEntries(url.searchParams);

  let result = null;

  try {
    // ── GET /user?name=USERNAME ──────────────────────────────
    if (path === 'user' && params.name) {
      const nameRes = await fetch(ROBLOX_APIS.userByName, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames: [params.name], excludeBannedUsers: false })
      });
      const nameData = await nameRes.json();
      const user = nameData.data?.[0];
      if (!user) return jsonResponse({ error: 'User not found' }, 404);
      result = await enrichUser(user.id);
    }

    // ── GET /user?id=USERID ──────────────────────────────────
    else if (path === 'user' && params.id) {
      result = await enrichUser(parseInt(params.id));
    }

    else {
      return jsonResponse({ error: 'Unknown route' }, 400);
    }

    return jsonResponse(result);

  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

async function enrichUser(userId) {
  // Fetch basic profile + avatar in parallel
  const [profileRes, avatarRes] = await Promise.all([
    fetch(`${ROBLOX_APIS.userById}${userId}`),
    fetch(`${ROBLOX_APIS.avatar}?userIds=${userId}&size=150x150&format=Png&isCircular=false`)
  ]);

  const profile = await profileRes.json();
  const avatarData = await avatarRes.json();
  const avatarUrl = avatarData.data?.[0]?.imageUrl || null;

  // Fetch friend count
  let friendCount = null;
  try {
    const frRes = await fetch(`${ROBLOX_APIS.friends}${userId}/count`);
    const frData = await frRes.json();
    friendCount = frData.count ?? null;
  } catch {}

  // Fetch badge count
  let badgeCount = null;
  try {
    const bdRes = await fetch(`${ROBLOX_APIS.badges}${userId}/badges?limit=10`);
    const bdData = await bdRes.json();
    badgeCount = bdData.data?.length ?? null;
  } catch {}

  return {
    id: profile.id,
    name: profile.name,
    displayName: profile.displayName,
    description: profile.description || '',
    created: profile.created,
    isBanned: profile.isBanned || false,
    avatarUrl,
    friendCount,
    badgeCount,
    profileUrl: `https://www.roblox.com/users/${profile.id}/profile`,
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    }
  });
}
