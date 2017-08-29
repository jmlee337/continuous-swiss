import {Queue} from './queue.js';
import {Result} from './result.js';

export const StandingsSelector = Object.freeze({
  games: {$gt: 0},
  queue: {$ne: Queue.FROZEN},
});

export const standingsSortFn = function(a, b) {
  const scoreDiff = b.score - a.score;
  if (scoreDiff !== 0) {
    return scoreDiff;
  }

  const winPercentageDiff = b.wins / b.games - a.wins / a.games;
  if (winPercentageDiff !== 0) {
    return winPercentageDiff;
  }

  // it's possible to have same win% but diff wins if both undefeated and one
  // is late entrant.
  const winDiff = b.wins - a.wins;
  if (winDiff !== 0) {
    return winDiff;
  }

  // whoever had a better 'path', ~more wins earlier.
  // with same wins and win%, they have to have played the same number of games.
  for (let i = 0; i < b.results.length; i++) {
    const bResult = b.results[i];
    if (bResult === a.results[i]) {
      continue;
    }
    return bResult === Result.WIN ? 1 : -1;
  }

  // if they had the same path they can't have played each other (that would
  // cause a divergence). So there's no head-to-head to use.
  return 0;
};
