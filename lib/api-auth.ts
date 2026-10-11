import { headers } from "next/headers";

export type ApiUser = {
  userId: string;
  email: string;
};

export async function getApiUser(): Promise<ApiUser | null> {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");

  if (!userId || !email) return null;
  return { userId, email };
}

export function unauthorized() {
  return Response.json(
    { error: "Sign in with ChatGPT to save private pet photos." },
    { status: 401 },
  );
}
