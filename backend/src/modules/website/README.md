# Website CMS module (Phase 2 — implemented)

- `website.model.ts` — WebsiteContent singleton (school identity, hero, about, principal, programs, faculty highlights, facilities, testimonials, contact/map, footer, publish flag). Also backs `/api/v1/settings` views.
- `contentItem.model.ts` — PublicContentItem: news / event / gallery / announcement with status, audience, publishAt.
- `enquiry.model.ts` — public contact-form enquiries with status + history.
- `website.routes.ts` — public reads (`GET /public`, `GET /public/items`), public enquiry POST (rate-limited), Admin CMS (`/admin/content`, `/admin/items`, `/admin/enquiries`). Principals may manage announcements only (service-enforced).
- Public reads return published + public-audience content only; role-targeted announcements never leak.
- Image/file upload is NOT implemented: fields hold URLs until Cloudinary/S3 is configured (§34). Never fake an upload.
