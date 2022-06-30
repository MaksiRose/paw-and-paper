"use strict";
// @ts-check
const { readdirSync } = require('fs');
/**
 * Starts up all the `listeners` based on their `eventName` and whether or not their are one-time.
 * @param {import('../paw').client} client
 */
module.exports.execute = (client) => {
    for (const file of readdirSync('./events/')) {
        /**
         * @type {import('../typedef').Event}
         */
        const event = require(`../events/${file}`);
        if (event.once) {
            client.once(event.name, (...args) => event.execute(client, ...args).catch((/** @type {any} */ error) => console.error(error)));
        }
        else {
            client.on(event.name, (...args) => event.execute(client, ...args).catch((/** @type {any} */ error) => console.error(error)));
        }
    }
};
