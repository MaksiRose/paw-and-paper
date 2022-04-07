const bfd = require('bfd-api-redux');
const { AutoPoster } = require('topgg-autoposter');
const Topgg = require('@top-gg/sdk');
const express = require('express');
const fs = require('fs');
const RateLimit = require('express-rate-limit');

const limiter = new RateLimit({
	windowMs: 60 * 1000,
	max: 20,
});

module.exports = {
	async execute(client) {

		const bfdClient = new bfd(client.votes.bfd.token, '862718885564252212');
		const bfdAuthorization = client.votes.bfd.authorization;
		client.votes.bfd = bfdClient;

		const serverCount = client.guilds.cache.size;
		client.votes.bfd.setServers(serverCount);

		const bfdApp = express();

		bfdApp.use(express.json());
		bfdApp.use(limiter);

		bfdApp.post('/discords', (request, response) => {

			if (request.headers.authorization === bfdAuthorization) {

				const voteCache = JSON.parse(fs.readFileSync('./database/voteCache.json'));

				voteCache[request.body.user] = voteCache[request.body.user] ?? {};
				voteCache[request.body.user].lastRecordedDiscordsVote = Date.now();

				fs.writeFileSync('./database/voteCache.json', JSON.stringify(voteCache, null, '\t'));
			}

			response.status(200).end();
		});

		bfdApp.listen(3002);


		AutoPoster(client.votes.top.token, client);

		const topApi = new Topgg.Api(client.votes.top.token);
		const topApp = express();
		const webhook = new Topgg.Webhook(client.votes.top.authorization);

		client.votes.top = topApi;

		topApp.post('/top', webhook.listener(async vote => {

			const voteCache = JSON.parse(fs.readFileSync('./database/voteCache.json'));

			voteCache[vote.user] = voteCache[vote.user] ?? {};
			voteCache[vote.user].lastRecordedTopVote = Date.now();

			fs.writeFileSync('./database/voteCache.json', JSON.stringify(voteCache, null, '\t'));
		}));

		topApp.listen(3000);


		const dblApp = express();

		dblApp.use(express.json());
		dblApp.use(limiter);

		dblApp.post('/dbl', (request, response) => {

			if (request.headers.authorization === client.votes.dbl.authorization) {

				const voteCache = JSON.parse(fs.readFileSync('./database/voteCache.json'));

				voteCache[request.body.id] = voteCache[request.body.id] ?? {};
				voteCache[request.body.id].lastRecordedDblVote = Date.now();

				fs.writeFileSync('./database/voteCache.json', JSON.stringify(voteCache, null, '\t'));
			}

			response.status(200).end();
		});

		dblApp.listen(3001);
	},
};