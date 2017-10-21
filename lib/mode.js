import {Queue} from '/lib/queue.js';

export const modeFn = function(players) {
  return players.reduce((modeObj, rPlayer) => {
    const modifier = rPlayer.queue === Queue.FINISHED ? 1 : 0
    const games = rPlayer.games + rPlayer.bonuses - modifier;

    const newFreq = (modeObj.map[games] || 0) + 1;
    modeObj.map[games] = newFreq;
    if (newFreq > modeObj.maxFreq) {
      modeObj.maxFreq = newFreq;
      modeObj.mode = games;
    }
    return modeObj;
  }, {mode: 0, maxFreq: Number.MIN_SAFE_INTEGER, map: {}}).mode;
};
