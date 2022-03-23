const fs = require('fs');
const path = require('path');

module.exports = {
	execute(client) {

		for (const commandPath of getFiles('../commands')) {

			const command = require(`${commandPath}`);

			client.commands[command.name] = command;
		}
	},
};

function getFiles(directory) {

	let commandFiles = [];

	for (const content of fs.readdirSync(path.join(__dirname, directory))) {

		if (fs.lstatSync(path.join(__dirname, `${directory}/${content}`)).isDirectory()) {

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