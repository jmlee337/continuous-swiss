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
});

Template.ladderReporting.events({
  'click .pair': function(event, templateInstance) {
    templateInstance.dict.set('pairingId', event.currentTarget.id);
  },

  'submit #form': function(event, templateInstance) {
    console.log(event.target.winner.value);
    console.log(event.target.player1.value);
    console.log(event.target.player2.value);
    return false;
  },
});
