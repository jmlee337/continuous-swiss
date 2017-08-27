import {Queue} from './queue.js';

export const StandingsSelector = Object.freeze({
  games: {$gt: 0},
  queue: {$ne: Queue.FROZEN},
});

export const getStandingsSelector = function(ladderId) {
  const selector = {ladderId: ladderId};
  for(let i in StandingsSelector) {
    selector[i] = StandingsSelector[i];
  }
  return Object.freeze(selector);
}

export const standingsSortFn = function(a, b) {
  if (a.score !== b.score) {
    return b.score - a.score;
  }
  return b.wins / b.games - a.wins / a.games;
};
