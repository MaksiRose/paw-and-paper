import rateLimit from 'express-rate-limit';
import { CustomClient, VoteList } from '../typedef';
const bfd = require('bfd-api-redux');
import express from 'express';
import { readFileSync, writeFileSync } from 'fs';
import AutoPoster from 'topgg-autoposter';
import { Api, Webhook } from '@top-gg/sdk';

/** Updates server count on vote websites, starts event listeners to store successful votes, and adds structure to client to request individual votes */
export async function execute(
	client: CustomClient,
): Promise<void> {

	const limiter = rateLimit({
		windowMs: 60 * 1_000,
		max: 20,
	});

	if (client.votes.bfd && client.votes.bfd.token !== '' && client.votes.bfd.authorization !== '') {

		client.votes.bfd.client = new bfd(client.votes.bfd.token, client.user?.id);
		client.votes.bfd.client.setServers((await client.guilds.fetch()).size);

		const bfdApp = express();

		bfdApp.use(express.json());
		bfdApp.use(limiter);

		bfdApp.post('/discords', (request, response) => {

			if (request.headers.authorization === client.votes.bfd?.authorization) {

				const voteCache = JSON.parse(readFileSync('./database/voteCache.json', 'utf-8')) as VoteList;

				let user = voteCache['id_' + request.body.user];
				if (!user) { user = {}; }
				user.lastRecordedDiscordsVote = Date.now();

				writeFileSync('./database/voteCache.json', JSON.stringify(voteCache, null, '\t'));
			}

			response.status(200).end();
		});

		bfdApp.on('error', (err) => {
			console.error(err);
		});

		bfdApp.listen(3002);
	}

	if (client.votes.top && client.votes.top.token !== '' && client.votes.top.authorization !== '') {

		AutoPoster(client.votes.top.token, client);

		client.votes.top.client = new Api(client.votes.top.token);
		const webhook = new Webhook(client.votes.top.authorization);

		const topApp = express();

		topApp.use(express.json());
		topApp.use(limiter);

		topApp.post('/top', webhook.listener(async vote => {

			const voteCache = JSON.parse(readFileSync('./database/voteCache.json', 'utf-8')) as VoteList;

			let user = voteCache['id_' + vote.user];
			if (!user) { user = {}; }
			user.lastRecordedTopVote = Date.now();

			writeFileSync('./database/voteCache.json', JSON.stringify(voteCache, null, '\t'));
		}));

		topApp.on('error', (err) => {
			console.error(err);
		});

		topApp.listen(3000);
	}

	if (client.votes.dbl && client.votes.dbl.token !== '' && client.votes.dbl.authorization !== '') {

		const dblApp = express();

		dblApp.use(express.json());
		dblApp.use(limiter);

		dblApp.post('/dbl', (request, response) => {

			if (request.headers.authorization === client.votes.dbl?.authorization) {

				const voteCache = JSON.parse(readFileSync('./database/voteCache.json', 'utf-8')) as VoteList;

				let user = voteCache['id_' + request.body.id];
				if (!user) { user = {}; }
				user.lastRecordedDblVote = Date.now();

				writeFileSync('./database/voteCache.json', JSON.stringify(voteCache, null, '\t'));
			}

			response.status(200).end();
		});

		dblApp.on('error', (err) => {
			console.error(err);
		});

		dblApp.listen(3001);
	}
}