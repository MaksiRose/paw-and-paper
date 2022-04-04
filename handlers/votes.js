const bfd = require('bfd-api-redux');
const { AutoPoster } = require('topgg-autoposter');
const Topgg = require('@top-gg/sdk');
const express = require('express');

module.exports = {
	execute(client) {

		const bfdClient = new bfd(client.votes.bfd, client.user.id);
		client.votes.bfd = bfdClient;

		const serverCount = client.guilds.cache.size;
		client.votes.bfd.setServers(serverCount);

		// client.votes.bfd.checkVote('268402976844939266').then(vote => {
		//
		//  console.log(vote);
		// });
		/*
		Structure:
			{
				voted: true,
				votes: [ { userid: '268402976844939266', expires: '1649111130698' } ]
			}
		Questions:
			Does "voted" turn false after 12h?
			Are new votes appearing at the front of the votes array or at the end?
		*/

		AutoPoster(client.votes.top, client);

		// first, create the webhook (this requires a URL that i don't have):

		const app = express();
		const wh = new Topgg.Webhook('webhookauth123');

		app.post('/webhook', wh.listener(async vote => {
			console.log('test');
			// vote is your vote object e.g
			console.log(vote);
			// replace client.votes.top.users[userid] with this newest vote
			// later, this could be checked to see if this user has voted recently. if its empty, then do a manual check:

			// await client.votes.api.hasVoted(userid)
			// => true or false
		}));

		app.listen(3210);
		// In this situation, your TopGG Webhook dashboard should look like
		// URL = http://your.server.ip:80/dblwebhook
		// Authorization: webhookauth123

		// const topApi = new Topgg.Api(client.votes.top);
		// client.votes.top = topApi;
	},
};