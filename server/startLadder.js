import {Ladders} from '/lib/collections.js';
import {Meteor} from 'meteor/meteor';
import {Players} from '/lib/collections.js';
import {SeedsOptions} from '/lib/seeds.js';

import {check} from 'meteor/check';

Meteor.methods({
  startLadder: function(ladderId) {
    check(ladderId, String);

    const playersCursor = Players.find({ladderId: ladderId}, SeedsOptions);
    playersCursor.forEach((player, i) => {
      if (player.seed === Number.MAX_SAFE_INTEGER) {
        Players.update(player._id, {$set: {seed: i, queueTime: Date.now()}});
      } else {
        if (player.seed !== i) {
          throw new Meteor.Error('INTERNAL', 'gap in seeds somehow');
        }
        Players.update(player._id, {$set: {queueTime: Date.now()}});
      }
    });
    Ladders.update(
        ladderId, {$set: {started: true, numSeeds: playersCursor.count()}});
  },
});
