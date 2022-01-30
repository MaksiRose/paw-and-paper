const fs = require('fs');

module.exports = {
	execute(client) {
		for (const dir of fs.readdirSync('./commands/')) {

			for (const file of fs.readdirSync(`./commands/${dir}`)) {

				const command = require(`../commands/${dir}/${file}`);
				if (command.name) {

					client.commands.set(command.name, command);
				}
			}
		}
	},
};
