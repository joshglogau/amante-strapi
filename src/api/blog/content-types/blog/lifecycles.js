'use strict';

const crypto = require('crypto');

const REVISION_UID = 'api::blog-revision.blog-revision';

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
    return;
  }

  await strapi.db.query(REVISION_UID).create({
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
      await createRevision(event.result, 'initial');
    } catch (error) {
      strapi.log.error('Failed to create initial blog body revision', error);
    }
  },

  async beforeUpdate(event) {
    const nextBody = event.params?.data?.body;

    if (nextBody === undefined) {
      return;
    }

    try {
      const existingBlog = await findExistingBlog(event.params.where);

      if (!existingBlog?.body || bodyHash(existingBlog.body) === bodyHash(nextBody)) {
        return;
      }

      await createRevision(existingBlog, 'before-update');
    } catch (error) {
      strapi.log.error('Failed to create blog body revision before update', error);
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

      await createRevision(updatedBlog, 'after-update');
    } catch (error) {
      strapi.log.error('Failed to create blog body revision after update', error);
    }
  },
};
