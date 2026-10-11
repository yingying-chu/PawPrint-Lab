# Pawprint Atelier: 3D MVP integration

When `MESHY_API_KEY` is set, creating a twin runs two Meshy steps: image-to-image (nano-banana-pro, background removed) redraws the owner's first saved photo as a cute, toy-like character without harness or leash, then image-to-3D builds a remeshed ~30k-triangle model from that image via `input_task_id`. Job statuses: `styling` → `starting_3d` → `submitted` → `saving` → `ready`. Roughly 9 + 30 credits per twin. `GET /api/twin-jobs/:id` polls the task and copies the finished GLB into private R2 storage, served from `/api/twin-jobs/:id/model`. Sticker generation (`/api/characters`) uses Meshy image-to-image only when the owner opts in to sharing the photo.

## Implemented foundation

- One-photo capture with optional additional angles
- Reusable demo reference image
- Basic client-side file-quality and capture guidance
- Separate Visual Twin and Fit Profile readiness states
- Back, chest, and neck values stored in centimeters regardless of display unit
- Explicit owner confirmation before labeling a profile measurement-calibrated
- Honest prototype job state while no private provider is connected
- Server-only Meshy client in `lib/meshy.ts` (image-to-3D, text/image-to-image)

## Required production services

1. Private object storage for original images, processed images, and GLB files.
2. A server endpoint that receives an authenticated pet profile and creates a job.
3. A background worker that removes the background, requests a 3D model, polls the provider, downloads the GLB, and updates the job.
4. A database for pets, measurements, photo metadata, provider task IDs, model URLs, and deletion status.
5. Signed URLs with short expiration times whenever a provider needs to read a private image.
6. A retention and deletion policy for pet photos and generated models.

## Suggested job record

```json
{
  "id": "job_123",
  "petId": "pet_123",
  "status": "queued",
  "provider": "meshy",
  "providerTaskId": null,
  "visualModelUrl": null,
  "fitCalibration": {
    "source": "owner_measurements",
    "confirmed": false
  },
  "error": null
}
```

## Server flow

1. Accept the upload and store it privately.
2. Run malware/type checks and strip unnecessary metadata.
3. Create a short-lived signed image URL.
4. Call `createImageTo3DTask` from the server only.
5. Save the returned provider task ID.
6. Poll with `getImageTo3DTask` or process a verified webhook.
7. Download the completed GLB into owned storage before the provider URL expires.
8. Normalize orientation, origin, bounding box, polygon count, and texture size.
9. Apply global scale from the confirmed back measurement.
10. Mark the visual model ready and retain chest/neck values for product sizing rules.

## Owner setup required

- Create a Meshy developer account and API key.
- Choose the private storage/database platform.
- Decide the photo retention period and deletion promise.
- Supply manufacturer size charts before enabling fit-sensitive purchasing.
- Collect tape measurements for the demo pet if measurement-calibrated fit should be demonstrated.

Never place the Meshy key in `dist/`, browser JavaScript, Git, screenshots, or chat messages. Configure it as a server-side secret.

