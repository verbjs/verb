import type { OAuth2Provider, OAuth2UserInfo } from "../types.js";

export const OAUTH2_PROVIDERS: Record<string, OAuth2Provider> = {
  google: {
    name: "google",
    clientId: "",
    clientSecret: "",
    redirectUri: "",
    scope: ["openid", "email", "profile"],
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
  },
  github: {
    name: "github",
    clientId: "",
    clientSecret: "",
    redirectUri: "",
    scope: ["user:email"],
    authUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    userInfoUrl: "https://api.github.com/user",
  },
  discord: {
    name: "discord",
    clientId: "",
    clientSecret: "",
    redirectUri: "",
    scope: ["identify", "email"],
    authUrl: "https://discord.com/api/oauth2/authorize",
    tokenUrl: "https://discord.com/api/oauth2/token",
    userInfoUrl: "https://discord.com/api/users/@me",
  },
};

export class OAuth2UserInfoNormalizer {
  /**
   * Normalize user info from different OAuth2 providers
   */
  static normalize(provider: string, userInfo: any): OAuth2UserInfo {
    switch (provider) {
      case "google":
        return this.normalizeGoogle(userInfo);
      case "github":
        return this.normalizeGitHub(userInfo);
      case "discord":
        return this.normalizeDiscord(userInfo);
      default:
        throw new Error(`Unsupported OAuth2 provider: ${provider}`);
    }
  }

  private static normalizeGoogle(userInfo: any): OAuth2UserInfo {
    return {
      id: userInfo.id,
      email: userInfo.email,
      name: userInfo.name,
      username: userInfo.email?.split("@")[0],
      avatar: userInfo.picture,
      verified: userInfo.verified_email || false,
    };
  }

  private static normalizeGitHub(userInfo: any): OAuth2UserInfo {
    return {
      id: userInfo.id?.toString(),
      email: userInfo.email,
      name: userInfo.name,
      username: userInfo.login,
      avatar: userInfo.avatar_url,
      verified: true, // GitHub emails are considered verified
    };
  }

  private static normalizeDiscord(userInfo: any): OAuth2UserInfo {
    return {
      id: userInfo.id,
      email: userInfo.email,
      name: userInfo.global_name || userInfo.username,
      username: userInfo.username,
      avatar: userInfo.avatar
        ? `https://cdn.discordapp.com/avatars/${userInfo.id}/${userInfo.avatar}.png`
        : undefined,
      verified: userInfo.verified || false,
    };
  }
}

export function createOAuth2Provider(
  name: string,
  config: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scope?: string[];
  }
): OAuth2Provider {
  const baseProvider = OAUTH2_PROVIDERS[name];
  if (!baseProvider) {
    throw new Error(`Unknown OAuth2 provider: ${name}`);
  }

  return {
    ...baseProvider,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
    scope: config.scope || baseProvider.scope,
  };
}