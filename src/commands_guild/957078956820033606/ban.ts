import { PermissionFlagsBits, SlashCommandBuilder, User } from 'discord.js';
import { readFileSync, writeFileSync } from 'fs';
import { respond } from '../../utils/helperFunctions';
import serverModel from '../../models/serverModel';
import userModel from '../../models/userModel';
import { BanList, SlashCommand } from '../../typedef';

const name: SlashCommand['name'] = 'ban';
const description: SlashCommand['description'] = 'Ban a user or server from using the bot';
export const command: SlashCommand = {
	name: name,
	description: description,
	data: new SlashCommandBuilder()
		.setName(name)
		.setDescription(description)
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
	disablePreviousCommand: false,
	sendCommand: async (client, interaction) => {

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

			const profile = await userModel.findOne(u => u.userId.includes(id)).catch(() => { return null; });
			if (profile) {

				await userModel.findOneAndDelete(u => u.uuid === profile.uuid);
				const user = await client.users.fetch(id).catch(() => { return null; });

				if (user) {

					await user.createDM();
					await user.send({ content: 'I am sorry to inform you that you have been banned from using this bot.' });

					await respond(interaction, {
						content: `Banned user ${user.tag}, deleted their account and was able to notify them about it.`,
					}, true);
					return;
				}

				await respond(interaction, {
					content: `Banned user ${id} deleted their account but was not able to notify them about it.`,
				}, true);
				return;
			}

			await respond(interaction, {
				content: `Banned user ${id} but couldn't find an account associated with them.`,
			}, true);
			return;
		}

		if (type === 'server') {

			bannedList.servers.push(id);
			writeFileSync('./database/bannedList.json', JSON.stringify(bannedList, null, '\t'));

			const server = await serverModel.findOne(s => s.serverId === id).catch(() => { return null; });
			if (server) {

				await serverModel.findOneAndDelete(u => u.uuid === server.uuid);
				const guild = await interaction.client.guilds.fetch(id).catch(() => { return null; });
				const user = await client.users.fetch(guild?.ownerId || '').catch(() => { return null; });

				if (guild && user) {

					await user.createDM();
					await user.send({ content: `I am sorry to inform you that your guild \`${guild.name}\` has been banned from using this bot.` });

					await respond(interaction, {
						content: `Banned server ${guild.name}, deleted their account and was able to notify the guild owner about it.`,
					}, true);
					return;
				}

				await respond(interaction, {
					content: `Banned server ${id}, deleted their account but was not able to notify the guild owner about it.`,
				}, true);
				return;
			}

			await respond(interaction, {
				content: `Banned server ${id} but couldn't find an account associated with them.`,
			}, true);
			return;
		}
	},
};