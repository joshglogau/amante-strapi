# Amante Strapi

Strapi 5 backend for the Amante Creations website.

## Content Model

- `Blog Post` (`/api/blogs`): title, slug, excerpt, cover image, published date, author, category, tags, rich text blocks body, featured flag, SEO, and optional source URL.
- `Author` (`/api/authors`): public byline profile with slug, avatar, bio, and social links.
- `Category` (`/api/categories`): primary post grouping with optional sort order.
- `Tag` (`/api/tags`): flexible labels for filtering and discovery.
- `shared.seo`: optional metadata for search and social previews.

The starter `Article`, `About`, `Global`, template components, and seed content have been removed.

## Commands

- install: `npm install`
- dev: `npm run develop`
- start: `npm run start`
- build: `npm run build`
- deploy: `npm run deploy`

## Strapi Cloud

Strapi Cloud runs the deployed app in a hosted environment. The Content-type Builder is only available in development mode, so schema changes should be made in this repo and deployed through the connected Git repository or the Strapi Cloud CLI.

After deployment, set public `find` and `findOne` permissions for blog posts, authors, categories, and tags in the Users & Permissions plugin if the frontend should read content without an API token.

## Notes

- Do not commit API tokens or `.env` files.
- The frontend should populate `coverImage`, `author`, `category`, `tags`, and `seo` when reading blog posts.
- Removing old content-type schemas is intentionally destructive for the old starter models on the next Strapi schema sync.
