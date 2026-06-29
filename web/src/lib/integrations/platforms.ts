export const PLATFORMS = [
  { id: "instagram", name: "Instagram", color: "#E4405F", oauthPath: "/api/integrations/instagram" },
  { id: "facebook", name: "Facebook", color: "#1877F2", oauthPath: "/api/integrations/facebook" },
  { id: "linkedin", name: "LinkedIn", color: "#0A66C2", oauthPath: "/api/integrations/linkedin" },
  { id: "gmail", name: "Gmail", color: "#EA4335", oauthPath: "/api/integrations/gmail" },
  { id: "outlook", name: "Outlook", color: "#0078D4", oauthPath: "/api/integrations/outlook" },
  { id: "wordpress", name: "WordPress", color: "#21759B", oauthPath: "/api/integrations/wordpress" },
  { id: "reddit", name: "Reddit", color: "#FF4500", oauthPath: "/api/integrations/reddit" },
] as const;

export type PlatformId = (typeof PLATFORMS)[number]["id"];
