import {Ladders} from '../lib/collections.js';
import {Meteor} from 'meteor/meteor';
import {Players} from '../lib/collections.js';

import {check} from 'meteor/check';
import {getOrderedSeededPlayerIds} from '/server/helpers/helpers.js';

Meteor.methods({
  lowerSeed: function(ladderId, playerId) {
    check(ladderId, String);
    check(playerId, String);
    if (Ladders.findOne(ladderId).started) {
      throw new Meteor.Error('PRECONDITION_FAILED', 'match has started');
    }

    const seededPlayerIds = getOrderedSeededPlayerIds(ladderId);
    const index = seededPlayerIds.indexOf(playerId);
    if (index === -1) {
      throw new Meteor.Error('BAD_REQUEST', 'cannot lower seed below unseeded');
    } else if (index === seededPlayerIds.length - 1) {
      Players.update(playerId, {$set: {seed: Number.MAX_SAFE_INTEGER}});
    } else {
      Players.update(playerId, {$inc: {seed: 1}});
      Players.update(seededPlayerIds[index + 1], {$inc: {seed: -1}});
    }
  },
});
