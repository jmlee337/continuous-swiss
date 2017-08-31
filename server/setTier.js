import {Meteor} from 'meteor/meteor';
import {Players} from '/lib/collections.js';

Meteor.methods({
  setTier: function(ladderId, playerId, n) {
    check(ladderId, String);
    check(playerId, String);
    check(n, Match.Integer);

    Players.update(playerId, {$set: {tier: n}});
  },
});
