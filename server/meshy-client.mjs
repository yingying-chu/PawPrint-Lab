const API_BASE = "https://api.meshy.ai/openapi/v1";

function requireApiKey(apiKey) {
  if (!apiKey) throw new Error("MESHY_API_KEY is required on the server");
}

async function parseResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || `Meshy request failed (${response.status})`);
  }
  return payload;
}

export async function createImageTo3DTask({ apiKey, imageUrl }) {
  requireApiKey(apiKey);
  if (!imageUrl) throw new Error("A private signed image URL or data URI is required");

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

  return parseResponse(response);
}

export async function getImageTo3DTask({ apiKey, taskId }) {
  requireApiKey(apiKey);
  if (!taskId) throw new Error("A Meshy task ID is required");

  const response = await fetch(`${API_BASE}/image-to-3d/${encodeURIComponent(taskId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  return parseResponse(response);
}

