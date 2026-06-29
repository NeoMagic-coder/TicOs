export function isClerkEnabled() {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
}

export const DEV_USER_ID = "dev-user";
export const DEV_USER = {
  id: DEV_USER_ID,
  firstName: "Demo",
  fullName: "Demo Kullanıcı",
  primaryEmailAddress: { emailAddress: "demo@ticosclaw.local" },
};
