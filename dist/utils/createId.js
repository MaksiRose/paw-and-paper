"use strict";
// @ts-check
const { readFileSync, writeFileSync } = require('fs');
const { generateRandomNumber } = require('./randomizers');
/**
 * Creates a unique 6-character ID.
 * @returns {Promise<string>}
 */
async function createId() {
    const legend = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'm', 'n', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    let uuid = '';
    for (let index = 0; index < 6; index++) {
        uuid += legend[generateRandomNumber(legend.length)];
    }
    /** @type {import('../typedef').GivenIdList} */
    const givenIds = JSON.parse(readFileSync('./database/givenIds.json', 'utf-8'));
    if (givenIds.includes(uuid)) {
        return await createId();
    }
    givenIds.push(uuid);
    writeFileSync('./database/givenIds.json', JSON.stringify(givenIds, null, '\t'));
    return uuid;
}
module.exports = createId;
