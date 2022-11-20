import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Interaction, RepliableInteraction } from 'discord.js';
import { createNewTicket } from '../commands/miscellaneous/ticket';
import serverModel from '../models/serverModel';
import { userModel, getUserData } from '../models/userModel';
import { DiscordEvent } from '../typings/main';
import { disableCommandComponent, disableAllComponents } from '../utils/componentDisabling';
import { getMapData, keyInObject, update, userDataServersObject } from '../utils/helperFunctions';
import { createGuild } from '../utils/updateGuild';
import { respond } from '../utils/helperFunctions';
import { sendErrorMessage } from '../utils/helperFunctions';
import { generateId } from 'crystalid';
import { readFileSync, writeFileSync } from 'fs';
import { missingPermissions } from '../utils/permissionHandler';
import { client, handle } from '../index';
import { ErrorStacks } from '../typings/data/general';
import { hasNameAndSpecies } from '../utils/checkUserState';
import { sendReminder, stopReminder } from '../commands/gameplay_maintenance/water-tree';
import { deconstructCustomId } from '../utils/customId';
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

			const _userData = (() => {
				try { return userModel.findOne(u => u.userId.includes(interaction.user.id)); }
				catch { return null; }
			})();
			const userData = _userData === null ? null : getUserData(_userData, interaction.guildId ?? 'DMs', _userData.quids[_userData.currentQuid[interaction.guildId ?? 'DMs'] ?? '']);
			let serverData = (() => {
				try { return serverModel.findOne(s => s.serverId === interaction.guildId); }
				catch { return null; }
			})();

			/* It's setting the last interaction timestamp for the user to now. */
			if (userData && interaction.inCachedGuild() && interaction.isRepliable()) {

				lastInteractionMap.set(userData._id + interaction.guildId, interaction);
				await userData.update(
					(u) => {
						u.servers[interaction.guildId] = {
							...userDataServersObject(u, interaction.guildId),
							lastInteractionTimestamp: interaction.createdTimestamp,
							lastInteractionToken: interaction.token,
							lastInteractionChannelId: interaction.channelId,
						};
					},
					{ log: false },
				);

				const serverActiveUsers = serverActiveUsersMap.get(interaction.guildId);
				if (!serverActiveUsers) { serverActiveUsersMap.set(interaction.guildId, [interaction.user.id]); }
				else if (!serverActiveUsers.includes(interaction.user.id)) { serverActiveUsers.push(interaction.user.id); }
			}

			/* Checking if the serverData is null. If it is null, it will create a guild. */
			if (!serverData && interaction.inCachedGuild()) { serverData = await createGuild(interaction.guild); }

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
				await command.sendAutocomplete(interaction, userData, serverData);
				return;
			}

			if (interaction.isChatInputCommand()) {

				/* Getting the command from the client and checking if the command is undefined. If it is, it will error. */
				const command = handle.slashCommands.get(interaction.commandName);
				if (command === undefined || !keyInObject(command, 'sendCommand')) { return await sendErrorMessage(interaction, new Error('Unknown command')); }

				/* It's disabling all components if userData exists and the command is set to disable a previous command. */
				if (userData && command.disablePreviousCommand) {

					if (await missingPermissions(interaction, [
						'ViewChannel',
					]) === true) { return; }

					await disableCommandComponent(userData);
				}

				if (userData && interaction.inGuild()) {

					await userData
						.update(
							(u) => {
								u.userIds[interaction.user.id] = {
									...(u.userIds[interaction.user.id] ?? {}),
									[interaction.guildId]: { isMember: true, lastUpdatedTimestamp: Date.now() },
								};

								if (userData.quid && command.modifiesServerProfile) {

									const p = getMapData(getMapData(u.quids, userData!.quid!._id).profiles, interaction.guildId);
									p.lastActiveTimestamp = Date.now();
								}
							},
						);
				}

				/* This sends the command and error message if an error occurs. */
				console.log(`\x1b[32m${interaction.user.tag} (${interaction.user.id})\x1b[0m successfully executed \x1b[31m${interaction.commandName} \x1b[0min \x1b[32m${interaction.guild?.name || 'DMs'} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
				await command.sendCommand(interaction, userData, serverData);

				if (interaction.inGuild()) {

					/* If sapling exists, a gentle reminder has not been sent and the watering time is after the perfect time, send a gentle reminder */
					if (hasNameAndSpecies(userData) && userData.quid.profile.sapling.exists && !userData.quid.profile.sapling.sentGentleReminder && Date.now() > (userData.quid.profile.sapling.nextWaterTimestamp || 0) + 60_000) { // The 60 seconds is so this doesn't trigger when you just found your sapling while exploring

						await userData.update(
							(u) => {
								const p = getMapData(getMapData(u.quids, userData!.quid!._id).profiles, interaction.guildId);
								p.sapling.sentGentleReminder = true;
							},
						);

						await interaction
							.followUp({
								embeds: [new EmbedBuilder()
									.setColor(userData.quid.color)
									.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
									.setDescription(`*Engrossed in ${userData.quid.pronoun(2)} work, ${userData.quid.name} suddenly remembers that ${userData.quid.pronounAndPlural(0, 'has', 'have')} not yet watered ${userData.quid.pronoun(2)} plant today. The ${userData.quid.getDisplayspecies()} should really do it soon!*`)
									.setFooter({ text: 'Type "/water-tree" to water your ginkgo sapling!' })],
							});
					}
				}

				/* This is checking if the user has used the bot since the last update. If they haven't, it will
				send them a message telling them that there is a new update. */
				if (Number(userData?.lastPlayedVersion) < Number(version.split('.').slice(0, -1).join('.'))) {

					await interaction
						.followUp({
							content: `A new update has come out since you last used the bot! You can view the changelog here: <https://github.com/MaksiRose/paw-and-paper/releases/tag/v${version.split('.').slice(0, -1).join('.')}.0>`,
						});

					await userModel.findOneAndUpdate(
						u => u.userId.includes(interaction.user.id),
						(u) => {
							u.lastPlayedVersion = version.split('.').slice(0, -1).join('.');
						},
					);
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
				await command.sendModalResponse(interaction, userData, serverData);
				return;
			}

			if (interaction.isMessageComponent()) {

				/* It's checking if the user that created the command is the same as the user that is interacting with the command, or if the user that is interacting is mentioned in the interaction.customId. If neither is true, it will send an error message. */
				const isCommandCreator = interaction.message.interaction !== null && interaction.message.interaction.user.id === interaction.user.id;
				const isMentioned = interaction.customId.includes('@' + interaction.user.id) || interaction.customId.includes('@EVERYONE') || (_userData && (interaction.customId.includes(_userData._id) || Object.keys(_userData.quids).some(q => interaction.customId.includes('@' + q))));

				if (interaction.isSelectMenu()) {

					console.log(`\x1b[32m${interaction.user.tag} (${interaction.user.id})\x1b[0m successfully selected \x1b[31m${interaction.values[0]} \x1b[0mfrom the menu \x1b[31m${interaction.customId} \x1b[0min \x1b[32m${interaction.guild?.name || 'DMs'} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
				}

				if (interaction.isButton()) {

					console.log(`\x1b[32m${interaction.user.tag} (${interaction.user.id})\x1b[0m successfully clicked the button \x1b[31m${interaction.customId} \x1b[0min \x1b[32m${interaction.guild?.name || 'DMs'} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);

					if (interaction.customId.startsWith('report_')) {

						if (!isCommandCreator && !isMentioned) {

							await respond(interaction, {
								content: 'Sorry, I only listen to the person that created the command 😣',
								ephemeral: true,
							}, false);
							return;
						}

						await update(interaction, {
							components: disableAllComponents(interaction.message.components),
						});

						const errorId = interaction.customId.split('_')[2] || generateId();
						const errorStacks = JSON.parse(readFileSync('./database/errorStacks.json', 'utf-8')) as ErrorStacks;
						const description = errorStacks[errorId] ? `\`\`\`\n${errorStacks[errorId]!.substring(0, 4090)}\n\`\`\`` : interaction.message.embeds[0]?.description;

						if (!description) {

							await respond(interaction, {
								embeds: [new EmbedBuilder()
									.setColor(error_color)
									.setDescription('There was an error trying to report the error... Ironic! Maybe you can try opening a ticket via `/ticket` instead?')],
								ephemeral: true,
							}, false);
							return;
						}

						await createNewTicket(interaction, `Error ${errorId}`, description, 'bug', null, errorId);
						delete errorStacks[errorId];
						writeFileSync('./database/errorStacks.json', JSON.stringify(errorStacks, null, '\t'));
						return;
					}

					if (interaction.customId.startsWith('settings_')) {

						if (!isCommandCreator && !isMentioned) {

							await respond(interaction, {
								content: 'Sorry, I only listen to the person that created the command 😣',
								ephemeral: true,
							}, false);
							return;
						}

						if (interaction.customId.includes('reminders')) {

							if (userData === null || _userData === null) { throw new TypeError('userData is null'); }
							if (!interaction.inCachedGuild()) { throw new Error('Interaction is not in cached guild'); }

							const isOn = interaction.customId.includes('on');

							if (interaction.customId.includes('water')) {

								await userData.update(
									(u) => {
										u.settings.reminders.water = isOn;
									},
								);

								/* This executes the sendReminder function for each profile for which the sapling exists and where lastMessageChannelId is a string, if the user has enabled water reminders. */
								if (userData.settings.reminders.water === true) {
									for (const quid of userData.quids.values()) {
										for (const profile of Object.values(quid.profiles)) {
											if (isOn) {

												const user = getUserData(_userData, profile.serverId, quid);
												if (hasNameAndSpecies(user) && user.quid.profile.sapling.exists && typeof user.quid.profile.sapling.lastMessageChannelId === 'string' && !user.quid.profile.sapling.sentReminder) { sendReminder(user); }
											}
											else { stopReminder(quid._id, interaction.guildId); }
										}
									}
								}

								await update(interaction, {
									components: [new ActionRowBuilder<ButtonBuilder>()
										.setComponents(new ButtonBuilder()
											.setCustomId(`settings_reminders_water_${isOn ? 'off' : 'on'}_@${userData._id}`)
											.setLabel(`Turn water reminders ${isOn ? 'off' : 'on'}`)
											.setStyle(ButtonStyle.Secondary))],
								});

								await respond(interaction, {
									content: `You turned reminders for watering ${isOn ? 'on' : 'off'}!`,
									ephemeral: true,
								}, false);
							}

							if (interaction.customId.includes('resting')) {

								await userData.update(
									(u) => {
										u.settings.reminders.resting = isOn;
									},
								);

								await update(interaction, {
									components: [new ActionRowBuilder<ButtonBuilder>()
										.setComponents(new ButtonBuilder()
											.setCustomId(`settings_reminders_resting_${isOn ? 'off' : 'on'}_@${userData._id}`)
											.setLabel(`Turn automatic resting pings ${isOn ? 'off' : 'on'}`)
											.setStyle(ButtonStyle.Secondary))],
								});

								await respond(interaction, {
									content: `You turned pings for automatic resting ${isOn ? 'on' : 'off'}!`,
									ephemeral: true,
								}, false);
							}
						}
					}
				}

				/* Getting the command from the client and checking if the command is undefined.
				If it is, it will error. */
				const customId = deconstructCustomId(interaction.customId);
				const command = handle.slashCommands.get(customId?.commandName ?? '') ?? handle.contextMenuCommands.get(customId?.commandName ?? '');
				if (command === undefined || command.sendMessageComponentResponse === undefined) { return; }

				if (!isCommandCreator && !isMentioned) {

					await respond(interaction, {
						content: 'Sorry, I only listen to the person that created the command 😣',
						ephemeral: true,
					}, false);
					return;
				}

				/* It's sending the autocomplete message. */
				await command.sendMessageComponentResponse(interaction, userData, serverData);
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