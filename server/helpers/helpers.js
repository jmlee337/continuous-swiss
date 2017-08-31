import {Players} from '/lib/collections.js';

export function getOrderedSeededPlayerIds(ladderId) {
  return Players.find(
      {ladderId: ladderId, seed: {$lt: Number.MAX_SAFE_INTEGER}},
      {sort: [['seed', 'asc']]})
      .fetch()
      .map((player) => {
        return player._id;
      });
}
