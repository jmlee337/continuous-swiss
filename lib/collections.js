import {Mongo} from 'meteor/mongo';

/**
 * slug: the url slug of the ladder
 * name: the name of the ladder
 */
export const Ladders = new Mongo.Collection('ladders');

/**
 * ladderId: the _id of the ladder.
 * name: the name of this player.
 * score: this player's score.
 * wins: the number of wins this player has.
 * losses: the nubmer of losses this player has.
 * games: the number of games this player has played.
 * lastMatchId: the _id of this player's last match.
 * playersPlayed: an array of the player _id of the players this player has
      played.
 * bonuses: how many games to apply late entrant provision to this player.
 * queue: the queue this player is in.
 * queueTime: the time that this player enetered the current queue.
 */
export const Players = new Mongo.Collection('players');

/**
 * ladderId: the _id of the ladder.
 * score: the mutual score of the players in this pairing.
 * player1Id: the _id of the player.
 * player1Name: the name of the player.
 * player1Bonus: if the player has a bonus.
 * player2Id: the _id of the player.
 * player2Name: the name of the player.
 * player2Bonus: if the player has a bonus.
 * queue: the queue this pairing is in. Only Queue.MATCHMAKING or Queue.PLAYING.
 * queueTime: the time that this pairing entered the current queue.
 * setupId: the _id of the setup if this pairing is playing.
 * setupNumber: the number of the setup if this pairing is playing.
 */
export const Pairings = new Mongo.Collection('pairings');

/**
 * ladderId: the _id of the ladder.
 * number: the number of this setup.
 * pairingId: the _id of the pairing playing on this setup if any.
 */
export const Setups = new Mongo.Collection('setups');

/**
 * ladderId: the _id of the ladder.
 * winnerId: the _id of the player that won.
 * winnerName: the name of the player that won.
 * winnerBonus: if the winner had a bonus.
 * loserId: the _id of the player that lost.
 * loserName: the name of the player that lost.
 * loserBonus: if the loser had a bonus.
 * unfixable: true if the result of this match cannot be changed.
 * time: the time that this match finished.
 */
export const Matches = new Mongo.Collection('matches');
