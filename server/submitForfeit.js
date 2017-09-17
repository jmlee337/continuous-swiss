import {Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';
import {Pairings} from '/lib/collections.js';
import {Setups} from '/lib/collections.js';

import {check} from 'meteor/check';
import {giveWinAndLoss} from '/server/main.js';
import {tryPromoteWaitingPairing} from '/server/main.js';

Meteor.methods({
  // quitterNumber: 1 or 2 (player 1/player 2)
  submitForfeit: function(ladderId, pairingId, quitterNumber) {
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

    if (quitterNumber === 1) {
      giveWinAndLoss(
          ladderId,
          pairing.player2Id,
          pairing.player2Name,
          pairing.player2Bonus,
          pairing.player2Seed,
          pairing.player1Id,
          pairing.player1Name,
          pairing.player1Bonus,
          pairing.player1Seed,
          true, // forfeited
          pairing.queueTime);
    } else {
      giveWinAndLoss(
          ladderId,
          pairing.player1Id,
          pairing.player1Name,
          pairing.player1Bonus,
          pairing.player1Seed,
          pairing.player2Id,
          pairing.player2Name,
          pairing.player2Bonus,
          pairing.player2Seed,
          true, // forfeited
          pairing.queueTime);
    }

    Pairings.remove(pairingId);
    if (pairing.setupId) {
      Setups.update(pairing.setupId, {$unset: {pairingId: ''}});
    }
    tryPromoteWaitingPairing(ladderId);
  },
});
