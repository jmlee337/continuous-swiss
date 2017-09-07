import {Ladders} from '/lib/collections.js';
import {Meteor} from 'meteor/meteor';

import {check} from 'meteor/check';

import slug from 'slug';

slug.defaults.mode ='rfc3986';

Meteor.methods({
  createLadder: function(name) {
    check(name, String);

    const ladderSlug = slug(name);
    if (Ladders.findOne({slug: ladderSlug})) {
      throw new Meteor.Error('BAD_REQUEST', 'name matches existing tournament');
    }
    Ladders.insert({slug: ladderSlug, name: name, started: false});
    return ladderSlug;
  },
});
