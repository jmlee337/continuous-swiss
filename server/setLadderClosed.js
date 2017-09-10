import {Ladders} from '/lib/collections.js';
import {Meteor} from 'meteor/meteor';

import {check} from 'meteor/check';

Meteor.methods({
  setLadderClosed: function(ladderId, closed) {
    check(ladderId, String);
    check(closed, Boolean);

    Ladders.update(ladderId, {$set: {closed: closed}});
  },
});
