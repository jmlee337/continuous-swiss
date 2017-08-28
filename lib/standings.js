import {Queue} from './queue.js';

export const StandingsSelector = Object.freeze({
  games: {$gt: 0},
  queue: {$ne: Queue.FROZEN},
});

export const standingsSortFn = function(a, b) {
  if (a.score !== b.score) {
    return b.score - a.score;
  }
  return b.wins / b.games - a.wins / a.games;
};
