'use strict';

const crypto = require('crypto');

const REVISION_UID = 'api::blog-revision.blog-revision';
const MAX_REVISIONS_PER_POST = 25;

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

module.exports = {
  async afterCreate(event) {
    try {
      await createRevision(event.result, 'saved');
      await cleanupOldRevisions(event.result);
    } catch (error) {
      strapi.log.error('Failed to create initial blog body revision', error);
    }
  },

  async afterUpdate(event) {
    const nextBody = event.params?.data?.body;

    if (nextBody === undefined) {
      return;
    }

    try {
      const updatedBlog = event.result?.body
        ? event.result
        : await findExistingBlog(event.params.where);

      await createRevision(updatedBlog, 'saved');
      await cleanupOldRevisions(updatedBlog);
    } catch (error) {
      strapi.log.error('Failed to create blog body revision after save', error);
    }
  },
};
