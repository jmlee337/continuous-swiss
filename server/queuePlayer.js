import {Ladders} from '/lib/collections.js';
import {Meteor} from 'meteor/meteor';
import {Players} from '/lib/collections.js';
import {Queue} from '/lib/queue.js';

import {check} from 'meteor/check';
import {modeFn} from '/lib/mode.js';

Meteor.methods({
  queuePlayer: function(ladderId, playerId) {
    check(ladderId, String);
    check(playerId, String);

    const ladder = Ladders.findOne(ladderId);
    if (!ladder) {
      throw new Meteor.Error('BAD_REQUEST', 'ladder does not exist');
    }
    if (ladder.closed) {
      throw new Meteor.Error('PRECONDITION_FAILED', 'ladder is closed');
    }
    const player = Players.findOne(playerId);
    if (!player) {
      throw new Meteor.Error('BAD_REQUEST', 'player not found');
    }

    const set = {queueTime: Date.now()};
    let playerBonuses = player.bonuses;
    if (player.games === 0) {
      const firstPlace = Players.findOne(
        {ladderId: ladderId, bonuses: 0, score: {$gt: 0}},
        {sort: [['score', 'desc']]});
      if (firstPlace) {
        const bonuses = Math.floor(firstPlace.score / 2);
        if (bonuses > 0) {
          set.score = bonuses;
          set.bonuses = bonuses;
          playerBonuses = bonuses;
        }
      }
    } else {
      const findArgs = {ladderId: ladderId, queue: {$ne: Queue.NONE}};
      const modeGames =modeFn(Players.find(findArgs).fetch());
      if (player.games > modeGames + 1) {
        throw new Meteor.Error('PRECONDITION_FAILED', 'player is ahead');
      }
    }

    if (player.games >= playerBonuses) {
      set.queue = Queue.MATCHMAKING;
    } else {
      set.queue = Queue.WAITING;
    }
    Players.update(playerId, {$set: set});
  },
});
