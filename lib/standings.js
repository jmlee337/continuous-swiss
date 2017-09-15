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

  // it's possible to have same score but diff wins if one is late entrant.
  const winDiff = b.wins - a.wins;
  if (winDiff !== 0) {
    return winDiff;
  }

  // whoever had a better 'path', ~more wins earlier.
  const length = Math.min(a.results.length, b.results.length);
  for (let i = 0; i < length; i++) {
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
