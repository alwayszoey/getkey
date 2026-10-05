window.GETKEY_CONFIG = {
  DISCORD_CLIENT_ID: "1555899808701747262",
  DISCORD_REDIRECT_URI: window.location.origin + "/callback",
  DISCORD_OAUTH_SCOPE: "identify",
  DISCORD_API: "https://discord.com/api/v10",
  COOLDOWN_MS: 24 * 60 * 60 * 1000,
  KEY_COOLDOWN: "getkey_cooldown_until",
  KEY_HWID: "getkey_hwid",
  KEY_DATA: "getkey_key",
  KEY_DISCORD: "getkey_discord_user",
  KEY_OAUTH_STATE: "getkey_oauth_state",
  KEY_ACCESS_TOKEN: "getkey_access_token",
  KEY_DURATION: {
    "1day": 1,
    "7day": 7,
    "30day": 30
  }
};
