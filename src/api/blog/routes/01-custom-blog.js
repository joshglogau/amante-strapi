'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/blog',
      handler: 'blog.find',
    },
    {
      method: 'GET',
      path: '/blog/:id',
      handler: 'blog.findOne',
    },
  ],
};
