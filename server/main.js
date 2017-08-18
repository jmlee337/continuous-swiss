import { Meteor } from 'meteor/meteor';

import { Players } from '../lib/collections.js';
import { Queue } from '../lib/queue.js';

const NUM_SETUPS = 1;
const SCORE_THRESHOLD = 0;

Meteor.methods({
  addPlayer: function(playerName) {
    Players.insert({
      name: playerName,
      queue: Queue.NONE,
    });
  },

  queuePlayer: function(_id) {
    let playerToQueue = Players.findOne(_id);
    if (!playerToQueue) {
      throw new Meteor.Error("BAD_REQUEST", "player not found");
    }

    if (playerToQueue.score >= SCORE_THRESHOLD) {
      // match then wait
      let matchedPlayerId = findMatchInMatchmaking(playerToQueue);
      if (matchedPlayerId) {
        Players.update(matchedPlayerId, {$set: {queue: Queue.WAITING, queueTime: Date.now()}});
        Players.update(_id, {$set: {queue: Queue.WAITING, queueTime: Date.now()}});
        Pairings.insert({
          player1Id: matchedPlayerId,
          player2Id: _id,
          queue: Queue.WAITING,
          queueTime: Date.now()
        });
      } else {
        Players.update(_id, {$set: {queue: Queue.MATCHMAKING, queueTime: Date.now()}});
      }
    } else {
      // wait then match
      let pairingId = findMatchInWaiting(playerToQueue);
      if (pairingId) {
        Pairings.update(pairingId, {$set: {player2Id: _id}});
      } else {
        Pairings.insert({player1Id: _id, queueTime: Date.now()});
      }
      Players.update(_id, {$set: {queue: Queue.WAITING, queueTime: Date.now()}});
    }

    // it's possible we moved a pairing to the front of the waiting queue
    tryPromoteWaitingPair();
  },

	clearDb: function() {
		Players.remove({});
	},
});

const findMatchInMatchmaking = function(queuingPlayer) {
  // TODO
  return null;
};

const findMatchInWaiting = function(queuingPlayer) {
  // TODO
  return null;

};

const tryPromoteWaitingPair = function() {
  if (Pairings.find({queue: Queue.PLAYING}).count() >= NUM_SETUPS) {
    return;
  }

  let pairingToPlay = Pairings.findOne({
    queue: Queue.WAITING,
    player1Id: {$exists: true},
    player2Id: {$exists: true}
  }, {
    sort: [['queueTime', 'desc']]
  });
  if (!pairingToPlay) {
    return;
  }

  Players.update(pairingToPlayer.player1Id, {queue: Queue.PLAYING, queueTime: Date.now()});
  Players.update(pairingToPlayer.player2Id, {queue: Queue.PLAYING, queueTime: Date.now()});
  Pairings.update(pairingToPlay._id, {queue: Queue.PLAYING, queueTime: Date.now()});

  // there could be more
  tryPromoteWaitingPair();
};
