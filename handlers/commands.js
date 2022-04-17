// @ts-check
const { readdirSync, lstatSync } = require('fs');
const path = require('path');

/**
 * Adds all the commands to the client
 * @param {import('../paw').client} client
 */
module.exports.execute = (client) => {

	for (const commandPath of getFiles('../commands')) {

		/**
		 * @type {{name: string, aliases: Array<string>, sendMessage: Function}}
		 */
		const command = require(commandPath);

		client.commands[command.name] = command;
	}
};

/**
 * Adds all file paths in a directory to an array and returns it
 * @param {string} directory
 * @returns {Array<string>} Array of file paths
 */
function getFiles(directory) {

	/**
	 * @type {Array<string>}
	 */
	let commandFiles = [];

	for (const content of readdirSync(path.join(__dirname, directory))) {

		if (lstatSync(path.join(__dirname, `${directory}/${content}`)).isDirectory()) {

			commandFiles = [
				...commandFiles,
				...getFiles(`${directory}/${content}`),
			];
		}
		else if (content.endsWith('.js')) {

			commandFiles.push(`${directory}/${content.slice(0, -3)}`);
		}
	}

	return commandFiles;
}