'use strict';

const PUBLIC_READ_PERMISSIONS = {
  'blog-post': ['find', 'findOne'],
  author: ['find', 'findOne'],
  category: ['find', 'findOne'],
  tag: ['find', 'findOne'],
};

async function ensurePublicReadPermissions({ strapi }) {
  const publicRole = await strapi.query('plugin::users-permissions.role').findOne({
    where: { type: 'public' },
  });

  if (!publicRole) {
    strapi.log.warn('Public role not found; blog read permissions were not configured.');
    return;
  }

  for (const [controller, actions] of Object.entries(PUBLIC_READ_PERMISSIONS)) {
    for (const actionName of actions) {
      const action = `api::${controller}.${controller}.${actionName}`;
      const existing = await strapi.query('plugin::users-permissions.permission').findOne({
        where: {
          action,
          role: publicRole.id,
        },
      });

      if (!existing) {
        await strapi.query('plugin::users-permissions.permission').create({
          data: {
            action,
            role: publicRole.id,
          },
        });
      }
    }
  }
}

module.exports = ensurePublicReadPermissions;
