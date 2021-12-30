const config = require('../../config.json');

module.exports = {
	name: 'ticket',
	async sendMessage(client, message, argumentsArray) {

		if (!argumentsArray.length) {

			return message.reply({
				embeds: [{
					color: config.ERROR_COLOR,
					title: 'Tickets must contain text! Example:',
					description: 'rp ticket Attacking a chicken should lead to millions of chickens spawning and attacking you back until you die!',
				}],
			});
		}

		const owner = await client.users.fetch(config.MAKSI, false);
		await owner.send({
			embeds: [{
				author: { name: message.author.tag },
				description: argumentsArray.join(' '),
			}],
			components: [{
				type: 'ACTION_ROW',
				components: [{
					type: 'BUTTON',
					customId: 'ticket',
					label: 'Resolve',
					style: 'SUCCESS',
				}],
			}],
		});

		return message.reply({
			embeds: [{
				color: '#9d9e51',
				title: 'Thank you for your contribution!',
				description: 'You help improve the bot.',
			}],
		});
	},
};