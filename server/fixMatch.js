import {Matches} from '/lib/collections.js';
import {Meteor} from 'meteor/meteor';
import {Players} from '/lib/collections.js';
import {Queue} from '/lib/queue.js';

import {check} from 'meteor/check';

Meteor.methods({
  fixMatch: function(ladderId, matchId) {
    check(ladderId, String);
    check(matchId, String);

    const match = Matches.findOne(matchId);
    if (!match) {
      throw new Meteor.Error('BAD_REQUEST', 'match not found');
    }
    if (match.unfixable) {
      throw new Meteor.Error('PRECONDITION_FAILED', 'match is unfixable');
    }
    if (Players.findOne(match.winnerId).queue !== Queue.NONE) {
      throw new Meteor.Error('PRECONDITION_FAILED', 'winner not unqueued');
    }
    if (Players.findOne(match.loserId).queue !== Queue.NONE) {
      throw new Meteor.Error('PRECONDITION_FAILED', 'loser not unqueued');
    }

    const winnerSeed = match.winnerSeed;
    const loserSeed = match.loserSeed;
    const canSwap =
        winnerSeed !== Number.MAX_SAFE_INTEGER &&
        loserSeed !== Number.MAX_SAFE_INTEGER;
    Players.update(match.winnerId, {
      $inc: {score: match.winnerBonus ? -2 : -1, wins: -1, losses: 1},
      $set: {seed: canSwap ? Math.max(winnerSeed, loserSeed) : winnerSeed},
    });
    Players.update(match.loserId, {
      $inc: {score: match.loserBonus ? 2 : 1, wins: 1, losses: -1},
      $set: {seed: canSwap ? Math.min(winnerSeed, loserSeed) : loserSeed},
    });
    Matches.update(matchId, {$set: {
      winnerId: match.loserId,
      winnerName: match.loserName,
      winnerBonus: match.loserBonus,
      winnerSeed: match.loserSeed,
      loserId: match.winnerId,
      loserName: match.winnerName,
      loserBonus: match.winnerBonus,
      loserSeed: match.winnerSeed,
    }});
  },
});
