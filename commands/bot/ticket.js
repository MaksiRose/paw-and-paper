// @ts-check
const { error_color, github_token, maksi } = require('../../config.json');
const { Octokit } = require('@octokit/rest');
const { MessageActionRow, MessageButton } = require('discord.js');

module.exports.name = 'ticket';

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray) => {

	if (!argumentsArray.length) {

		message
			.reply({
				embeds: [{
					color: /** @type {`#${string}`} */ (error_color),
					title: 'Tickets must contain text! Example:',
					description: 'rp ticket Attacking a chicken should lead to millions of chickens spawning and attacking you back until you die!\nNote: To suggest a species [use this form](https://github.com/MaksiRose/paw-and-paper/issues/new?assignees=&labels=improvement%2Cnon-code&template=species_request.yaml&title=New+species%3A+).',
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	let attachmentURLs = '';

	if (message.attachments) {

		for (const file of message.attachments.values()) {

			attachmentURLs += `${file.url}\n`;
		}
	}

	const octokit = new Octokit({
		auth: github_token,
		userAgent: 'paw-and-paper',
	});

	const githubIssue = await octokit.rest.issues
		.create({
			owner: 'MaksiRose',
			repo: 'paw-and-paper',
			title: argumentsArray.join(' '),
			body: `Created by: ${message.author.tag} (${message.author.id})` + message.inGuild() ? `\n[Link to original Discord message](https://discord.com/channels/${message.guildId}/${message.channel.id}/${message.id})\n${attachmentURLs}` : 'Message was sent from DMs, a link is not available.',
		})
		.catch((error) => {
			throw new Error(error);
		});

	const owner = await client.users
		.fetch(maksi)
		.catch((error) => {
			throw new Error(error);
		});

	await owner
		.send({
			embeds: [{
				author: { name: message.author.tag },
				title: `Ticket #${githubIssue.data.number}`,
				url: message.inGuild() ? `https://discord.com/channels/${message.guildId}/${message.channel.id}/${message.id}` : undefined,
				description: argumentsArray.join(' '),
			}],
			components: [ new MessageActionRow({
				components: [ new MessageButton({
					customId: 'ticket',
					label: 'Resolve',
					style: 'SUCCESS',
				})],
			})],
		})
		.catch((error) => { throw new Error(error); });

	message
		.reply({
			embeds: [{
				color: '#9d9e51',
				title: 'Thank you for your contribution!',
				description: `You help improve the bot.\n[View ticket on GitHub](https://github.com/MaksiRose/paw-and-paper/issues/${githubIssue.data.number})\nNote: To suggest a species [use this form](https://github.com/MaksiRose/paw-and-paper/issues/new?assignees=&labels=improvement%2Cnon-code&template=species_request.yaml&title=New+species%3A+).`,
			}],
			failIfNotExists: false,
		})
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});
	return;
};