import {Matches} from '/lib/collections.js';
import {Meteor} from 'meteor/meteor';
import {Players} from '/lib/collections.js';
import {Queue} from '/lib/queue.js';
import {Result} from '/lib/result.js';

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
    const winner = Players.findOne(match.winnerId);
    if (winner.queue !== Queue.NONE) {
      throw new Meteor.Error('PRECONDITION_FAILED', 'winner not unqueued');
    }
    if (winner.results.pop() !== Result.WIN) {
      throw new Meteor.Error('INTERNAL', 'winner didnt log a win Result')
    }
    winner.results.push(Result.LOSS);
    const loser = Players.findOne(match.loserId);
    if (loser.queue !== Queue.NONE) {
      throw new Meteor.Error('PRECONDITION_FAILED', 'loser not unqueued');
    }
    if (loser.results.pop() !== Result.LOSS) {
      throw new Meteor.Error('INTERNAL', 'loser didnt log a loss Result');
    }
    loser.results.push(Result.WIN);

    const winnerSeed = match.winnerSeed;
    const loserSeed = match.loserSeed;
    const canSwap =
        winnerSeed !== Number.MAX_SAFE_INTEGER &&
        loserSeed !== Number.MAX_SAFE_INTEGER;
    Players.update(match.winnerId, {
      $inc: {score: match.winnerBonus ? -2 : -1, wins: -1, losses: 1},
      $set: {
        seed: canSwap ? Math.max(winnerSeed, loserSeed) : winnerSeed,
        results: winner.results,
      },
    });
    Players.update(match.loserId, {
      $inc: {score: match.loserBonus ? 2 : 1, wins: 1, losses: -1},
      $set: {
        seed: canSwap ? Math.min(winnerSeed, loserSeed) : loserSeed,
        results: loser.results,
      },
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
