import {FlowRouter} from 'meteor/kadira:flow-router';
import {Ladders} from '/lib/collections.js';
import {Pairings} from '/lib/collections.js';
import {ReactiveDict} from 'meteor/reactive-dict';
import {Template} from 'meteor/templating';

import './ladderReporting.html';

Template.ladderReporting.onCreated(function() {
  this.dict = new ReactiveDict();
  let handles = [];

  this.autorun(() => {
    handles.forEach((handle) => {
      handle.stop();
    });
    handles = [];

    handles.push(this.subscribe('ladder', FlowRouter.getParam('slug'), () => {
      const ladder = Ladders.findOne();
      this.dict.set('name', ladder.name);

      handles.push(this.subscribe('pairings', ladder._id));
    }));
  });
});

Template.ladderReporting.helpers({
  'ladderName': function() {
    return Template.instance().dict.get('name');
  },

  'pairings': function() {
    return Pairings.find({}, {sort: [['queueTime', 'asc']]});
  },

  'pairing': function() {
    return Pairings.findOne(Template.instance().dict.get('pairingId'));
  },

  'submitError': function() {
    return Template.instance().dict.get('submitError');
  }
});

Template.ladderReporting.events({
  'click .pair': function(event, templateInstance) {
    templateInstance.dict.set('pairingId', event.currentTarget.id);
  },

  'click .cancel': function(event, templateInstance) {
    templateInstance.dict.set('pairingId', undefined);
  },

  'submit #form': function(event, templateInstance) {
    const winner = event.target.winner.value;
    if (!winner) {
      templateInstance.dict.set('submitError', 'select a winner!');
      return false;
    }

    const ladderId = Ladders.findOne()._id;
    const pairingId = event.target.pairingId.value;
    const winnerInt = winner === '2' ? 2 : 1;

    const pairing = Pairings.findOne(pairingId);
    const player1Method =
        event.target.player1.value === 'yes' ? 'queuePlayer' : 'unqueue';
    const player2Method =
        event.target.player2.value === 'yes' ? 'queuePlayer' : 'unqueue';

    Meteor.call('submitWinner', ladderId, pairingId, winnerInt, (err) => {
      if (err && err.error !== 'PRECONDITION_FAILED') {
        const errMsg = 'Ask for help: ' + err.error + ', ' + err.reason;
        templateInstance.dict.set('submitError', errMsg);
      } else {
        templateInstance.dict.set('submitError', undefined);
        Meteor.call(player1Method, ladderId, pairing.player1Id, (err) => {
          if (err) {
            const originalErr = templateInstance.dict.get('submitError');
            templateInstance.dict.set(
                'submitError',
                originalErr ? originalErr + '\n' : '' + 'Ask for help: ' +
                    pairing.player1Name + ', ' + err.error + ', ' + err.reason);
          }
        });
        Meteor.call(player2Method, ladderId, pairing.player2Id, (err) => {
          if (err && err.error !== 'PRECONDITION_FAILED') {
            const originalErr = templateInstance.dict.get('submitError');
            templateInstance.dict.set(
                'submitError',
                originalErr ? originalErr + '\n' : '' + 'Ask for help: ' +
                    pairing.player2Name + ', ' + err.error + ', ' + err.reason);
          }
        });
      }
    });
    return false;
  },
});
