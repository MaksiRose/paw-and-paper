import { EmbedBuilder, Interaction, RepliableInteraction } from 'discord.js';
import { createNewTicket } from '../commands/miscellaneous/ticket';
import { DiscordEvent } from '../typings/main';
import { disableCommandComponent, disableAllComponents } from '../utils/componentDisabling';
import { keyInObject, respond } from '../utils/helperFunctions';
import { createGuild } from '../utils/updateGuild';
import { sendErrorMessage } from '../utils/helperFunctions';
import { missingPermissions } from '../utils/permissionHandler';
import { client, handle } from '../index';
import { deconstructCustomId } from '../utils/customId';
import DiscordUser from '../models/discordUser';
import Server from '../models/server';
import UserToServer from '../models/userToServer';
import Quid from '../models/quid';
import ServerToDiscordUser from '../models/serverToDiscordUser';
import QuidToServer from '../models/quidToServer';
import { getDisplayname, getDisplayspecies, pronoun, pronounAndPlural } from '../utils/getQuidInfo';
import User from '../models/user';
import ErrorInfo from '../models/errorInfo';
const { version } = require('../../package.json');
const { error_color } = require('../../config.json');

export const lastInteractionMap: Map<string, RepliableInteraction<'cached'>> = new Map();
export const serverActiveUsersMap: Map<string, string[]> = new Map();

