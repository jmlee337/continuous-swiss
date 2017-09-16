import {Ladders} from '/lib/collections.js';
import {Meteor} from 'meteor/meteor';
import {Players} from '/lib/collections.js';
import {SeedsOptions} from '/lib/seeds.js';

import {check} from 'meteor/check';

Meteor.methods({
  startLadder: function(ladderId) {
    check(ladderId, String);

    const players = Players.find({ladderId: ladderId}, SeedsOptions).fetch();
    const middle = Math.floor(players.length / 2);
    for (let i = 0; i < middle; i++) {
      updatePlayer(players[i], i);
    }
    for (let i = players.length - 1; i >= middle; i--) {
      updatePlayer(players[i], i);
    }
    Ladders.update(
        ladderId, {$set: {started: true, numSeeds: players.length}});
  },
});

function updatePlayer(player, i) {
  console.log(player.name);
  if (player.seed === Number.MAX_SAFE_INTEGER) {
    Players.update(player._id, {$set: {seed: i, queueTime: Date.now()}});
  } else {
    if (player.seed !== i) {
      throw new Meteor.Error('INTERNAL', 'gap in seeds somehow');
    }
    Players.update(player._id, {$set: {queueTime: Date.now()}});
  }
}
