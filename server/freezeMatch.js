import {Meteor} from 'meteor/meteor';
import {Pairings} from '/lib/collections.js';
import {Setups} from '/lib/collections.js';

import {check} from 'meteor/check';
import {tryPromoteWaitingPairing} from '/server/main.js';

Meteor.methods({
  'freezeMatch': function(ladderId, pairingId) {
    check(ladderId, String);
    check(pairingId, String);

    const pairing = Pairings.findOne(pairingId);
    if (!pairing) {
      throw new Meteor.Error('BAD_REQUEST', 'pairing not found');
    }
    if (!pairing.setupId || !pairing.setupNumber) {
      throw new Meteor.Error('PRECONDITION_FAILED', 'pairing is frozen');
    }

    Pairings.update(pairingId, {$unset: {setupId: '', setupNumber: ''}});
    Setups.update(pairing.setupId, {$unset: {pairingId: ''}});
    tryPromoteWaitingPairing(ladderId);
  },
});
