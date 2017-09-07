import {Meteor} from 'meteor/meteor';
import {Setups} from '/lib/collections.js';

import {check} from 'meteor/check';

Meteor.methods({
  removeSetup: function(ladderId, setupId) {
    check(ladderId, String);
    check(setupId, String);

    Setups.remove(setupId);
  },
});
