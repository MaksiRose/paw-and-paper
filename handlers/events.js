const fs = require('fs');

module.exports = {
	execute(client) {

		for (const file of fs.readdirSync('./events/')) {

			const event = require(`../events/${file}`);
			if (event.once) {

				client.once(event.name, (...args) => event.execute(client, ...args));
			}
			else {

				client.on(event.name, (...args) => event.execute(client, ...args));
			}
		}
	},
};
