import { Mongo } from 'meteor/mongo';

/**
 * name: the name of the player.
 * queue: the queue the player is in.
 */
export const Players = new Mongo.Collection('players');
