import {Meteor} from 'meteor/meteor';
import {Players} from '/lib/collections.js';
import {Queue} from '/lib/queue.js';

import {check} from 'meteor/check';

Meteor.methods({
  cullPlayer: function(ladderId, playerId) {
    check(ladderId, String);
    check(playerId, String);

    Players.update(
        playerId, {$set: {queue: Queue.FROZEN, queueTime: Date.now()}});
  },
});