export const event: DiscordEvent = {
	name: 'interactionCreate',
	once: false,
	async execute(interaction: Interaction) {
		try {

			/* This is only null when in DM without CHANNEL partial, or when channel cache is sweeped. Therefore, this is technically unsafe since this value could become null after this check. This scenario is unlikely though. */
			if (!interaction.channel) { await client.channels.fetch(interaction.channelId || ''); }

			const discordUser = await DiscordUser.findByPk(interaction.user.id, {
				include: [{ model: User, as: 'user' }],
			});
			const user = discordUser?.user;

			const server = interaction.inCachedGuild()
				? ((await Server.findByPk(interaction.guildId)) ?? await createGuild(interaction.guild))
				: undefined;

			let userToServer = (user && server)
				? (await UserToServer.findOrCreate({
					where: { userId: user.id, serverId: server.id },
					include: [{ model: Quid, as: 'activeQuid' }],
				}))[0]
				: undefined;
			const quid: Quid | undefined = userToServer?.activeQuid ?? undefined;

			/* It's updating the last interaction info for the user in the server. */
			if (userToServer && interaction.inCachedGuild() && interaction.isRepliable()) {

				lastInteractionMap.set(userToServer.userId + userToServer.serverId, interaction);
				userToServer = await userToServer.update({
					lastInteraction_timestamp: interaction.createdTimestamp,
					lastInteraction_channelId: interaction.channelId,
				}, { logging: false });

				const serverActiveUsers = serverActiveUsersMap.get(userToServer.serverId);
				if (!serverActiveUsers) { serverActiveUsersMap.set(userToServer.serverId, [interaction.user.id]); }
				else if (!serverActiveUsers.includes(interaction.user.id)) { serverActiveUsers.push(interaction.user.id); }
			}

			/* It's updating the info for the discord user in the server */
			const serverToDiscordUser = (discordUser && server) ? await ServerToDiscordUser.findOrCreate({ where: { discordUserId: discordUser.id, serverId: server.id } })
				.then(([row]) => row.update({ isMember: true, lastUpdatedTimestamp: Date.now() }, { logging: false })) : undefined;

			/* It's updating the info for the quid in the server, if it exists */
			const quidToServer = userToServer?.activeQuidId ? await QuidToServer.findOrCreate({
				where: { quidId: userToServer.activeQuidId, serverId: userToServer.serverId },
			})
				.then(([row]) => row.update({ lastActiveTimestamp: Date.now() }, { logging: false })) : undefined;

			if (interaction.isRepliable() && interaction.inRawGuild()) {

				await interaction
					.reply({
						content: 'Oops, I am missing the `bot` scope that is normally part of the invite link. Please re-invite the bot!',
					});
				return;
			}

			if (interaction.isAutocomplete()) {

				/**
				 * https://discordjs.guide/interactions/autocomplete.html#responding-to-autocomplete-interactions
				 */

				/* Getting the command from the client and checking if the command is undefined.
				If it is, it will error. */
				const command = handle.slashCommands.get(interaction.commandName);
				if (command === undefined || command.sendAutocomplete === undefined) { return; }

				/* It's sending the autocomplete message. */
				await command.sendAutocomplete(interaction, { });
				return;
			}

			if (interaction.isChatInputCommand()) {

				/* Getting the command from the client and checking if the command is undefined. If it is, it will error. */
				const command = handle.slashCommands.get(interaction.commandName);
				if (command === undefined || !keyInObject(command, 'sendCommand')) { return await sendErrorMessage(interaction, new Error('Unknown command')); }

				/* It's disabling all components if userToServer exists and the command is set to disable a previous command. */
				if (userToServer && command.disablePreviousCommand) {

					if (await missingPermissions(interaction, [
						'ViewChannel',
					]) === true) { return; }

					await disableCommandComponent(userToServer);
				}

				/* This sends the command and error message if an error occurs. */
				{ console.log(`\x1b[32m${interaction.user.tag} (${interaction.user.id})\x1b[0m successfully executed \x1b[31m${interaction.commandName} \x1b[0min \x1b[32m${interaction.guild?.name || 'DMs'} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`); }
				await command.sendCommand(interaction, { });

				/* If sapling exists, a gentle reminder has not been sent and the watering time is after the perfect time, send a gentle reminder */
				if (interaction.inGuild() && quid && quidToServer && quidToServer.sapling_exists && !quidToServer.sapling_sentGentleReminder && Date.now() > (quidToServer.sapling_nextWaterTimestamp || 0) + 60_000) { // The 60 seconds is so this doesn't trigger when you just found your sapling while exploring

					await quidToServer.update({ sapling_sentGentleReminder: true });

					// This is always a followUp
					await respond(interaction, {
						embeds: [new EmbedBuilder()
							.setColor(quidToServer.quid.color)
							.setAuthor({ name: await getDisplayname(quid, { serverId: quidToServer.serverId, quidToServer, userToServer }), iconURL: quid.avatarURL })
							.setDescription(`*Engrossed in ${pronoun(quid, 2)} work, ${quid.name} suddenly remembers that ${pronounAndPlural(quid, 0, 'has', 'have')} not yet watered ${pronoun(quid, 2)} plant today. The ${getDisplayspecies(quid)} should really do it soon!*`)
							.setFooter({ text: 'Type "/water-tree" to water your ginkgo sapling!' })],
					});
				}

				/* This is checking if the user has used the bot since the last update. If they haven't, it will
				send them a message telling them that there is a new update. */
				const splitVersion = version.split('.').slice(0, -1).join('.');
				if (user && Number(user.lastPlayedVersion) < Number(splitVersion)) {

					// This is always a followUp
					await respond(interaction, {
						content: `A new update has come out since you last used the bot! You can view the changelog here: <https://github.com/MaksiRose/paw-and-paper/releases/tag/v${splitVersion}.0>`,
					});

					await user.update({ lastPlayedVersion: splitVersion });
				}
				return;
			}

			if (interaction.isUserContextMenuCommand()) { return; }

			if (interaction.isMessageContextMenuCommand()) {

				/* Getting the command from the client and checking if the command is undefined.
				If it is, it will error. */
				const command = handle.contextMenuCommands.get(interaction.commandName);
				if (command === undefined || !keyInObject(command, 'sendCommand')) { return await sendErrorMessage(interaction, new Error('Unknown command')); }

				/* This sends the command and error message if an error occurs. */
				console.log(`\x1b[32m${interaction.user.tag} (${interaction.user.id})\x1b[0m successfully executed \x1b[31m${interaction.commandName} \x1b[0min \x1b[32m${interaction.guild?.name || 'DMs'} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
				await command.sendCommand(interaction);
				return;
			}

			if (interaction.isModalSubmit()) {

				console.log(`\x1b[32m${interaction.user.tag} (${interaction.user.id})\x1b[0m successfully submitted the modal \x1b[31m${interaction.customId} \x1b[0min \x1b[32m${interaction.guild?.name || 'DMs'} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);

				/* Getting the command from the client and checking if the command is undefined.
				If it is, it will error. */
				const command = handle.slashCommands.get(interaction.customId.split('_')[0] ?? '') ?? handle.contextMenuCommands.get(interaction.customId.split('_')[0] ?? '');
				if (command === undefined || command.sendModalResponse === undefined) { return; }

				/* It's sending the autocomplete message. */
				await command.sendModalResponse(interaction, { });
				return;
			}

			if (interaction.isMessageComponent()) {

				const quids = user ? await Quid.findAll({
					where: { userId: user.id },
					attributes: ['id'],
					raw: true,
				}) : [];
				/* It's checking if the user that created the command is the same as the user that is interacting with the command, or if the user that is interacting is mentioned in the interaction.customId. If neither is true, it will send an error message. */
				const isCommandCreator = interaction.message.interaction !== null && interaction.message.interaction.user.id === interaction.user.id;
				const isMentioned = interaction.customId.includes('@' + interaction.user.id) || interaction.customId.includes('@EVERYONE') || (user && (interaction.customId.includes(user.id) || quids.some(q => interaction.customId.includes('@' + q.id))));

				if (interaction.isAnySelectMenu()) {

					console.log(`\x1b[32m${interaction.user.tag} (${interaction.user.id})\x1b[0m successfully selected \x1b[31m${interaction.values.join(', ')} \x1b[0mfrom the menu \x1b[31m${interaction.customId} \x1b[0min \x1b[32m${interaction.guild?.name || 'DMs'} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
				}

				if (interaction.isButton()) {

					console.log(`\x1b[32m${interaction.user.tag} (${interaction.user.id})\x1b[0m successfully clicked the button \x1b[31m${interaction.customId} \x1b[0min \x1b[32m${interaction.guild?.name || 'DMs'} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);

					if (interaction.customId.startsWith('report_')) {

						if (!isCommandCreator && !isMentioned) {

							// This should always be a reply to the error message
							await respond(interaction, {
								content: 'Sorry, I only listen to the person that created the command 😣',
								ephemeral: true,
							});
							return;
						}

						// This should always update the error message
						await respond(interaction, {
							components: disableAllComponents(interaction.message.components),
						}, 'update', interaction.message.id);

						const errorId = interaction.customId.split('_')[2];
						const errorInfo = await ErrorInfo.findByPk(errorId);
						const description = errorInfo ? `Stack:\n\`\`\`\n${errorInfo.stack}\n\`\`\`\nInteraction info:\`\`\`json\n${JSON.stringify(errorInfo.interactionInfo, null, '\t')}\n\`\`\``.substring(0, 4096) : null;

						if (!errorId || !errorInfo || !description) {

							// This should always be a followUp to the updated error message
							await respond(interaction, {
								embeds: [new EmbedBuilder()
									.setColor(error_color)
									.setDescription('There was an error trying to report the error... Ironic! Maybe you can try opening a ticket via `/ticket` instead?')],
								ephemeral: true,
							});
							return;
						}

						if (errorInfo.isReported) {

							// This should always be a followUp to the updated error message
							await respond(interaction, {
								content: 'Thank you for attempting to report this error. Fortunately, it already got reported by another user.\nIf you still have questions, you can join our support server (Link is in the help command page 5), or use the ticket command.\nIf you want to know when the bot gets updated, you can again join our support server, or ask an admin of this server to enable getting updates via the server-settings command',
								ephemeral: true,
							});
							return;
						}

						await createNewTicket(interaction, `Error ${errorId}`, description, 'bug', null, errorId);
						await errorInfo.update({ isReported: true });
						return;
					}
				}

				/* Getting the command from the client and checking if the command is undefined.
				If it is, it will error. */
				const customId = deconstructCustomId(interaction.customId);
				const command = handle.slashCommands.get(customId?.commandName ?? '') ?? handle.contextMenuCommands.get(customId?.commandName ?? '');
				if (command === undefined || command.sendMessageComponentResponse === undefined) { return; }

				if (!isCommandCreator && !isMentioned) {

					// This should always be a reply to the message with the component
					await respond(interaction, {
						content: 'Sorry, I only listen to the person that created the command 😣',
						ephemeral: true,
					});
					return;
				}

				/* It's sending the autocomplete message. */
				await command.sendMessageComponentResponse(interaction, { user, userToServer, quidToServer });
				return;
			}
		}
		catch (error) {

			if (interaction.isRepliable()) {

				await sendErrorMessage(interaction, error)
					.catch(e => { console.error(e); });
			}
			else { console.error(error); }
		}
	},
};