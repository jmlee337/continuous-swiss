import {Meteor} from 'meteor/meteor';
import {Players} from '/lib/collections.js';
import {Queue} from '/lib/queue.js';

import {check} from 'meteor/check';

Meteor.methods({
  unqueueFromMatchmaking: function(ladderId, playerId) {
    check(ladderId, String);
    check(playerId, String);

    const player = Players.findOne(playerId);
    if (!player) {
      throw new Meteor.Error('BAD_REQUEST', 'player not found');
    }
    if (player.queue !== Queue.MATCHMAKING) {
      throw new Meteor.Error('BAD_REQUEST', 'player is not in matchmaking');
    }

    Players.update(
        playerId, {$set: {queue: Queue.NONE, queueTime: Date.now()}});
  },
});
