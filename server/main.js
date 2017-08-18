import {Meteor} from 'meteor/meteor';

import {Pairings} from '../lib/collections.js';
import {Players} from '../lib/collections.js';
import {Queue} from '../lib/queue.js';

const NUM_SETUPS = 1;
const SCORE_THRESHOLD = 0;

Meteor.methods({
  addPlayer: function(playerName) {
    Players.insert({
      name: playerName,
      score: 0,
      queue: Queue.NONE,
      queueTime: Date.now()
    });
  },

  queuePlayer: function(playerId) {
    let playerToQueue = Players.findOne(playerId);
    if (!playerToQueue) {
      throw new Meteor.Error("BAD_REQUEST", "player not found");
    }

    if (playerToQueue.score >= SCORE_THRESHOLD) {
      // match then wait
      let matchedPlayer = findMatchInMatchmaking(playerToQueue);
      if (matchedPlayer) {
        Players.update(matchedPlayer._id, {$set: {queue: Queue.WAITING, queueTime: Date.now()}});
        Players.update(playerToQueue._id, {$set: {queue: Queue.WAITING, queueTime: Date.now()}});
        Pairings.insert({
          player1Id: matchedPlayer._id,
          player1Name: matchedPlayer.name,
          player2Id: playerToQueue._id,
          player2Name: playerToQueue.name,
          queue: Queue.WAITING,
          queueTime: Date.now()
        });
      } else {
        Players.update(playerToQueue._id, {$set: {queue: Queue.MATCHMAKING, queueTime: Date.now()}});
      }
    } else {
      // wait then match
      let pairingId = findMatchInWaiting(playerToQueue);
      if (pairingId) {
        Pairings.update(
          pairingId, {
          $set: {
            player2Id: playerToQueue._id,
            player2Name: playerToQueue.name
          }
        });
      } else {
        Pairings.insert({
          player1Id: playerToQueue._id,
          player1Name: playerToQueue.name,
          queue: Queue.WAITING,
          queueTime: Date.now()
        });
      }
      Players.update(playerToQueue._id, {$set: {queue: Queue.WAITING, queueTime: Date.now()}});
    }

    // it's possible we moved a pairing to the front of the waiting queue
    tryPromoteWaitingPair();
  },

	clearDb: function() {
		Players.remove({});
    Pairings.remove({});
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
    sort: [['queueTime', 'asc']]
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
