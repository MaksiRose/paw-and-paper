"use strict";
// @ts-check
const bfd = require('bfd-api-redux');
const { AutoPoster } = require('topgg-autoposter');
const Topgg = require('@top-gg/sdk');
const express = require('express');
const { readFileSync, writeFileSync } = require('fs');
const { rateLimit } = require('express-rate-limit');
const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
});
/**
 * Updates server count on vote websites, starts event listeners to store successful votes, and adds structure to client to request individual votes
 * @param {import('../paw').client} client
 */
module.exports.execute = (client) => {
    if ( /** @type {{token: string, authorization: string}} */(client.votes.bfd).token !== '' || /** @type {{token: string, authorization: string}} */ (client.votes.bfd).authorization != '') {
        const bfdClient = new bfd(/** @type {{token: string, authorization: string}} */ (client.votes.bfd).token, client.user?.id);
        const bfdAuthorization = /** @type {{token: string, authorization: string}} */ (client.votes.bfd).authorization;
        client.votes.bfd = bfdClient;
        const serverCount = client.guilds.cache.size;
        client.votes.bfd.setServers(serverCount);
        /** @type {*} */
        const bfdApp = express();
        bfdApp.use(express.json());
        bfdApp.use(limiter);
        bfdApp.post('/discords', (/** @type {{ headers: { authorization: string; }; body: { user: string; }; }} */ request, /** @type {{ status: (arg0: number) => { (): any; new (): any; end: { (): void; new (): any; }; }; }} */ response) => {
            if (request.headers.authorization === bfdAuthorization) {
                /** @type {import('../typedef').VoteList} */
                const voteCache = JSON.parse(readFileSync('./database/voteCache.json', 'utf-8'));
                voteCache['id_' + request.body.user] = voteCache['id_' + request.body.user] ?? {};
                voteCache['id_' + request.body.user].lastRecordedDiscordsVote = Date.now();
                writeFileSync('./database/voteCache.json', JSON.stringify(voteCache, null, '\t'));
            }
            response.status(200).end();
        });
        bfdApp.listen(3002, (/** @type {any} */ error) => { return console.error(error); });
    }
    if ( /** @type {{token: string, authorization: string}} */(client.votes.top).token !== '' || /** @type {{token: string, authorization: string}} */ (client.votes.top).authorization != '') {
        AutoPoster(/** @type {{token: string, authorization: string}} */ (client.votes.top).token, client);
        const topApi = new Topgg.Api(/** @type {{token: string, authorization: string}} */ (client.votes.top).token);
        const webhook = new Topgg.Webhook(/** @type {{token: string, authorization: string}} */ (client.votes.top).authorization);
        client.votes.top = topApi;
        /** @type {*} */
        const topApp = express();
        topApp.post('/top', webhook.listener(async (vote) => {
            /** @type {import('../typedef').VoteList} */
            const voteCache = JSON.parse(readFileSync('./database/voteCache.json', 'utf-8'));
            voteCache['id_' + vote.user] = voteCache['id_' + vote.user] ?? {};
            voteCache['id_' + vote.user].lastRecordedTopVote = Date.now();
            writeFileSync('./database/voteCache.json', JSON.stringify(voteCache, null, '\t'));
        }));
        topApp.listen(3000, (/** @type {any} */ error) => { return console.error(error); });
    }
    if ( /** @type {{token: string, authorization: string}} */(client.votes.dbl).token !== '' || /** @type {{token: string, authorization: string}} */ (client.votes.dbl).authorization != '') {
        /** @type {*} */
        const dblApp = express();
        dblApp.use(express.json());
        dblApp.use(limiter);
        dblApp.post('/dbl', (request, response) => {
            if (request.headers.authorization === /** @type {{token: string, authorization: string}} */ (client.votes.dbl).authorization) {
                /** @type {import('../typedef').VoteList} */
                const voteCache = JSON.parse(readFileSync('./database/voteCache.json', 'utf-8'));
                voteCache['id_' + request.body.id] = voteCache['id_' + request.body.id] ?? {};
                voteCache['id_' + request.body.id].lastRecordedDblVote = Date.now();
                writeFileSync('./database/voteCache.json', JSON.stringify(voteCache, null, '\t'));
            }
            response.status(200).end();
        });
        dblApp.listen(3001, (/** @type {any} */ error) => { return console.error(error); });
    }
};
