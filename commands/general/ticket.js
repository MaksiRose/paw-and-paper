const config = require('../../config.json');
const { Octokit } = require('@octokit/rest');

module.exports = {
	name: 'ticket',
	async sendMessage(client, message, argumentsArray) {

		if (!argumentsArray.length) {

			return message
				.reply({
					embeds: [{
						color: config.error_color,
						title: 'Tickets must contain text! Example:',
						description: 'rp ticket Attacking a chicken should lead to millions of chickens spawning and attacking you back until you die!',
					}],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		let attachmentURLs = '';

		if (message.attachments) {

			for (const file of message.attachments) {

				attachmentURLs += `${file.url}\n`;
			}
		}

		const octokit = new Octokit({

			auth: config.github_token,
			userAgent: 'paw-and-paper',
		});

		const githubIssue = await octokit.rest.issues
			.create({
				owner: 'MaksiRose',
				repo: 'paw-and-paper',
				title: argumentsArray.join(' '),
				body: `Created by: ${message.author.tag} (${message.author.id})\n[Link to original Discord message](https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.id})\n${attachmentURLs}`,
			})
			.catch((error) => {
				throw new Error(error);
			});

		const owner = await client.users
			.fetch(config.maksi, false)
			.catch((error) => {
				throw new Error(error);
			});

		await owner
			.send({
				embeds: [{
					author: { name: message.author.tag },
					title: `Ticket #${githubIssue.data.number}`,
					url: `https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.id}`,
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
			})
			.catch((error) => {
				throw new Error(error);
			});

		return message
			.reply({
				embeds: [{
					color: '#9d9e51',
					title: 'Thank you for your contribution!',
					description: `You help improve the bot.\n[View ticket on GitHub](https://github.com/MaksiRose/paw-and-paper/issues/${githubIssue.data.number})`,
				}],
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});
	},
};