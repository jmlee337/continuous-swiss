import {Meteor} from 'meteor/meteor';
import {Players} from '/lib/collections.js';

import {check} from 'meteor/check';

Meteor.methods({
  removePlayer: function(ladderId, playerId) {
    check(ladderId, String);
    check(playerId, String);

    Players.remove(playerId);
  },
});
