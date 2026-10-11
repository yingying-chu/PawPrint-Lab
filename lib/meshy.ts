const API_BASE = "https://api.meshy.ai/openapi/v1";

export async function createImageTo3DTask(apiKey: string, imageUrl: string) {
  const response = await fetch(`${API_BASE}/image-to-3d`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image_url: imageUrl,
      ai_model: "latest",
      model_type: "standard",
      should_remesh: false,
      should_texture: true,
      enable_pbr: true,
      target_formats: ["glb"],
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(String(payload.message ?? `Meshy request failed (${response.status})`));
  }
  return payload;
}

export function arrayBufferToDataUrl(buffer: ArrayBuffer, contentType: string) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return `data:${contentType};base64,${btoa(binary)}`;
}
