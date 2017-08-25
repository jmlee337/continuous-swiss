import {BlazeLayout} from 'meteor/kadira:blaze-layout';
import {FlowRouter} from 'meteor/kadira:flow-router';

FlowRouter.route('/', {
  action: function() {
    BlazeLayout.render('appBody', {main: 'laddersPage'});
  }
});

FlowRouter.route('/ladder/:slug', {
  action: function(params) {
    BlazeLayout.render('appBody', {main: 'ladderPage'});
  }
});
