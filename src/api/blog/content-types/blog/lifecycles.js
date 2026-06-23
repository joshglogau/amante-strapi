'use strict';

const crypto = require('crypto');

const REVISION_UID = 'api::blog-revision.blog-revision';
const MAX_REVISIONS_PER_POST = 25;
const CLOUDFLARE_PURGE_URL = 'https://api.cloudflare.com/client/v4/zones';

const stableStringify = (value) => JSON.stringify(value ?? null);

const bodyHash = (body) =>
  crypto.createHash('sha256').update(stableStringify(body)).digest('hex');

const textFromNode = (node) => {
  if (!node) {
    return '';
  }

  if (typeof node.text === 'string') {
    return node.text;
  }

  if (Array.isArray(node.children)) {
    return node.children.map(textFromNode).filter(Boolean).join(' ');
  }

  return '';
};

const textFromBlocks = (blocks, maxLength) => {
  if (!Array.isArray(blocks)) {
    return '';
  }

  const text = blocks
    .map(textFromNode)
    .filter(Boolean)
    .join('\n\n')
    .replace(/\s+/g, ' ')
    .trim();

  return maxLength ? text.slice(0, maxLength) : text;
};

const createRevision = async (blog, reason) => {
  if (!blog?.body) {
    return null;
  }

  return strapi.db.query(REVISION_UID).create({
    data: {
      blog: blog.id,
      blogDocumentId: blog.documentId || String(blog.id),
      blogTitle: blog.title || 'Untitled blog post',
      blogSlug: blog.slug || null,
      reason,
      bodySnapshot: blog.body,
      bodyText: textFromBlocks(blog.body),
      bodyPreview: textFromBlocks(blog.body, 500),
      bodyHash: bodyHash(blog.body),
      savedAt: new Date().toISOString(),
    },
  });
};

const cleanupOldRevisions = async (blog) => {
  const blogDocumentId = blog?.documentId || (blog?.id ? String(blog.id) : null);

  if (!blogDocumentId) {
    return;
  }

  const revisions = await strapi.db.query(REVISION_UID).findMany({
    where: { blogDocumentId },
    select: ['id'],
    orderBy: { savedAt: 'desc' },
    limit: 100,
  });

  const staleRevisions = revisions.slice(MAX_REVISIONS_PER_POST);

  await Promise.all(
    staleRevisions.map((revision) =>
      strapi.db.query(REVISION_UID).delete({ where: { id: revision.id } }),
    ),
  );
};

const findExistingBlog = async (where) => {
  if (!where) {
    return null;
  }

  return strapi.db.query('api::blog.blog').findOne({
    where,
    select: ['id', 'documentId', 'title', 'slug', 'body'],
  });
};

const shouldPurgeCloudflare = (event) => {
  if (process.env.CLOUDFLARE_PURGE_ON_PUBLISH === 'false') {
    return false;
  }

  const data = event.params?.data ?? {};
  const publishFieldChanged = Object.prototype.hasOwnProperty.call(data, 'publishedAt');

  return publishFieldChanged && !!event.result?.publishedAt;
};

const purgeCloudflareCache = async (blog) => {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!zoneId || !apiToken) {
    strapi.log.warn('Skipping Cloudflare cache purge; CLOUDFLARE_ZONE_ID or CLOUDFLARE_API_TOKEN is missing');
    return;
  }

  const response = await fetch(`${CLOUDFLARE_PURGE_URL}/${zoneId}/purge_cache`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ purge_everything: true }),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok || result?.success === false) {
    throw new Error(
      `Cloudflare cache purge failed with status ${response.status}: ${JSON.stringify(result)}`,
    );
  }

  strapi.log.info(`Purged Cloudflare cache after publishing blog: ${blog?.slug || blog?.documentId || blog?.id}`);
};

module.exports = {
  async afterCreate(event) {
    try {
      await createRevision(event.result, 'saved');
      await cleanupOldRevisions(event.result);
    } catch (error) {
      strapi.log.error('Failed to create initial blog body revision', error);
    }

    if (event.result?.publishedAt) {
      try {
        await purgeCloudflareCache(event.result);
      } catch (error) {
        strapi.log.error('Failed to purge Cloudflare cache after blog publish', error);
      }
    }
  },

  async afterUpdate(event) {
    const nextBody = event.params?.data?.body;
    const shouldCreateRevision = nextBody !== undefined;
    const shouldPurge = shouldPurgeCloudflare(event);

    if (!shouldCreateRevision && !shouldPurge) {
      return;
    }

    let updatedBlog = event.result;

    if (shouldCreateRevision && !updatedBlog?.body) {
      try {
        updatedBlog = await findExistingBlog(event.params.where);
      } catch (error) {
        strapi.log.error('Failed to load blog after save for revision backup', error);
      }
    }

    if (shouldCreateRevision) {
      try {
        await createRevision(updatedBlog, 'saved');
        await cleanupOldRevisions(updatedBlog);
      } catch (error) {
        strapi.log.error('Failed to create blog body revision after save', error);
      }
    }

    if (shouldPurge) {
      try {
        await purgeCloudflareCache(updatedBlog);
      } catch (error) {
        strapi.log.error('Failed to purge Cloudflare cache after blog publish', error);
      }
    }
  },
};
