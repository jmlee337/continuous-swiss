import {FlowRouter} from 'meteor/kadira:flow-router';
import {Ladders} from '/lib/collections.js';
import {Template} from 'meteor/templating';

import './index.html';

Template.index.onCreated(function() {
  this.subscribe('ladders');
});

Template.index.helpers({
  'ladders': function() {
    return Ladders.find({});
  },
});

Template.index.events({
  'submit .createLadder': function(event) {
    Meteor.call('createLadder', event.target.ladderName.value, (err, slug) => {
      if (err) {

      } else if (slug) {
        FlowRouter.go('/ladder/' + slug);
      }
    });
    return false;
  },

  'click .clearDb': function(event) {
    Meteor.call('clearDb');
  },
});
