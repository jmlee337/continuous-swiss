import {Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';
import {Pairings} from '/lib/collections.js';
import {Players} from '/lib/collections.js';
import {Queue} from '/lib/queue.js';

import {check} from 'meteor/check';
import {queuePlayerCommon} from '/server/main.js';

Meteor.methods({
  // quitterNumber: 1 or 2 (player 1/player 2)
  unqueueFromWaiting: function(ladderId, pairingId, quitterNumber) {
    check(ladderId, String);
    check(pairingId, String);
    check(quitterNumber, Match.Integer);

    if (!(quitterNumber === 1 || quitterNumber === 2)) {
      throw new Meteor.Error('BAD_REQUEST', 'quitter number not 1 or 2');
    }
    const pairing = Pairings.findOne(pairingId);
    if (!pairing) {
      throw new Meteor.Error('BAD_REQUEST', 'pairing not found');
    }
    if (pairing.queue !== Queue.WAITING) {
      throw new Meteor.Error('BAD_REQUEST', 'pairing not in waiting Queue');
    }

    if (quitterNumber === 1) {
      Players.update(
          pairing.player1Id,
          {$set: {queue: Queue.NONE, queueTime: Date.now()}});
      if (pairing.player2Id) {
        queuePlayerCommon(ladderId, pairing.player2Id, false);
      }
      Pairings.remove(pairingId);
    } else {
      Players.update(
          pairing.player2Id,
          {$set: {queue: Queue.NONE, queueTime: Date.now()}});
      queuePlayerCommon(ladderId, pairing.player1Id, false);
      Pairings.remove(pairingId);
    }
  },
});
