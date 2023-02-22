import { PermissionFlagsBits, SlashCommandBuilder, User } from 'discord.js';
import { readFileSync, writeFileSync } from 'fs';
import { respond } from '../../utils/helperFunctions';
import serverModel from '../../oldModels/serverModel';
import { userModel } from '../../oldModels/userModel';
import { client } from '../..';
import { SlashCommand } from '../../typings/handle';
import { BanList } from '../../typings/data/general';

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('ban')
		.setDescription('Ban a user or server from using the bot')
		.addStringOption(option =>
			option.setName('type')
				.setDescription('Whether you want to ban a user or server')
				.setChoices(
					{ name: 'user', value: 'user' },
					{ name: 'server', value: 'server' },
				)
				.setRequired(true))
		.addStringOption(option =>
			option.setName('id')
				.setDescription('The ID of what you want to ban')
				.setRequired(true))
		.setDMPermission(false)
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.toJSON(),
	category: 'other',
	position: 0,
	disablePreviousCommand: false,
	modifiesServerProfile: false,
	sendCommand: async (interaction) => {

		if (!client.isReady()) { throw new Error('client isn\'t ready'); }

		await client.application.fetch();
		if ((client.application.owner instanceof User) ? interaction.user.id !== client.application.owner.id : client.application.owner ? !client.application.owner.members.has(interaction.user.id) : false) { throw new Error('403: user is not bot owner'); }

		const type = interaction.options.getString('type');
		const id = interaction.options.getString('id');
		if (type === null || id === null) { throw new TypeError('type or id is null'); }

		const bannedList = JSON.parse(readFileSync('./database/bannedList.json', 'utf-8')) as BanList;

		if (type === 'user') {

			bannedList.users.push(id);
			writeFileSync('./database/bannedList.json', JSON.stringify(bannedList, null, '\t'));

			const profile = (() => {
				try { return userModel.findOne(u => Object.keys(u.userIds).includes(id)); }
				catch { return null; }
			})();
			if (profile) {

				userModel.findOneAndDelete(u => u._id === profile._id);
				const user = await client.users.fetch(id).catch(() => { return null; });

				if (user) {

					await user.createDM();
					await user.send({ content: 'I am sorry to inform you that you have been banned from using this bot.' });

					// This is always a reply
					await respond(interaction, {
						content: `Banned user ${user.tag}, deleted their account and was able to notify them about it.`,
					});
					return;
				}

				// This is always a reply
				await respond(interaction, {
					content: `Banned user ${id} deleted their account but was not able to notify them about it.`,
				});
				return;
			}

			// This is always a reply
			await respond(interaction, {
				content: `Banned user ${id} but couldn't find an account associated with them.`,
			});
			return;
		}

		if (type === 'server') {

			bannedList.servers.push(id);
			writeFileSync('./database/bannedList.json', JSON.stringify(bannedList, null, '\t'));

			const server = (() => {
				try { return serverModel.findOne(s => s.serverId === id); }
				catch { return null; }
			})();
			if (server) {

				await serverModel.findOneAndDelete(s => s._id === server._id);
				const guild = await interaction.client.guilds.fetch(id).catch(() => { return null; });
				const user = await client.users.fetch(guild?.ownerId || '').catch(() => { return null; });

				if (guild && user) {

					await user.createDM();
					await user.send({ content: `I am sorry to inform you that your guild \`${guild.name}\` has been banned from using this bot.` });

					// This is always a reply
					await respond(interaction, {
						content: `Banned server ${guild.name}, deleted their account and was able to notify the guild owner about it.`,
					});
					return;
				}

				// This is always a reply
				await respond(interaction, {
					content: `Banned server ${id}, deleted their account but was not able to notify the guild owner about it.`,
				});
				return;
			}

			// This is always a reply
			await respond(interaction, {
				content: `Banned server ${id} but couldn't find an account associated with them.`,
			});
			return;
		}
	},
};