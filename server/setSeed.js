import {Ladders} from '../lib/collections.js';
import {Meteor} from 'meteor/meteor';
import {Players} from '../lib/collections.js';

import {check} from 'meteor/check';
import {getOrderedSeededPlayerIds} from '/server/helpers/helpers.js';

Meteor.methods({
  setSeed: function(ladderId, playerId, n) {
    check(ladderId, String);
    check(playerId, String);
    check(n, Match.Integer);
    if (Ladders.findOne(ladderId).started) {
      throw new Meteor.Error('PRECONDITION_FAILED', 'match has started');
    }

    const seededPlayerIds = getOrderedSeededPlayerIds(ladderId);
    if (!(n >= 0 && n < seededPlayerIds.length) &&
        n !== Number.MAX_SAFE_INTEGER) {
      throw new Meteor.Error('BAD_REQUEST', 'invalid seed specified');
    }

    const index = seededPlayerIds.indexOf(playerId);
    if (index === -1 && n !== Number.MAX_SAFE_INTEGER) {
      Players.update(playerId, {$set: {seed: n}});
      for (let i = n; i < seededPlayerIds.length; i++) {
        Players.update(seededPlayerIds[i], {$inc: {seed: 1}});
      }
    } else if (n > index) {
      Players.update(playerId, {$set: {seed: n}});
      const stopIndex = Math.min(n + 1, seededPlayerIds.length);
      for (let i = index + 1; i < stopIndex; i++) {
        Players.update(seededPlayerIds[i], {$inc: {seed: -1}});
      }
    } else if (n < index) {
      Players.update(playerId, {$set: {seed: n}});
      for (let i = n; i < index; i++) {
        Players.update(seededPlayerIds[i], {$inc: {seed: 1}});
      }
    }
  },
});
