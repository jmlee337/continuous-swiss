import {Meteor} from 'meteor/meteor';
import {Players} from '/lib/collections.js';
import {Queue} from '/lib/queue.js';

import {check} from 'meteor/check';

Meteor.methods({
  addPlayer: function(ladderId, playerName) {
    check(ladderId, String);
    check(playerName, String);

    Players.insert({
      ladderId: ladderId,
      name: playerName,
      tier: 0,
      seed: Number.MAX_SAFE_INTEGER,
      score: 0,
      wins: 0,
      losses: 0,
      games: 0,
      results: [],
      opponents: [],
      bonuses: 0,
      queue: Queue.NONE,
      queueTime: Date.now(),
    });
  },
});
