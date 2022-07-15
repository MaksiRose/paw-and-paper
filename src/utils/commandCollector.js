// @ts-check

const disableAllComponents = require('./disableAllComponents');

/** @type {Object<string, Function>} */
const activeCommandsObject = {};

/**
 * Adds a Function as a value to the key of the user and guild ID. The function removes components and deletes itself when called.
 * @param {string} uuid
 * @param {string} guildId
 * @param {import('discord.js').Message} botReply
 */
function createCommandCollector(uuid, guildId, botReply) {

	module.exports.activeCommandsObject[uuid + guildId] = async () => {

		delete activeCommandsObject[uuid + guildId];

		await botReply
			.edit({
				components: disableAllComponents(botReply.components),
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
	};
}

module.exports = {
	activeCommandsObject,
	createCommandCollector,
};