import {Meteor} from 'meteor/meteor';
import {Players} from '/lib/collections.js';
import {Queue} from '/lib/queue.js';

import {check} from 'meteor/check';

Meteor.methods({
  reinstatePlayer: function(ladderId, playerId) {
    check(ladderId, String);
    check(playerId, String);

    const player = Players.findOne(playerId);
    if (!player || player.queue !== Queue.FROZEN) {
      throw new Meteor.Error('PRECONDITION_FAILED', 'player not frozen');
    }

    Players.update(
      playerId, {$set: {queue: Queue.NONE, queueTime: Date.now()}});
  },
});
